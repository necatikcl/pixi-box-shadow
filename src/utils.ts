import { Color } from 'pixi.js';
import type { BoxShadowOptions } from './types';

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
