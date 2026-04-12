import type { ColorSource } from 'pixi.js';

/**
 * Describes a single CSS box-shadow layer.
 */
export interface BoxShadowOptions {
  /** Horizontal offset in pixels. Positive = right. */
  offsetX: number;
  /** Vertical offset in pixels. Positive = down. */
  offsetY: number;
  /** Blur radius in pixels (≥ 0). CSS sigma = blur / 2. */
  blur: number;
  /** Spread radius in pixels. Positive = expand, negative = shrink. */
  spread: number;
  /** Shadow color. Any PixiJS ColorSource. */
  color: ColorSource;
  /** Shadow opacity (0–1). */
  alpha: number;
  /** If true, shadow is rendered inside the element (inset). */
  inset: boolean;
}

/**
 * Shadow shape computation mode.
 *
 * - `'box'` (default) — Uses SDF of a rounded rectangle. O(1) per pixel,
 *   best performance. Requires the element to be rectangular (optionally
 *   with rounded corners via `borderRadius`).
 *
 * - `'texture'` — Uses the element's actual alpha channel to derive the
 *   shadow shape via a two-pass separable Gaussian blur (the same approach
 *   CSS `filter: drop-shadow()` uses). Works with any shape (circles, stars,
 *   sprites, text, etc.) with mathematically correct Gaussian blur quality.
 */
export type ShapeMode = 'box' | 'texture';

/**
 * Options for the BoxShadowFilter constructor.
 */
export interface BoxShadowFilterOptions {
  /**
   * Array of shadow definitions (typed objects or CSS strings).
   * Rendered back-to-front: first shadow in array = topmost visually.
   */
  shadows?: (BoxShadowOptions | string)[];

  /**
   * CSS box-shadow string. Alternative to `shadows` array.
   * If both are provided, `boxShadow` is used.
   */
  boxShadow?: string;

  /**
   * Corner radii in pixels (only used when `shapeMode` is `'box'`).
   * - A single number applies to all corners.
   * - An array of 4 numbers: [top-left, top-right, bottom-right, bottom-left].
   * @default 0
   */
  borderRadius?: number | [number, number, number, number];

  /**
   * How the shadow shape is computed.
   *
   * - `'box'` (default) — analytical SDF rounded-rectangle. O(1) per pixel.
   * - `'texture'` — two-pass separable Gaussian blur on the element's alpha
   *   channel (CSS `filter: drop-shadow()` approach). Works with any shape.
   *
   * @default 'box'
   */
  shapeMode?: ShapeMode;

  /**
   * Reserved for future use. Currently has no visual effect.
   *
   * The texture-mode blur quality is now inherently high: the two-pass
   * separable Gaussian blur covers 3σ in each direction, capturing 99.7%
   * of the Gaussian energy — producing mathematically correct results at
   * any blur radius.
   *
   * Ignored when `shapeMode` is `'box'`.
   * @default 3
   */
  quality?: number;
}

/** Maximum number of shadows supported in a single filter pass. */
export const MAX_SHADOWS = 8;
