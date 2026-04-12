# pixi-box-shadow

CSS `box-shadow` for [PixiJS v8](https://pixijs.com/) — pixel-accurate, GPU-accelerated, single-pass.

Write shadows the same way you write CSS. Get the same result on a PixiJS canvas.

```typescript
import { BoxShadowFilter } from 'pixi-box-shadow';

// Exactly like CSS
element.filters = [new BoxShadowFilter({
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
  width: 200,
  height: 100,
  borderRadius: 8,
})];
```

---

## Why?

PixiJS doesn't have a native `box-shadow`. The community [DropShadowFilter](https://github.com/pixijs/filters) uses multi-pass Kawase blur — it doesn't support spread, inset, or border-radius, and gets slower with larger blur values.

This plugin computes shadows **analytically in the GPU shader** using signed distance fields. The cost is constant regardless of blur size. It supports every CSS `box-shadow` feature.

| | DropShadowFilter | pixi-box-shadow |
|---|---|---|
| Blur cost | O(blur × quality) — multi-pass | **O(1)** — single pass |
| Spread | ❌ | ✅ |
| Inset | ❌ | ✅ |
| Border-radius | ❌ | ✅ |
| Multiple shadows | Stack multiple filters | ✅ Single pass (up to 8) |
| CSS string | ❌ | ✅ |

---

## Installation

```bash
npm install pixi-box-shadow
```

> **Requires** `pixi.js >= 8.0.0` as a peer dependency.

---

## Quick Start

### 1. Create a PixiJS element

```typescript
import { Application, Graphics } from 'pixi.js';
import { BoxShadowFilter } from 'pixi-box-shadow';

const app = new Application();
await app.init({ width: 800, height: 600 });
document.body.appendChild(app.canvas);

const box = new Graphics();
box.roundRect(0, 0, 200, 100, 12);
box.fill(0xffffff);
box.x = 300;
box.y = 250;
app.stage.addChild(box);
```

### 2. Add a box-shadow

```typescript
box.filters = [new BoxShadowFilter({
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
  width: 200,
  height: 100,
  borderRadius: 12,
})];
```

That's it. The shadow renders identically to how CSS would render it.

---

## Usage

### CSS String (easiest)

Pass any valid CSS `box-shadow` value:

```typescript
const filter = new BoxShadowFilter({
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
  width: 200,
  height: 100,
  borderRadius: 8,
});
```

### Typed Options (full control)

```typescript
const filter = new BoxShadowFilter({
  shadows: [
    {
      offsetX: 0,
      offsetY: 4,
      blur: 8,
      spread: 0,
      color: 0x000000,
      alpha: 0.3,
      inset: false,
    },
  ],
  width: 200,
  height: 100,
  borderRadius: [10, 10, 0, 0], // per-corner: [TL, TR, BR, BL]
});
```

### Updating at Runtime

```typescript
// Change the shadow
filter.boxShadow = 'inset 0 0 10px rgba(0,0,0,0.5)';

// Change element dimensions
filter.elementWidth = 300;
filter.elementHeight = 150;

// Change border radius
filter.borderRadius = 20;
filter.borderRadius = [0, 16, 16, 0];
```

### Animating Shadows (fast path)

For per-frame animation, write directly to the uniform arrays. This skips all parsing and allocation:

```typescript
// Change shadow color to red at 60% opacity — zero allocations
filter.uniforms.uShadowColor[0] = 1.0;  // r
filter.uniforms.uShadowColor[1] = 0.0;  // g
filter.uniforms.uShadowColor[2] = 0.0;  // b
filter.uniforms.uShadowColor[3] = 0.6;  // a
```

See the **Performance** section below for details on the uniform layout.

---

## What's Supported

Everything CSS `box-shadow` can do:

| Feature | Status | Example |
|---|---|---|
| Offset | ✅ | `4px 4px` |
| Blur | ✅ | `4px 4px 8px` |
| Spread (positive) | ✅ | `0 0 10px 5px` |
| Spread (negative) | ✅ | `0 4px 6px -1px` |
| Inset | ✅ | `inset 0 2px 8px` |
| Multiple shadows | ✅ | `shadow1, shadow2, ...` (up to 8) |
| Uniform border-radius | ✅ | `borderRadius: 16` |
| Per-corner border-radius | ✅ | `borderRadius: [10, 20, 0, 5]` |
| Named colors | ✅ | `black`, `red`, `cornflowerblue` |
| Hex colors | ✅ | `#ff0000`, `#f00` |
| `rgb()` / `rgba()` | ✅ | `rgba(0, 0, 0, 0.5)` |
| `hsl()` / `hsla()` | ✅ | `hsla(0, 100%, 50%, 0.5)` |
| Mixed inset + outer | ✅ | `0 4px 8px black, inset 0 2px 4px black` |

### Important: `width` and `height` are required

Unlike CSS where the browser knows the element size, PixiJS filters don't have access to the element's dimensions. You must pass `width` and `height` so the SDF shader knows where to draw the shadow edges.

```typescript
// These must match your Graphics/Sprite dimensions
new BoxShadowFilter({
  boxShadow: '...',
  width: 200,   // ← must match element width
  height: 100,  // ← must match element height
});
```

---

## API Reference

### `BoxShadowFilter`

The main class. Extends PixiJS `Filter`.

#### Constructor

```typescript
new BoxShadowFilter(options: BoxShadowFilterOptions)
```

| Option | Type | Default | Description |
|---|---|---|---|
| `boxShadow` | `string` | — | CSS `box-shadow` string. If provided, `shadows` is ignored. |
| `shadows` | `(BoxShadowOptions \| string)[]` | `[]` | Array of shadow definitions (objects or individual CSS strings). |
| `width` | `number` | **required** | Element width in pixels. |
| `height` | `number` | **required** | Element height in pixels. |
| `borderRadius` | `number \| [number, number, number, number]` | `0` | Corner radii in pixels. Single number = all corners. Array = `[TL, TR, BR, BL]`. |

#### Properties

| Property | Type | Description |
|---|---|---|
| `boxShadow` | `string` (get/set) | Get or set the CSS box-shadow string. |
| `shadows` | `BoxShadowOptions[]` (get/set) | Get or set the typed shadow definitions. |
| `elementWidth` | `number` (get/set) | Element width. |
| `elementHeight` | `number` (get/set) | Element height. |
| `borderRadius` | `number \| [...]` (get/set) | Border radius. |
| `uniforms` | `object` | Direct access to GPU uniform arrays (for animation). |

### `BoxShadowOptions`

Describes a single shadow layer.

| Property | Type | Default | Description |
|---|---|---|---|
| `offsetX` | `number` | `0` | Horizontal offset in pixels. Positive = right. |
| `offsetY` | `number` | `0` | Vertical offset in pixels. Positive = down. |
| `blur` | `number` | `0` | Blur radius in pixels (must be ≥ 0). |
| `spread` | `number` | `0` | Spread radius. Positive = larger shadow, negative = smaller. |
| `color` | `ColorSource` | `'black'` | Shadow color. Any value PixiJS `Color` accepts. |
| `alpha` | `number` | `1` | Shadow opacity (0 to 1). |
| `inset` | `boolean` | `false` | If true, shadow renders inside the element. |

### `parseBoxShadow(css: string): BoxShadowOptions[]`

Standalone parser. Useful if you need to parse CSS shadow strings without creating a filter.

```typescript
import { parseBoxShadow } from 'pixi-box-shadow';

const shadows = parseBoxShadow('0 4px 8px rgba(0,0,0,0.3), inset 0 0 10px red');
console.log(shadows);
// [
//   { offsetX: 0, offsetY: 4, blur: 8, spread: 0, color: 'rgb(0, 0, 0)', alpha: 0.3, inset: false },
//   { offsetX: 0, offsetY: 0, blur: 10, spread: 0, color: 'red', alpha: 1, inset: true },
// ]
```

### `MAX_SHADOWS`

The maximum number of shadows per filter instance: **8**.

If you need more than 8, stack multiple `BoxShadowFilter` instances. But 8 covers virtually all real-world use cases.

---

## Performance

### Why it's fast

Traditional shadow filters (like DropShadowFilter) work by:
1. Rendering the object to a texture
2. Applying multiple blur passes to that texture
3. Compositing the blurred result

Each blur pass costs GPU time proportional to the blur radius. A 50px blur needs many passes.

**pixi-box-shadow** skips all of this. Instead, the fragment shader computes the shadow value for each pixel **analytically** using the [error function](https://en.wikipedia.org/wiki/Error_function) (`erf`). The cost is the same whether your blur is 1px or 1000px.

### Idle behavior

When nothing changes, the filter has **zero cost**:
- No `requestAnimationFrame` callbacks
- No GPU shader invocations
- PixiJS only re-renders when the scene is dirty

### Animation fast path

For per-frame animation, use direct uniform writes instead of the property setters:

```typescript
// ❌ Slow path — parses CSS string, allocates objects
filter.boxShadow = `0 0 20px rgba(${r}, ${g}, ${b}, 0.6)`;

// ✅ Fast path — writes directly to GPU uniform buffer
filter.uniforms.uShadowColor[0] = r / 255;  // red (0–1)
filter.uniforms.uShadowColor[1] = g / 255;  // green (0–1)
filter.uniforms.uShadowColor[2] = b / 255;  // blue (0–1)
filter.uniforms.uShadowColor[3] = 0.6;      // alpha (0–1)
```

#### Uniform layout reference

| Uniform | Type | Layout |
|---|---|---|
| `uShadowOffsetBlurSpread` | `Float32Array(32)` | Per shadow: `[offsetX, offsetY, blur, spread]` × 8 |
| `uShadowColor` | `Float32Array(32)` | Per shadow: `[r, g, b, a]` × 8 (values 0–1) |
| `uShadowInset` | `Float32Array(8)` | Per shadow: `0.0` = outer, `1.0` = inset |
| `uShadowCount` | `number` | Number of active shadows |
| `uElementSize` | `Float32Array(2)` | `[width, height]` |
| `uBorderRadius` | `Float32Array(4)` | `[TL, TR, BR, BL]` corner radii |

---

## Development

```bash
npm install        # Install dependencies
npm run dev        # Start dev server with test page at localhost:5173
npm run build      # Build library (ESM + CJS)
npm run typecheck  # TypeScript type checking
```

### Test page

The dev server opens a test page with two tabs:

- **Visual** — 16 side-by-side comparisons of CSS vs PixiJS shadows
- **Performance** — Animated benchmarks (color transitions, size transitions) with FPS counters and pause/play controls

### Project structure

```
src/
├── BoxShadowFilter.ts    # Main filter class
├── types.ts              # TypeScript interfaces
├── parser.ts             # CSS box-shadow parser
├── utils.ts              # Color/math helpers
├── index.ts              # Public exports
└── shaders/
    ├── box-shadow.vert   # Vertex shader (GLSL)
    ├── box-shadow.frag   # Fragment shader (GLSL) — the core shadow algorithm
    └── box-shadow.wgsl   # Fragment + vertex shader (WGSL for WebGPU)
```

---

## How It Works (Technical)

> This section is for contributors and curious developers. You don't need to understand this to use the library.

### The problem with blur-based shadows

CSS `box-shadow` is a Gaussian-blurred rectangle. The naive GPU approach is:

1. Render the rectangle to a texture
2. Apply a Gaussian blur (typically as two separable 1D passes)
3. Composite the result

This is O(blur_radius) per pass — large blurs are expensive. The DropShadowFilter uses Kawase blur (a faster approximation), but it's still multi-pass and doesn't support spread or inset.

### Our approach: analytical computation

A Gaussian blur of a 1D box function `[-w, +w]` has a closed-form solution:

```
shadow(x) = 0.5 * [erf((x+w) / (σ√2)) − erf((x−w) / (σ√2))]
```

where `σ = blur_radius / 2` and `erf` is the [error function](https://en.wikipedia.org/wiki/Error_function).

For a 2D rectangle with no rounded corners, the shadow is **separable**: multiply the X and Y integrals. This costs O(1) per pixel — just a few `erf` evaluations regardless of blur size.

### Handling rounded corners

A rounded rectangle is not separable, so we can't just multiply X × Y. Instead, we use the **Signed Distance Field** (SDF) of the rounded rectangle:

1. Compute the SDF using [Inigo Quilez's formula](https://iquilezles.org/articles/distfunctions2d/)
2. Adjust the corner radii for blur: `r_eff = √(r² + 2σ²)` (from [Raph Levien's research](https://raphlinus.github.io/graphics/2020/04/21/blurred-rounded-rects.html))
3. Feed the SDF distance through `gaussianCDF(d, σ)` to get the shadow intensity

This produces a smooth Gaussian-like falloff that closely matches the true analytical convolution.

### The `erf` approximation

GPUs don't have a built-in `erf` function. We use the Abramowitz & Stegun approximation (formula 7.1.26):

```glsl
float erf_approx(float x) {
    float ax = abs(x);
    float t = 1.0 / (1.0 + 0.3275911 * ax);
    float y = 1.0 - (((((1.061405429*t - 1.453152027)*t) + 1.421413741)*t - 0.284496736)*t + 0.254829592) * t * exp(-ax*ax);
    return sign(x) * y;
}
```

Maximum error: ~1.5 × 10⁻⁷. Visually imperceptible.

### Compositing order

CSS specifies a strict paint order for box-shadows:

1. **Outer shadows** — painted behind the element
2. **Element background and content** — the actual rendered pixels
3. **Inset shadows** — painted on top of the background, below content

The shader separates outer and inset shadow accumulation, then composites them in this order. This is why inset shadows are visible even on fully opaque white elements.

### Spread and inset

- **Spread** expands (positive) or contracts (negative) the shadow rectangle before computing the shadow. The corner radii are adjusted proportionally.
- **Inset** inverts the shadow: it computes the shadow of a *shrunk* rectangle and takes `1 - value`, then clips to the element boundary using the SDF.

### References

- [Evan Wallace — Fast Rounded Rectangle Shadows](https://madebyevan.com/shaders/fast-rounded-rectangle-shadows/)
- [Raph Levien — Blurred Rounded Rectangles](https://raphlinus.github.io/graphics/2020/04/21/blurred-rounded-rects.html)
- [Inigo Quilez — 2D SDF Functions](https://iquilezles.org/articles/distfunctions2d/)

---

## Known Limitations

- **`width` and `height` are required** — The filter can't auto-detect element dimensions. You must set them manually and keep them in sync if the element resizes.
- **Max 8 shadows** — The GPU uniform array has a fixed size. This covers virtually all real-world usage. If you need more, use multiple filter instances.
- **No `em`/`rem` unit support** — The parser accepts `px` and bare numbers only. Convert units yourself before passing to the filter.
- **No `border-radius: 50%`** — Percentage-based radii aren't supported. Pass the computed pixel value instead (e.g., `Math.min(width, height) / 2`).

---

## AI-Generated

This project was 100% generated and reviewed by AI (Claude, via [Cursor](https://cursor.com)). Every line of code — the SDF shaders, the CSS parser, the TypeScript API, the test page, and this README — was written by AI and iteratively refined through AI-driven code review and visual testing.

## License

[MIT](./LICENSE)
