# pixi-box-shadow

CSS `box-shadow` for [PixiJS v8](https://pixijs.com/) — pixel-accurate, GPU-accelerated, single-pass.

Write shadows the same way you write CSS. Get the same result on a PixiJS canvas.

```typescript
import { BoxShadowFilter } from 'pixi-box-shadow';

element.filters = [new BoxShadowFilter({
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
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
| Arbitrary shapes | ❌ | ✅ (`shapeMode: 'texture'`) |

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
  borderRadius: 12,
})];
```

That's it. The filter auto-detects the element's size. The shadow renders identically to how CSS would render it.

---

## Usage

### CSS String (easiest)

Pass any valid CSS `box-shadow` value:

```typescript
const filter = new BoxShadowFilter({
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
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
  borderRadius: [10, 10, 0, 0], // per-corner: [TL, TR, BR, BL]
});
```

### Arbitrary Shapes (`shapeMode: 'texture'`)

For non-rectangular elements (circles, stars, sprites, text), use texture mode.
Instead of assuming a rounded rectangle, the shader reads the element's actual alpha channel:

```typescript
// Works with any shape — circles, stars, sprites, text, etc.
circle.filters = [new BoxShadowFilter({
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
  shapeMode: 'texture',
})];
```

Texture mode uses multi-tap Gaussian-weighted sampling. The `quality` option controls the base sample count (automatically scaled up for large blurs):

| Quality | Base samples | Use case |
|---|---|---|
| 1 | 16 | Fast preview, small blur values |
| 2 | 32 | Good balance |
| **3** (default) | **48** | Recommended for most use cases |
| 4 | 64 | High quality, large blurs |
| 5 | 80 | Maximum quality |

```typescript
const filter = new BoxShadowFilter({
  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
  shapeMode: 'texture',
  quality: 4,
});
```

### Updating at Runtime

```typescript
// Change the shadow
filter.boxShadow = 'inset 0 0 10px rgba(0,0,0,0.5)';

// Change border radius
filter.borderRadius = 20;
filter.borderRadius = [0, 16, 16, 0];

// Switch shape mode at runtime
filter.shapeMode = 'texture';
filter.quality = 4;
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
| Arbitrary shapes | ✅ | `shapeMode: 'texture'` |

---

## API Reference

### `BoxShadowFilter`

The main class. Extends PixiJS `Filter`.

#### Constructor

```typescript
new BoxShadowFilter(options?: BoxShadowFilterOptions)
```

| Option | Type | Default | Description |
|---|---|---|---|
| `boxShadow` | `string` | — | CSS `box-shadow` string. If provided, `shadows` is ignored. |
| `shadows` | `(BoxShadowOptions \| string)[]` | `[]` | Array of shadow definitions (objects or individual CSS strings). |
| `borderRadius` | `number \| [number, number, number, number]` | `0` | Corner radii in pixels. Single number = all corners. Array = `[TL, TR, BR, BL]`. Only used in `'box'` mode. |
| `shapeMode` | `'box' \| 'texture'` | `'box'` | `'box'` = analytical SDF (fastest). `'texture'` = alpha-channel sampling (any shape). |
| `quality` | `number` (1–5) | `3` | Base sample count for texture mode. Automatically scaled for large blurs. Ignored in box mode. |

#### Properties

| Property | Type | Description |
|---|---|---|
| `boxShadow` | `string` (get/set) | Get or set the CSS box-shadow string. |
| `shadows` | `BoxShadowOptions[]` (get/set) | Get or set the typed shadow definitions. |
| `elementWidth` | `number` (readonly) | Current detected element width. |
| `elementHeight` | `number` (readonly) | Current detected element height. |
| `borderRadius` | `number \| [...]` (get/set) | Border radius. |
| `shapeMode` | `'box' \| 'texture'` (get/set) | Shadow shape computation mode. |
| `quality` | `number` (get/set) | Texture sampling quality (1–5). |
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

### Shape modes compared

| | Box mode (default) | Texture mode |
|---|---|---|
| **Shape support** | Rounded rectangles only | Any shape |
| **Per-pixel cost** | O(1) — a few `erf` evaluations | O(quality × 16) texture reads (auto-scaled for large blurs) |
| **Best for** | UI panels, cards, buttons | Sprites, icons, text, complex shapes |
| **Blur cost scaling** | None — constant regardless of blur | None — fixed sample budget per quality level |

Both modes are single-pass with no offscreen textures for the shadow itself.

### Why box mode is fast

Traditional shadow filters (like DropShadowFilter) work by:
1. Rendering the object to a texture
2. Applying multiple blur passes to that texture
3. Compositing the blurred result

Each blur pass costs GPU time proportional to the blur radius. A 50px blur needs many passes.

**pixi-box-shadow** in box mode skips all of this. Instead, the fragment shader computes the shadow value for each pixel **analytically** using the [error function](https://en.wikipedia.org/wiki/Error_function) (`erf`). The cost is the same whether your blur is 1px or 1000px.

### Texture mode performance

Texture mode uses a golden-angle spiral disc sampling pattern with Gaussian weighting. The sample count auto-scales with blur size (up to 4x for large blurs, capped at 256 samples) to maintain consistent quality.

Use quality 1–2 for preview / mobile, 3 for desktop, 4–5 for high-fidelity.

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
| `uElementSize` | `Float32Array(2)` | `[width, height]` (auto-detected) |
| `uBorderRadius` | `Float32Array(4)` | `[TL, TR, BR, BL]` corner radii |
| `uShapeMode` | `number` | `0` = box, `1` = texture |
| `uQuality` | `number` | Texture mode sample multiplier (1–5) |

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

- **Visual** — 29 side-by-side comparisons of CSS vs PixiJS shadows, including texture-mode demos for 7 different shapes
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

### Auto-sizing

The filter overrides `apply()` to read the input texture's frame dimensions. Since PixiJS adds `padding` pixels on each side when rendering the element to the filter texture, the element size is:

```
elementWidth  = inputFrame.width  - 2 × padding
elementHeight = inputFrame.height - 2 × padding
```

This is always on — there's no manual size to pass. The input frame is the ground truth for the element's rendered size, so auto-detection is always correct.

### Box mode: analytical computation

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

### Texture mode: alpha-channel sampling

When `shapeMode` is `'texture'`, the shader doesn't assume any geometric shape. Instead, for each shadow it:

1. Offsets the texture coordinate by the shadow's `(offsetX, offsetY)`
2. Samples the element's alpha channel at the center point plus many points in a disc
3. Weights all samples using a Gaussian kernel (`exp(-d²/2σ²)`)
4. Applies spread adjustment via alpha bias/rescale
5. Uses the result as the shadow intensity

The sampling pattern uses a **golden-angle spiral** (`θ = i × 2.39996...`) which distributes points evenly across a disc without clustering. The disc radius extends to 3σ (covering 99.7% of the Gaussian). Sample count automatically scales up to 4x for large blurs (σ > 8px) to maintain consistent quality.

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

- **Spread** expands (positive) or contracts (negative) the shadow rectangle before computing the shadow. The corner radii are adjusted proportionally. In texture mode, spread is approximated via alpha bias/rescale.
- **Inset** inverts the shadow: it computes the shadow of a *shrunk* rectangle and takes `1 - value`, then clips to the element boundary using the SDF.

### References

- [Evan Wallace — Fast Rounded Rectangle Shadows](https://madebyevan.com/shaders/fast-rounded-rectangle-shadows/)
- [Raph Levien — Blurred Rounded Rectangles](https://raphlinus.github.io/graphics/2020/04/21/blurred-rounded-rects.html)
- [Inigo Quilez — 2D SDF Functions](https://iquilezles.org/articles/distfunctions2d/)

---

## Known Limitations

- **Max 8 shadows** — The GPU uniform array has a fixed size. This covers virtually all real-world usage. If you need more, use multiple filter instances.
- **No `em`/`rem` unit support** — The parser accepts `px` and bare numbers only. Convert units yourself before passing to the filter.
- **No `border-radius: 50%`** — Percentage-based radii aren't supported. Pass the computed pixel value instead (e.g., `Math.min(width, height) / 2`).
- **Texture mode spread** — Spread is approximated in texture mode (no geometric model to expand/contract). Results are close but not pixel-identical to box mode spread.

---

## AI-Generated

This project was 100% generated and reviewed by AI (Claude, via [Cursor](https://cursor.com)). Every line of code — the SDF shaders, the CSS parser, the TypeScript API, the test page, and this README — was written by AI and iteratively refined through AI-driven code review and visual testing.

## License

[MIT](./LICENSE)
