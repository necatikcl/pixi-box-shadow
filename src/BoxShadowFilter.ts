import { Filter, GlProgram, GpuProgram } from 'pixi.js';
import type { BoxShadowFilterOptions, BoxShadowOptions } from './types';
import { MAX_SHADOWS } from './types';
import { parseBoxShadow } from './parser';
import { calculatePadding, normalizeBorderRadius, resolveColor } from './utils';

// Import shaders as raw strings
import vertexSrc from './shaders/box-shadow.vert?raw';
import fragmentSrc from './shaders/box-shadow.frag?raw';
import wgslSrc from './shaders/box-shadow.wgsl?raw';

/**
 * High-performance CSS box-shadow implementation for PixiJS v8.
 *
 * Uses SDF (Signed Distance Field) analytical Gaussian blur to compute
 * shadows in a single pass with O(1) cost per pixel.
 *
 * Supports all CSS box-shadow features:
 * - Offset (x, y)
 * - Blur radius
 * - Spread radius (positive and negative)
 * - Inset shadows
 * - Per-corner border-radius
 * - Multiple shadows (up to 8 per filter)
 * - Full color + alpha control
 *
 * **Cache / idle behavior:**
 * This filter only runs when the display object is re-rendered.
 * When nothing changes (no property updates, no scene changes),
 * the GPU shader is NOT invoked — zero cost at idle. Uniform
 * updates (color, size, etc.) are simple typed-array writes with
 * no allocation, no string parsing, and no re-compilation.
 *
 * For dynamic animations, mutate `filter.uniforms.uShadowColor`
 * or similar typed arrays directly to avoid any overhead from
 * the property setters which re-parse and re-allocate.
 *
 * @example
 * ```typescript
 * // CSS string syntax
 * const filter = new BoxShadowFilter({
 *   boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
 *   width: 200,
 *   height: 100,
 *   borderRadius: 8,
 * });
 * graphics.filters = [filter];
 *
 * // Typed options
 * const filter = new BoxShadowFilter({
 *   shadows: [{ offsetX: 0, offsetY: 4, blur: 8, spread: 0, color: 0x000000, alpha: 0.3, inset: false }],
 *   width: 200,
 *   height: 100,
 *   borderRadius: [10, 10, 0, 0],
 * });
 *
 * // Direct uniform mutation for animations (fastest path)
 * filter.uniforms.uShadowColor[0] = 1.0; // r
 * filter.uniforms.uShadowColor[1] = 0.0; // g
 * filter.uniforms.uShadowColor[2] = 0.0; // b
 * filter.uniforms.uShadowColor[3] = 0.5; // a
 * ```
 */
export class BoxShadowFilter extends Filter {
  /** Maximum shadows per filter instance */
  public static readonly MAX_SHADOWS = MAX_SHADOWS;

  /** Default options */
  public static readonly DEFAULT_OPTIONS: Partial<BoxShadowFilterOptions> = {
    shadows: [],
    borderRadius: 0,
  };

  private _shadows: BoxShadowOptions[] = [];
  private _borderRadius: [number, number, number, number] = [0, 0, 0, 0];
  private _width: number;
  private _height: number;

  // Typed uniform accessor
  public uniforms: {
    uElementSize: Float32Array;
    uPaddingOffset: Float32Array;
    uBorderRadius: Float32Array;
    uShadowCount: number;
    uShadowOffsetBlurSpread: Float32Array;
    uShadowColor: Float32Array;
    uShadowInset: Float32Array;
  };

  constructor(options: BoxShadowFilterOptions) {
    const opts = { ...BoxShadowFilter.DEFAULT_OPTIONS, ...options };

    // Parse shadows
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

    // Clamp to max shadows
    if (shadows.length > MAX_SHADOWS) {
      console.warn(`BoxShadowFilter: Max ${MAX_SHADOWS} shadows supported. Extra shadows will be ignored.`);
      shadows = shadows.slice(0, MAX_SHADOWS);
    }

    const borderRadius = normalizeBorderRadius(opts.borderRadius);
    const pad = calculatePadding(shadows);

    // Create GPU programs
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

    // Initialize uniform data arrays
    const shadowOffsetBlurSpread = new Float32Array(MAX_SHADOWS * 4);
    const shadowColor = new Float32Array(MAX_SHADOWS * 4);
    const shadowInset = new Float32Array(MAX_SHADOWS);

    super({
      gpuProgram,
      glProgram,
      resources: {
        boxShadowUniforms: {
          uElementSize: { value: new Float32Array([opts.width, opts.height]), type: 'vec2<f32>' },
          uPaddingOffset: { value: new Float32Array([pad, pad]), type: 'vec2<f32>' },
          uBorderRadius: { value: new Float32Array(borderRadius), type: 'vec4<f32>' },
          uShadowCount: { value: shadows.length, type: 'i32' },
          uShadowOffsetBlurSpread: { value: shadowOffsetBlurSpread, type: 'vec4<f32>', size: MAX_SHADOWS },
          uShadowColor: { value: shadowColor, type: 'vec4<f32>', size: MAX_SHADOWS },
          uShadowInset: { value: shadowInset, type: 'f32', size: MAX_SHADOWS },
        },
      },
      padding: pad,
      // Inherit renderer resolution so the filter renders at the correct DPR
      // (e.g. 2x on retina displays). Without this, filters default to 1x
      // which causes blurry output on high-DPI screens.
      resolution: 'inherit',
    });

    this.uniforms = this.resources.boxShadowUniforms.uniforms;
    this._width = opts.width;
    this._height = opts.height;
    this._borderRadius = borderRadius;
    this._shadows = shadows;

    // Pack shadow data into uniforms
    this._updateShadowUniforms();
  }

  // ----------------------------------------------------------------
  // Shadow data management
  // ----------------------------------------------------------------

  /** Get the current shadow definitions. */
  get shadows(): BoxShadowOptions[] {
    return this._shadows;
  }

  /** Set shadow definitions (typed objects or CSS strings). */
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

  /** Set shadows from a CSS box-shadow string. */
  set boxShadow(value: string) {
    this.shadows = parseBoxShadow(value);
  }

  /** Get a CSS-like representation of the current shadows. */
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
  // Element geometry
  // ----------------------------------------------------------------

  /** Element width in pixels. */
  get elementWidth(): number { return this._width; }
  set elementWidth(value: number) {
    this._width = value;
    this.uniforms.uElementSize[0] = value;
    this._updatePadding();
  }

  /** Element height in pixels. */
  get elementHeight(): number { return this._height; }
  set elementHeight(value: number) {
    this._height = value;
    this.uniforms.uElementSize[1] = value;
    this._updatePadding();
  }

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
  // Private helpers
  // ----------------------------------------------------------------

  /** Pack all shadow data into the uniform arrays. */
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
        // Zero out unused slots
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

  /** Recalculate filter padding based on current shadows. */
  private _updatePadding(): void {
    const pad = calculatePadding(this._shadows);
    this.padding = pad;
    this.uniforms.uPaddingOffset[0] = pad;
    this.uniforms.uPaddingOffset[1] = pad;
  }
}
