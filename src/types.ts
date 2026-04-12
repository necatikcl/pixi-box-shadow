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
   * Corner radii in pixels.
   * - A single number applies to all corners.
   * - An array of 4 numbers: [top-left, top-right, bottom-right, bottom-left].
   * @default 0
   */
  borderRadius?: number | [number, number, number, number];

  /**
   * Element width in pixels. Required for SDF computation.
   */
  width: number;

  /**
   * Element height in pixels. Required for SDF computation.
   */
  height: number;
}

/** Maximum number of shadows supported in a single filter pass. */
export const MAX_SHADOWS = 8;
