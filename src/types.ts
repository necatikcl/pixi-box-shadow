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
 * - `'texture'` — Samples the element's actual alpha channel to derive the
 *   shadow shape. Works with any shape (circles, stars, sprites, text, etc.)
 *   but costs more per pixel due to multi-tap texture sampling. The number
 *   of samples is controlled by `quality`.
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
   * - `'texture'` — samples the element's alpha channel. Works with any
   *   shape but uses more GPU texture reads.
   *
   * @default 'box'
   */
  shapeMode?: ShapeMode;

  /**
   * Base sample quality when `shapeMode` is `'texture'`.
   * Higher values produce smoother shadows at the cost of performance.
   * The actual sample count scales automatically with blur radius for
   * consistent quality at all blur sizes.
   *
   * Range: 1–5.
   * - 1 → 16 base samples (fast preview)
   * - 2 → 32 base samples
   * - 3 → 48 base samples (default, recommended)
   * - 4 → 64 base samples (high quality)
   * - 5 → 80 base samples (maximum quality)
   *
   * For large blurs (sigma > 8px) the sample count is automatically
   * increased up to 4x to maintain quality. Maximum 256 samples.
   *
   * Ignored when `shapeMode` is `'box'`.
   * @default 3
   */
  quality?: number;
}

/** Maximum number of shadows supported in a single filter pass. */
export const MAX_SHADOWS = 8;
