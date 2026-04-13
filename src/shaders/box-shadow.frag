// pixi-box-shadow — GLSL Fragment Shader (WebGL)
//
// Two shape modes:
//   shapeMode 0 ('box')     — analytical SDF rounded-rectangle, O(1) per pixel
//   shapeMode 1 ('texture') — two-pass separable Gaussian blur on alpha channel
//                              (CSS filter: drop-shadow() approach)
//
// In texture mode, the alpha channel is pre-blurred by the two-pass blur
// pipeline in BoxShadowFilter.apply(). This shader reads the pre-blurred
// alpha from the uBlurredAlpha sampler for perfect Gaussian quality.
//
// Compositing order (matches CSS spec):
//   1. Outer shadows — behind the element
//   2. Element texture — the actual rendered content
//   3. Inset shadows — on top of element background, below content
//
// References:
//   - Evan Wallace: https://madebyevan.com/shaders/fast-rounded-rectangle-shadows/
//   - Raph Levien: https://raphlinus.github.io/graphics/2020/04/21/blurred-rounded-rects.html
//   - Inigo Quilez SDF: https://iquilezles.org/articles/distfunctions2d/

precision highp float;

in vec2 vTextureCoord;
in vec2 vPixelCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputSize;

// Pre-blurred alpha texture (texture mode only, set by apply() pipeline)
uniform sampler2D uBlurredAlpha;

uniform vec2 uElementSize;
uniform vec4 uBorderRadius;
uniform vec2 uPaddingOffset;

uniform int uShadowCount;
uniform vec4 uShadowOffsetBlurSpread[8];
uniform vec4 uShadowColor[8];
uniform float uShadowInset[8];

uniform int uShapeMode;   // 0 = box (SDF), 1 = texture (pre-blurred alpha)
uniform int uQuality;     // kept for backward compat (unused in texture mode)
uniform float uMaxSigma;  // sigma used for the blur passes (texture mode)

// ============================================================
// Fast erf approximation (Abramowitz & Stegun 7.1.26)
// ============================================================
float erf_approx(float x) {
    float ax = abs(x);
    float t = 1.0 / (1.0 + 0.3275911 * ax);
    float y = 1.0 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * exp(-ax * ax);
    return sign(x) * y;
}

float gaussianCDF(float x, float sigma) {
    return 0.5 + 0.5 * erf_approx(x * (0.7071067811865476 / sigma));
}

float blurredBox1D(float x, float halfW, float sigma) {
    return gaussianCDF(x + halfW, sigma) - gaussianCDF(x - halfW, sigma);
}

// SDF for rounded rectangle (Inigo Quilez)
float sdRoundedBox(vec2 p, vec2 b, vec4 r) {
    vec2 rr = (p.x > 0.0) ? r.yz : r.xw;
    rr.x = (p.y > 0.0) ? rr.y : rr.x;
    float rad = rr.x;
    vec2 q = abs(p) - b + rad;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - rad;
}

// ============================================================
// Analytical blurred rounded-rectangle shadow (box mode)
// ============================================================
float roundedBoxShadow(vec2 p, vec2 halfSize, float sigma, vec4 radii) {
    if (sigma < 0.001) {
        float d = sdRoundedBox(p, halfSize, radii);
        return 1.0 - smoothstep(-0.5, 0.5, d);
    }

    float maxRadius = max(max(radii.x, radii.y), max(radii.z, radii.w));
    if (maxRadius < 0.5) {
        float xInt = blurredBox1D(p.x, halfSize.x, sigma);
        float yInt = blurredBox1D(p.y, halfSize.y, sigma);
        return xInt * yInt;
    }

    vec4 effRadii = sqrt(radii * radii + 2.0 * sigma * sigma);
    float maxDim = min(halfSize.x, halfSize.y);
    effRadii = min(effRadii, vec4(maxDim));

    float d = sdRoundedBox(p, halfSize, effRadii);
    return 1.0 - gaussianCDF(d, sigma);
}

// ============================================================
// Read pre-blurred alpha with multi-sigma and spread (texture mode)
// ============================================================

// sqrt(2 * PI) ≈ 2.5066
const float SQRT_TWO_PI = 2.5066;

float readBlurredAlpha(vec2 uv, float sigma, float spread) {
    float originalAlpha = texture(uTexture, uv).a;

    if (sigma < 0.5) {
        // No blur needed — use original alpha directly
        // Still apply spread as a hard expand/contract
        if (abs(spread) > 0.5) {
            return clamp(originalAlpha + spread * 0.1, 0.0, 1.0);
        }
        return originalAlpha;
    }

    float blurredAlpha = texture(uBlurredAlpha, uv).a;

    // Multi-sigma interpolation: the blur was done at uMaxSigma but this
    // shadow may need a smaller sigma. Interpolate between original (sharp)
    // and blurred to approximate the correct blur level.
    float t = clamp(sigma / max(uMaxSigma, 0.001), 0.0, 1.0);
    float alpha = mix(originalAlpha, blurredAlpha, t);

    // Apply spread adjustment.
    // The Gaussian CDF gradient at the 50% point is 1/(σ·√(2π)).
    // Shifting the edge by `spread` pixels adds spread·gradient to alpha.
    // Positive spread → expand (add), negative → shrink (subtract).
    if (abs(spread) > 0.5) {
        float effectiveSigma = max(sigma, 1.0);
        float gradient = 1.0 / (effectiveSigma * SQRT_TWO_PI);
        alpha = clamp(alpha + spread * gradient, 0.0, 1.0);
    }

    return alpha;
}

void main(void) {
    vec4 texColor = texture(uTexture, vTextureCoord);

    vec2 localPos = vPixelCoord - uPaddingOffset;
    vec2 elementCenter = uElementSize * 0.5;
    vec2 p = localPos - elementCenter;
    vec2 halfSize = uElementSize * 0.5;

    float maxR = min(halfSize.x, halfSize.y);
    vec4 baseRadii = min(uBorderRadius, vec4(maxR));

    float elementSDF = sdRoundedBox(p, halfSize, baseRadii);
    float insideElement;
    if (uShapeMode == 1) {
        insideElement = texColor.a;
    } else {
        insideElement = 1.0 - smoothstep(-0.5, 0.5, elementSDF);
    }

    vec4 outerResult = vec4(0.0);
    vec4 insetResult = vec4(0.0);

    for (int i = 7; i >= 0; i--) {
        if (i >= uShadowCount) continue;

        vec4 obs = uShadowOffsetBlurSpread[i];
        vec2 offset = obs.xy;
        float blur = obs.z;
        float spread = obs.w;
        vec4 shadowCol = uShadowColor[i];
        float isInset = uShadowInset[i];

        float sigma = blur * 0.5;
        float shadowValue;

        if (uShapeMode == 1) {
            // Texture mode: read pre-blurred alpha
            vec2 offsetUV = offset * uInputSize.zw;
            float sampledAlpha = readBlurredAlpha(
                vTextureCoord - offsetUV,
                sigma,
                isInset > 0.5 ? -spread : spread
            );

            if (isInset > 0.5) {
                // Inset: shadow where blurred alpha (at offset pos) < original alpha.
                // Using subtraction instead of (1-blurred)*inside avoids
                // bright-edge artifacts at antialiased shape boundaries.
                shadowValue = clamp(insideElement - sampledAlpha, 0.0, 1.0);
            } else {
                shadowValue = sampledAlpha;
            }

            vec4 shadow = vec4(shadowCol.rgb * shadowCol.a * shadowValue, shadowCol.a * shadowValue);
            if (isInset > 0.5) {
                insetResult = insetResult + shadow * (1.0 - insetResult.a);
            } else {
                outerResult = outerResult + shadow * (1.0 - outerResult.a);
            }
        } else {
            // Box mode: analytical SDF (unchanged)
            vec2 shadowP = p - offset;

            if (isInset > 0.5) {
                vec2 insetHalf = max(halfSize - spread, vec2(0.001));
                vec4 insetRadii = clamp(baseRadii - spread, vec4(0.0), vec4(min(insetHalf.x, insetHalf.y)));
                float inner = roundedBoxShadow(shadowP, insetHalf, sigma, insetRadii);
                shadowValue = (1.0 - inner) * insideElement;

                vec4 shadow = vec4(shadowCol.rgb * shadowCol.a * shadowValue, shadowCol.a * shadowValue);
                insetResult = insetResult + shadow * (1.0 - insetResult.a);
            } else {
                vec2 outerHalf = max(halfSize + spread, vec2(0.001));
                vec4 outerRadii = clamp(baseRadii + spread, vec4(0.0), vec4(min(outerHalf.x, outerHalf.y)));
                shadowValue = roundedBoxShadow(shadowP, outerHalf, sigma, outerRadii);

                vec4 shadow = vec4(shadowCol.rgb * shadowCol.a * shadowValue, shadowCol.a * shadowValue);
                outerResult = outerResult + shadow * (1.0 - outerResult.a);
            }
        }
    }

    // Composite in CSS order:
    // 1. Start with outer shadows
    vec4 color = outerResult;

    // 2. Layer the original texture on top of outer shadows
    color = texColor + color * (1.0 - texColor.a);

    // 3. Layer inset shadows on top of the texture
    color = vec4(
        insetResult.rgb + color.rgb * (1.0 - insetResult.a),
        insetResult.a + color.a * (1.0 - insetResult.a)
    );

    finalColor = color;
}
