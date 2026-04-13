import { Color } from 'pixi.js';
import type { BoxShadowOptions } from './types';

/** Knobs for texture-mode separable Gaussian blur (see `alpha-blur` shaders). */
export interface BlurKernelKnobs {
  /** Kernel half-extent multiplier in units of σ (CSS blur σ = blurRadius / 2). */
  sigmaExtent: number;
  /** Sample every N pixels along the 1D kernel (2 is coarser, fewer taps). */
  sampleStride: number;
  /** Hard cap on kernel radius in pixels (per side). */
  maxRadius: number;
}

/**
 * Maps `BoxShadowFilter` quality 1–5 to blur cost. Higher quality = more taps / wider kernel.
 * Quality 5 matches the pre–quality-knob defaults (3σ extent, stride 1, cap 64).
 */
export function blurKernelKnobs(quality: number): BlurKernelKnobs {
  const q = Math.max(1, Math.min(5, Math.round(quality)));
  switch (q) {
    case 1:
      return { sigmaExtent: 2.12, sampleStride: 2, maxRadius: 26 };
    case 2:
      return { sigmaExtent: 2.35, sampleStride: 2, maxRadius: 34 };
    case 3:
      return { sigmaExtent: 2.62, sampleStride: 1, maxRadius: 44 };
    case 4:
      return { sigmaExtent: 2.88, sampleStride: 1, maxRadius: 56 };
    default:
      return { sigmaExtent: 3.0, sampleStride: 1, maxRadius: 64 };
  }
}

/**
 * Calculate the required filter padding from a set of shadow options.
 * Padding must accommodate the maximum extent of any outer shadow.
 */
export function calculatePadding(shadows: BoxShadowOptions[]): number {
  let padding = 0;

  for (const shadow of shadows) {
    if (shadow.inset) continue; // Inset shadows don't need padding

    // Shadow extends by: |offset| + blur * 1.5 (for Gaussian tail) + spread
    const extentX = Math.abs(shadow.offsetX) + shadow.blur * 1.5 + Math.max(shadow.spread, 0);
    const extentY = Math.abs(shadow.offsetY) + shadow.blur * 1.5 + Math.max(shadow.spread, 0);
    padding = Math.max(padding, extentX, extentY);
  }

  return Math.ceil(padding);
}

/**
 * Resolve a BoxShadowOptions color to an [r, g, b] tuple in 0–1 range.
 */
export function resolveColor(shadow: BoxShadowOptions): [number, number, number, number] {
  const c = new Color(shadow.color);
  const [r, g, b] = c.toArray();
  return [r, g, b, shadow.alpha];
}

/**
 * Normalize border-radius input to a 4-element tuple [TL, TR, BR, BL].
 */
export function normalizeBorderRadius(
  value: number | [number, number, number, number] | undefined
): [number, number, number, number] {
  if (value === undefined || value === null) return [0, 0, 0, 0];
  if (typeof value === 'number') return [value, value, value, value];
  return value;
}
