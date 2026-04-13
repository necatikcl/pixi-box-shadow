import { Filter, GlProgram, GpuProgram, TexturePool, Texture } from 'pixi.js';
import type { FilterSystem } from 'pixi.js';
import type { RenderSurface } from 'pixi.js';
import type { BoxShadowFilterOptions, BoxShadowOptions, ShapeMode } from './types';
import { MAX_SHADOWS } from './types';
import { parseBoxShadow } from './parser';
import { calculatePadding, normalizeBorderRadius, resolveColor } from './utils';

import vertexSrc from './shaders/box-shadow.vert?raw';
import fragmentSrc from './shaders/box-shadow.frag?raw';
import wgslSrc from './shaders/box-shadow.wgsl?raw';

import blurVertexSrc from './shaders/alpha-blur.vert?raw';
import blurFragmentSrc from './shaders/alpha-blur.frag?raw';
import blurWgslSrc from './shaders/alpha-blur.wgsl?raw';

/**
 * High-performance CSS box-shadow implementation for PixiJS v8.
 *
 * Uses SDF (Signed Distance Field) analytical Gaussian blur to compute
 * shadows in a single pass with O(1) cost per pixel.
 *
 * Element size is always auto-detected from the display object's rendered
 * bounds — no manual `width`/`height` needed.
 *
 * Two shape modes are available:
 * - `'box'` (default) — SDF rounded rectangle. Fastest.
 * - `'texture'` — two-pass separable Gaussian blur on the element's alpha
 *   channel (CSS `filter: drop-shadow()` approach). Supports any shape.
 *
 * @example
 * ```typescript
 * // Minimal — just add a shadow
 * sprite.filters = [new BoxShadowFilter({
 *   boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
 * })];
 *
 * // Arbitrary shapes — texture-based
 * star.filters = [new BoxShadowFilter({
 *   boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
 *   shapeMode: 'texture',
 * })];
 * ```
 */
export class BoxShadowFilter extends Filter {
  /** Maximum shadows per filter instance */
  public static readonly MAX_SHADOWS = MAX_SHADOWS;

  /** Default options */
  public static readonly DEFAULT_OPTIONS: Partial<BoxShadowFilterOptions> = {
    shadows: [],
    borderRadius: 0,
    shapeMode: 'box',
    quality: 3,
  };

  private _shadows: BoxShadowOptions[] = [];
  private _borderRadius: [number, number, number, number] = [0, 0, 0, 0];
  private _width: number = 0;
  private _height: number = 0;
  private _shapeMode: ShapeMode;
  private _quality: number;

  /**
   * Internal filter for the 1D Gaussian blur passes (texture mode only).
   * Created lazily on first texture-mode apply.
   */
  private _blurFilter: Filter | null = null;

  // Typed uniform accessor
  public uniforms: {
    uElementSize: Float32Array;
    uPaddingOffset: Float32Array;
    uBorderRadius: Float32Array;
    uShadowCount: number;
    uShadowOffsetBlurSpread: Float32Array;
    uShadowColor: Float32Array;
    uShadowInset: Float32Array;
    uShapeMode: number;
    uQuality: number;
    uMaxSigma: number;
  };

  constructor(options: BoxShadowFilterOptions = {}) {
    const opts = { ...BoxShadowFilter.DEFAULT_OPTIONS, ...options };

    let shadows: BoxShadowOptions[];
    if (opts.boxShadow) {
      shadows = parseBoxShadow(opts.boxShadow);
    } else if (opts.shadows) {
      shadows = opts.shadows.map((s) => {
        if (typeof s === 'string') return parseBoxShadow(s)[0];
        return s;
      });
    } else {
      shadows = [];
    }

    if (shadows.length > MAX_SHADOWS) {
      console.warn(`BoxShadowFilter: Max ${MAX_SHADOWS} shadows supported. Extra shadows will be ignored.`);
      shadows = shadows.slice(0, MAX_SHADOWS);
    }

    const borderRadius = normalizeBorderRadius(opts.borderRadius);
    const pad = calculatePadding(shadows);

    const shapeMode: ShapeMode = opts.shapeMode ?? 'box';
    const quality = Math.max(1, Math.min(5, Math.round(opts.quality ?? 3)));

    const glProgram = GlProgram.from({
      vertex: vertexSrc,
      fragment: fragmentSrc,
      name: 'box-shadow-filter',
    });

    const gpuProgram = GpuProgram.from({
      vertex: {
        source: wgslSrc,
        entryPoint: 'mainVertex',
      },
      fragment: {
        source: wgslSrc,
        entryPoint: 'mainFragment',
      },
    });

    const shadowOffsetBlurSpread = new Float32Array(MAX_SHADOWS * 4);
    const shadowColor = new Float32Array(MAX_SHADOWS * 4);
    const shadowInset = new Float32Array(MAX_SHADOWS);

    super({
      gpuProgram,
      glProgram,
      resources: {
        boxShadowUniforms: {
          uElementSize: { value: new Float32Array([0, 0]), type: 'vec2<f32>' },
          uPaddingOffset: { value: new Float32Array([pad, pad]), type: 'vec2<f32>' },
          uBorderRadius: { value: new Float32Array(borderRadius), type: 'vec4<f32>' },
          uShadowCount: { value: shadows.length, type: 'i32' },
          uShapeMode: { value: shapeMode === 'texture' ? 1 : 0, type: 'i32' },
          uQuality: { value: quality, type: 'i32' },
          uShadowOffsetBlurSpread: { value: shadowOffsetBlurSpread, type: 'vec4<f32>', size: MAX_SHADOWS },
          uShadowColor: { value: shadowColor, type: 'vec4<f32>', size: MAX_SHADOWS },
          uShadowInset: { value: shadowInset, type: 'f32', size: MAX_SHADOWS },
          uMaxSigma: { value: 0, type: 'f32' },
        },
        // Blurred alpha texture (texture mode only) — set dynamically in apply()
        uBlurredAlpha: Texture.EMPTY.source,
        uBlurredAlphaSampler: Texture.EMPTY.source.style,
      },
      padding: pad,
      resolution: 'inherit',
    });

    this.uniforms = this.resources.boxShadowUniforms.uniforms;
    this._borderRadius = borderRadius;
    this._shadows = shadows;
    this._shapeMode = shapeMode;
    this._quality = quality;

    this._updateShadowUniforms();
  }

  // ----------------------------------------------------------------
  // Lazy blur filter creation (texture mode)
  // ----------------------------------------------------------------

  private _ensureBlurFilter(): Filter {
    if (this._blurFilter) return this._blurFilter;

    const blurGlProgram = GlProgram.from({
      vertex: blurVertexSrc,
      fragment: blurFragmentSrc,
      name: 'alpha-blur-filter',
    });

    const blurGpuProgram = GpuProgram.from({
      vertex: {
        source: blurWgslSrc,
        entryPoint: 'mainVertex',
      },
      fragment: {
        source: blurWgslSrc,
        entryPoint: 'mainFragment',
      },
    });

    this._blurFilter = new Filter({
      glProgram: blurGlProgram,
      gpuProgram: blurGpuProgram,
      resources: {
        alphaBlurUniforms: {
          uDirection: { value: new Float32Array([1, 0]), type: 'vec2<f32>' },
          uStrength: { value: 0, type: 'f32' },
        },
      },
      padding: 0,
      resolution: 'inherit',
    });

    return this._blurFilter;
  }

  // ----------------------------------------------------------------
  // Filter apply — always derive size from input texture
  // ----------------------------------------------------------------

  apply(filterManager: FilterSystem, input: Texture, output: RenderSurface, clearMode: boolean): void {
    const pad = this.padding;
    const w = input.frame.width - pad * 2;
    const h = input.frame.height - pad * 2;

    if (w !== this._width || h !== this._height) {
      this._width = w;
      this._height = h;
      this.uniforms.uElementSize[0] = w;
      this.uniforms.uElementSize[1] = h;
    }

    // Box mode: single pass (analytical SDF, unchanged)
    if (this._shapeMode !== 'texture') {
      filterManager.applyFilter(this, input, output, clearMode);
      return;
    }

    // Texture mode: two-pass separable Gaussian blur + composite
    this._applyTextureMode(filterManager, input, output, clearMode);
  }

  /**
   * Texture mode: apply two-pass separable Gaussian blur on the input
   * alpha channel at the maximum sigma, then composite all shadows
   * in a single pass.
   *
   * This replicates how CSS `filter: drop-shadow()` works in browser
   * engines, producing mathematically correct Gaussian blur.
   */
  private _applyTextureMode(
    filterManager: FilterSystem,
    input: Texture,
    output: RenderSurface,
    clearMode: boolean,
  ): void {
    // Find the maximum sigma across all shadows
    let maxSigma = 0;
    for (const shadow of this._shadows) {
      const sigma = shadow.blur * 0.5;
      if (sigma > maxSigma) maxSigma = sigma;
    }

    // If no shadow needs blur, skip blur passes
    if (maxSigma < 0.5) {
      this.resources.uBlurredAlpha = Texture.EMPTY.source;
      this.resources.uBlurredAlphaSampler = Texture.EMPTY.source.style;
      this.uniforms.uMaxSigma = 0;
      filterManager.applyFilter(this, input, output, clearMode);
      return;
    }

    const blurFilter = this._ensureBlurFilter();
    const blurUniforms = blurFilter.resources.alphaBlurUniforms.uniforms;

    // ── Pass 1: Horizontal blur ──────────────────────────────
    const tempH = TexturePool.getSameSizeTexture(input);
    blurUniforms.uDirection[0] = 1;
    blurUniforms.uDirection[1] = 0;
    blurUniforms.uStrength = maxSigma;
    filterManager.applyFilter(blurFilter, input, tempH, true);

    // ── Pass 2: Vertical blur ────────────────────────────────
    const tempV = TexturePool.getSameSizeTexture(input);
    blurUniforms.uDirection[0] = 0;
    blurUniforms.uDirection[1] = 1;
    filterManager.applyFilter(blurFilter, tempH, tempV, true);
    TexturePool.returnTexture(tempH);

    // ── Pass 3: Composite ────────────────────────────────────
    this.resources.uBlurredAlpha = tempV.source;
    this.resources.uBlurredAlphaSampler = tempV.source.style;
    this.uniforms.uMaxSigma = maxSigma;

    filterManager.applyFilter(this, input, output, clearMode);
    TexturePool.returnTexture(tempV);
  }

  // ----------------------------------------------------------------
  // Shadow data management
  // ----------------------------------------------------------------

  get shadows(): BoxShadowOptions[] {
    return this._shadows;
  }

  set shadows(value: (BoxShadowOptions | string)[]) {
    let shadows = value.map((s) => {
      if (typeof s === 'string') return parseBoxShadow(s)[0];
      return s;
    });
    if (shadows.length > MAX_SHADOWS) {
      console.warn(`BoxShadowFilter: Max ${MAX_SHADOWS} shadows supported.`);
      shadows = shadows.slice(0, MAX_SHADOWS);
    }
    this._shadows = shadows;
    this._updateShadowUniforms();
    this._updatePadding();
  }

  set boxShadow(value: string) {
    this.shadows = parseBoxShadow(value);
  }

  get boxShadow(): string {
    return this._shadows.map((s) => {
      const parts: string[] = [];
      if (s.inset) parts.push('inset');
      parts.push(`${s.offsetX}px`);
      parts.push(`${s.offsetY}px`);
      parts.push(`${s.blur}px`);
      parts.push(`${s.spread}px`);

      const c = resolveColor(s);
      parts.push(`rgba(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)}, ${c[3]})`);
      return parts.join(' ');
    }).join(', ');
  }

  // ----------------------------------------------------------------
  // Element geometry (read-only — always auto-detected)
  // ----------------------------------------------------------------

  /** Current element width in pixels (auto-detected from display object bounds). */
  get elementWidth(): number { return this._width; }

  /** Current element height in pixels (auto-detected from display object bounds). */
  get elementHeight(): number { return this._height; }

  /** Border radius. Uniform number or [TL, TR, BR, BL] array. */
  get borderRadius(): number | [number, number, number, number] {
    const r = this._borderRadius;
    if (r[0] === r[1] && r[1] === r[2] && r[2] === r[3]) return r[0];
    return [...r] as [number, number, number, number];
  }

  set borderRadius(value: number | [number, number, number, number]) {
    this._borderRadius = normalizeBorderRadius(value);
    this.uniforms.uBorderRadius[0] = this._borderRadius[0];
    this.uniforms.uBorderRadius[1] = this._borderRadius[1];
    this.uniforms.uBorderRadius[2] = this._borderRadius[2];
    this.uniforms.uBorderRadius[3] = this._borderRadius[3];
  }

  // ----------------------------------------------------------------
  // Shape mode
  // ----------------------------------------------------------------

  get shapeMode(): ShapeMode {
    return this._shapeMode;
  }

  set shapeMode(value: ShapeMode) {
    this._shapeMode = value;
    this.uniforms.uShapeMode = value === 'texture' ? 1 : 0;
  }

  get quality(): number {
    return this._quality;
  }

  set quality(value: number) {
    this._quality = Math.max(1, Math.min(5, Math.round(value)));
    this.uniforms.uQuality = this._quality;
  }

  // ----------------------------------------------------------------
  // Private helpers
  // ----------------------------------------------------------------

  private _updateShadowUniforms(): void {
    const count = this._shadows.length;
    this.uniforms.uShadowCount = count;

    const obsArr = this.uniforms.uShadowOffsetBlurSpread;
    const colArr = this.uniforms.uShadowColor;
    const insetArr = this.uniforms.uShadowInset;

    for (let i = 0; i < MAX_SHADOWS; i++) {
      const idx = i * 4;
      if (i < count) {
        const s = this._shadows[i];
        const [r, g, b, a] = resolveColor(s);

        obsArr[idx + 0] = s.offsetX;
        obsArr[idx + 1] = s.offsetY;
        obsArr[idx + 2] = s.blur;
        obsArr[idx + 3] = s.spread;

        colArr[idx + 0] = r;
        colArr[idx + 1] = g;
        colArr[idx + 2] = b;
        colArr[idx + 3] = a;

        insetArr[i] = s.inset ? 1.0 : 0.0;
      } else {
        obsArr[idx + 0] = 0;
        obsArr[idx + 1] = 0;
        obsArr[idx + 2] = 0;
        obsArr[idx + 3] = 0;

        colArr[idx + 0] = 0;
        colArr[idx + 1] = 0;
        colArr[idx + 2] = 0;
        colArr[idx + 3] = 0;

        insetArr[i] = 0;
      }
    }
  }

  private _updatePadding(): void {
    const pad = calculatePadding(this._shadows);
    this.padding = pad;
    this.uniforms.uPaddingOffset[0] = pad;
    this.uniforms.uPaddingOffset[1] = pad;
  }
}
