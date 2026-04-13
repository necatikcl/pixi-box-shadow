import { Filter, GlProgram, GpuProgram, TexturePool, Texture } from 'pixi.js';
import type { FilterSystem } from 'pixi.js';
import type { RenderSurface } from 'pixi.js';
import type { BoxShadowFilterOptions, BoxShadowOptions, ShapeMode } from './types';
import { MAX_SHADOWS } from './types';
import { parseBoxShadow } from './parser';
import { blurKernelKnobs, calculatePadding, normalizeBorderRadius, resolveColor } from './utils';

import vertexSrc from './shaders/box-shadow.vert?raw';
import sdfFragmentSrc from './shaders/box-shadow-sdf.frag?raw';
import sdfWgslSrc from './shaders/box-shadow-sdf.wgsl?raw';
import textureFragmentSrc from './shaders/box-shadow-texture.frag?raw';
import textureWgslSrc from './shaders/box-shadow-texture.wgsl?raw';

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

  /** GPU uniforms for the main filter (`texture` mode adds uShapeMode, uQuality, …). */
  public uniforms: {
    uElementSize: Float32Array;
    uPaddingOffset: Float32Array;
    uBorderRadius: Float32Array;
    uShadowCount: number;
    uShadowOffsetBlurSpread: Float32Array;
    uShadowColor: Float32Array;
    uShadowInset: Float32Array;
    uShapeMode?: number;
    uQuality?: number;
    uMaxSigma?: number;
    uRenderElement?: number;
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
    const isTexture = shapeMode === 'texture';

    const shadowOffsetBlurSpread = new Float32Array(MAX_SHADOWS * 4);
    const shadowColor = new Float32Array(MAX_SHADOWS * 4);
    const shadowInset = new Float32Array(MAX_SHADOWS);

    const glProgram = GlProgram.from({
      vertex: vertexSrc,
      fragment: isTexture ? textureFragmentSrc : sdfFragmentSrc,
      name: isTexture ? 'box-shadow-texture' : 'box-shadow-sdf',
    });

    const gpuProgram = GpuProgram.from({
      vertex: {
        source: isTexture ? textureWgslSrc : sdfWgslSrc,
        entryPoint: 'mainVertex',
      },
      fragment: {
        source: isTexture ? textureWgslSrc : sdfWgslSrc,
        entryPoint: 'mainFragment',
      },
    });

    const boxShadowUniforms = isTexture
      ? {
          uElementSize: { value: new Float32Array([0, 0]), type: 'vec2<f32>' },
          uPaddingOffset: { value: new Float32Array([pad, pad]), type: 'vec2<f32>' },
          uBorderRadius: { value: new Float32Array(borderRadius), type: 'vec4<f32>' },
          uShadowCount: { value: shadows.length, type: 'i32' },
          uShapeMode: { value: 1, type: 'i32' },
          uQuality: { value: quality, type: 'i32' },
          _pad0: { value: 0, type: 'i32' },
          uShadowOffsetBlurSpread: { value: shadowOffsetBlurSpread, type: 'vec4<f32>', size: MAX_SHADOWS },
          uShadowColor: { value: shadowColor, type: 'vec4<f32>', size: MAX_SHADOWS },
          uShadowInset: { value: shadowInset, type: 'f32', size: MAX_SHADOWS },
          uMaxSigma: { value: 0, type: 'f32' },
          uRenderElement: { value: 1, type: 'i32' },
        }
      : {
          uElementSize: { value: new Float32Array([0, 0]), type: 'vec2<f32>' },
          uPaddingOffset: { value: new Float32Array([pad, pad]), type: 'vec2<f32>' },
          uBorderRadius: { value: new Float32Array(borderRadius), type: 'vec4<f32>' },
          uShadowCount: { value: shadows.length, type: 'i32' },
          _pad0: { value: 0, type: 'i32' },
          _pad1: { value: 0, type: 'i32' },
          _pad2: { value: 0, type: 'i32' },
          uShadowOffsetBlurSpread: { value: shadowOffsetBlurSpread, type: 'vec4<f32>', size: MAX_SHADOWS },
          uShadowColor: { value: shadowColor, type: 'vec4<f32>', size: MAX_SHADOWS },
          uShadowInset: { value: shadowInset, type: 'f32', size: MAX_SHADOWS },
        };

    super({
      gpuProgram,
      glProgram,
      resources: isTexture
        ? {
            boxShadowUniforms,
            uBlurredAlpha: Texture.EMPTY.source,
            uBlurredAlphaSampler: Texture.EMPTY.source.style,
          }
        : { boxShadowUniforms },
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
          uSigmaExtent: { value: 3, type: 'f32' },
          uSampleStride: { value: 1, type: 'f32' },
          uMaxRadius: { value: 64, type: 'f32' },
          uPad: { value: 0, type: 'f32' },
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
   * Texture mode: for each unique blur sigma, run a dedicated two-pass
   * separable Gaussian blur, then composite that group's shadows.
   *
   * When there's only one unique sigma (common case), this is just
   * 3 passes: H blur → V blur → composite.
   *
   * For multiple unique sigmas, each group renders its shadows via
   * source-over blending. Intermediate groups render shadows only
   * (uRenderElement=0); the last group includes the element.
   */
  private _applyTextureMode(
    filterManager: FilterSystem,
    input: Texture,
    output: RenderSurface,
    clearMode: boolean,
  ): void {
    const shadows = this._shadows;
    if (shadows.length === 0) {
      this.uniforms.uRenderElement = 1;
      filterManager.applyFilter(this, input, output, clearMode);
      return;
    }

    // ── Collect unique sigmas ────────────────────────────────
    const sigmaSet = new Set<number>();
    for (const shadow of shadows) {
      sigmaSet.add(shadow.blur * 0.5);
    }
    const uniqueSigmas = Array.from(sigmaSet).sort((a, b) => a - b);

    // ── Single sigma: fast path (3 passes) ───────────────────
    if (uniqueSigmas.length === 1) {
      const sigma = uniqueSigmas[0];
      this.uniforms.uRenderElement = 1;
      this.uniforms.uMaxSigma = sigma;

      if (sigma < 0.5) {
        this.resources.uBlurredAlpha = Texture.EMPTY.source;
        this.resources.uBlurredAlphaSampler = Texture.EMPTY.source.style;
        filterManager.applyFilter(this, input, output, clearMode);
        return;
      }

      const blurred = this._blurAlpha(filterManager, input, sigma);
      this.resources.uBlurredAlpha = blurred.source;
      this.resources.uBlurredAlphaSampler = blurred.source.style;
      filterManager.applyFilter(this, input, output, clearMode);
      TexturePool.returnTexture(blurred);
      return;
    }

    // ── Multiple sigmas: per-group passes ────────────────────
    // Save original shadow color alphas (we'll zero out inactive groups)
    const origColorAlphas: number[] = [];
    for (let i = 0; i < shadows.length; i++) {
      origColorAlphas.push(this.uniforms.uShadowColor[i * 4 + 3]);
    }

    for (let gi = 0; gi < uniqueSigmas.length; gi++) {
      const sigma = uniqueSigmas[gi];
      const isLast = gi === uniqueSigmas.length - 1;

      // Zero out shadow color alpha for shadows NOT in this sigma group
      for (let i = 0; i < shadows.length; i++) {
        const shadowSigma = shadows[i].blur * 0.5;
        const inGroup = Math.abs(shadowSigma - sigma) < 0.01;
        this.uniforms.uShadowColor[i * 4 + 3] = inGroup ? origColorAlphas[i] : 0;
      }

      // Blur at this sigma
      this.uniforms.uMaxSigma = sigma;
      if (sigma >= 0.5) {
        const blurred = this._blurAlpha(filterManager, input, sigma);
        this.resources.uBlurredAlpha = blurred.source;
        this.resources.uBlurredAlphaSampler = blurred.source.style;

        // Render: shadows only for intermediate, full for last
        this.uniforms.uRenderElement = isLast ? 1 : 0;
        filterManager.applyFilter(this, input, output, gi === 0 ? clearMode : false);

        TexturePool.returnTexture(blurred);
      } else {
        this.resources.uBlurredAlpha = Texture.EMPTY.source;
        this.resources.uBlurredAlphaSampler = Texture.EMPTY.source.style;

        this.uniforms.uRenderElement = isLast ? 1 : 0;
        filterManager.applyFilter(this, input, output, gi === 0 ? clearMode : false);
      }
    }

    // Restore original color alphas
    for (let i = 0; i < shadows.length; i++) {
      this.uniforms.uShadowColor[i * 4 + 3] = origColorAlphas[i];
    }
    this.uniforms.uRenderElement = 1;
  }

  /**
   * Run a two-pass separable Gaussian blur on input's alpha channel.
   * Returns the blurred texture (caller must return it to TexturePool).
   */
  private _blurAlpha(filterManager: FilterSystem, input: Texture, sigma: number): Texture {
    const blurFilter = this._ensureBlurFilter();
    const blurUniforms = blurFilter.resources.alphaBlurUniforms.uniforms;

    const k = blurKernelKnobs(this._quality);
    blurUniforms.uSigmaExtent = k.sigmaExtent;
    blurUniforms.uSampleStride = k.sampleStride;
    blurUniforms.uMaxRadius = k.maxRadius;

    const tempH = TexturePool.getSameSizeTexture(input);
    blurUniforms.uDirection[0] = 1;
    blurUniforms.uDirection[1] = 0;
    blurUniforms.uStrength = sigma;
    filterManager.applyFilter(blurFilter, input, tempH, true);

    const tempV = TexturePool.getSameSizeTexture(input);
    blurUniforms.uDirection[0] = 0;
    blurUniforms.uDirection[1] = 1;
    filterManager.applyFilter(blurFilter, tempH, tempV, true);

    TexturePool.returnTexture(tempH);
    return tempV;
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
    if (this.uniforms.uShapeMode !== undefined) {
      this.uniforms.uShapeMode = value === 'texture' ? 1 : 0;
    }
  }

  get quality(): number {
    return this._quality;
  }

  set quality(value: number) {
    this._quality = Math.max(1, Math.min(5, Math.round(value)));
    if (this.uniforms.uQuality !== undefined) {
      this.uniforms.uQuality = this._quality;
    }
    if (this._blurFilter) {
      const k = blurKernelKnobs(this._quality);
      const bu = this._blurFilter.resources.alphaBlurUniforms.uniforms;
      bu.uSigmaExtent = k.sigmaExtent;
      bu.uSampleStride = k.sampleStride;
      bu.uMaxRadius = k.maxRadius;
    }
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
