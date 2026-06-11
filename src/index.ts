/**
 * pixi-box-shadow
 *
 * CSS box-shadow for PixiJS v8 — pixel-accurate, GPU-accelerated, single-pass.
 *
 * Main entry: BoxShadowFilter — apply it to any display object via `obj.filters = [filter]`.
 * Parser: parseBoxShadow() — convert CSS box-shadow strings to typed options.
 *
 * @packageDocumentation
 */

export { BoxShadowFilter } from './BoxShadowFilter';
export { parseBoxShadow } from './parser';
export type { BoxShadowOptions, BoxShadowFilterOptions, ShapeMode } from './types';
export { MAX_SHADOWS } from './types';
export { blurKernelKnobs } from './utils';
export type { BlurKernelKnobs } from './utils';
