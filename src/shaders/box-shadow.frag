// pixi-box-shadow — GLSL Fragment Shader (WebGL)
//
// This shader computes CSS box-shadow analytically using:
//   1. SDF (Signed Distance Field) of a rounded rectangle
//   2. Gaussian CDF (via the error function) for smooth blur falloff
//
// It runs in a SINGLE PASS with O(1) cost per pixel regardless of blur radius.
// No multi-pass blur, no offscreen textures for the shadow itself.
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

// Element geometry (set from TypeScript)
uniform vec2 uElementSize;          // width, height in pixels
uniform vec4 uBorderRadius;         // corner radii: [TL, TR, BR, BL]
uniform vec2 uPaddingOffset;        // filter padding (extends render area for outer shadows)

// Shadow data — up to 8 shadows packed into uniform arrays
uniform int uShadowCount;
uniform vec4 uShadowOffsetBlurSpread[8]; // per shadow: [offsetX, offsetY, blurRadius, spreadRadius]
uniform vec4 uShadowColor[8];            // per shadow: [r, g, b, a] in 0–1 range
uniform float uShadowInset[8];           // per shadow: 0.0 = outer, 1.0 = inset

// ============================================================
// Fast erf approximation (Abramowitz & Stegun 7.1.26)
// ============================================================
float erf_approx(float x) {
    float ax = abs(x);
    float t = 1.0 / (1.0 + 0.3275911 * ax);
    float y = 1.0 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * exp(-ax * ax);
    return sign(x) * y;
}

// Gaussian CDF: integral of Gaussian from -inf to x
float gaussianCDF(float x, float sigma) {
    return 0.5 + 0.5 * erf_approx(x * (0.7071067811865476 / sigma));
}

// Blurred 1D box: Gaussian convolved with box [-halfW, halfW]
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
// Analytical blurred rounded-rectangle shadow
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

void main(void) {
    vec4 texColor = texture(uTexture, vTextureCoord);

    vec2 localPos = vPixelCoord - uPaddingOffset;
    vec2 elementCenter = uElementSize * 0.5;
    vec2 p = localPos - elementCenter;
    vec2 halfSize = uElementSize * 0.5;

    float maxR = min(halfSize.x, halfSize.y);
    vec4 baseRadii = min(uBorderRadius, vec4(maxR));

    // Element mask for inset shadows
    float elementSDF = sdRoundedBox(p, halfSize, baseRadii);
    float insideElement = 1.0 - smoothstep(-0.5, 0.5, elementSDF);

    // CSS compositing order:
    //   1. Outer shadows (behind element)
    //   2. Element background + content (the texture)
    //   3. Inset shadows (on top of element, blended over it)
    //
    // We must separate outer and inset shadows because they composite
    // at different layers in the stack.

    vec4 outerResult = vec4(0.0);
    vec4 insetResult = vec4(0.0);

    // Accumulate shadows back-to-front within each category
    for (int i = 7; i >= 0; i--) {
        if (i >= uShadowCount) continue;

        vec4 obs = uShadowOffsetBlurSpread[i];
        vec2 offset = obs.xy;
        float blur = obs.z;
        float spread = obs.w;
        vec4 shadowCol = uShadowColor[i];
        float isInset = uShadowInset[i];

        float sigma = blur * 0.5;
        vec2 shadowP = p - offset;
        float shadowValue;

        if (isInset > 0.5) {
            // INSET: shadow inside the element
            vec2 insetHalf = max(halfSize - spread, vec2(0.001));
            vec4 insetRadii = clamp(baseRadii - spread, vec4(0.0), vec4(min(insetHalf.x, insetHalf.y)));
            float inner = roundedBoxShadow(shadowP, insetHalf, sigma, insetRadii);
            // Shadow appears where we're inside the element but outside the shrunk rect
            shadowValue = (1.0 - inner) * insideElement;

            vec4 shadow = vec4(shadowCol.rgb * shadowCol.a * shadowValue, shadowCol.a * shadowValue);
            insetResult = insetResult + shadow * (1.0 - insetResult.a);
        } else {
            // OUTER: shadow outside the element
            vec2 outerHalf = max(halfSize + spread, vec2(0.001));
            vec4 outerRadii = clamp(baseRadii + spread, vec4(0.0), vec4(min(outerHalf.x, outerHalf.y)));
            shadowValue = roundedBoxShadow(shadowP, outerHalf, sigma, outerRadii);

            vec4 shadow = vec4(shadowCol.rgb * shadowCol.a * shadowValue, shadowCol.a * shadowValue);
            outerResult = outerResult + shadow * (1.0 - outerResult.a);
        }
    }

    // Composite in CSS order:
    // 1. Start with outer shadows
    vec4 color = outerResult;

    // 2. Layer the original texture on top of outer shadows
    color = texColor + color * (1.0 - texColor.a);

    // 3. Layer inset shadows on top of the texture
    //    Standard "source over" blending
    color = vec4(
        insetResult.rgb + color.rgb * (1.0 - insetResult.a),
        insetResult.a + color.a * (1.0 - insetResult.a)
    );

    finalColor = color;
}
