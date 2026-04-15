// pixi-box-shadow — SDF / box mode only (shapeMode: 'box')
//
// Dedicated fragment shader: no texture-mode branches, no extra texture bindings.
// Analytical rounded-rect shadow in one pass.

precision highp float;

in vec2 vTextureCoord;
in vec2 vPixelCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputSize;

uniform vec2 uElementSize;
uniform vec4 uBorderRadius;
uniform vec2 uPaddingOffset;

/** scaleX, scaleY, boundsMinX, boundsMinY — map filter pixel to world when uCoordMode is set */
uniform vec4 uFilterToWorld;
/** Linear part of world→local: (a, c, b, d) for local.x = a*wx+c*wy+tx, local.y = b*wx+d*wy+ty */
uniform vec4 uWLinear;
/** (tx, ty, coordMode, _) — coordMode 1 = evaluate SDF in container local space (rotation-safe) */
uniform vec4 uWTrans;
uniform vec2 uLocalRectCenter;

uniform int uShadowCount;
uniform vec4 uShadowOffsetBlurSpread[8];
uniform vec4 uShadowColor[8];
uniform float uShadowInset[8];

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

float sdRoundedBox(vec2 p, vec2 b, vec4 r) {
    vec2 rr = (p.x > 0.0) ? r.yz : r.xw;
    rr.x = (p.y > 0.0) ? rr.y : rr.x;
    float rad = rr.x;
    vec2 q = abs(p) - b + rad;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - rad;
}

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

    vec2 p;
    if (uWTrans.z > 0.5) {
        vec2 world = vPixelCoord * uFilterToWorld.xy + uFilterToWorld.zw;
        vec2 local = vec2(
            dot(uWLinear.xy, world),
            dot(uWLinear.zw, world)
        ) + uWTrans.xy;
        p = local - uLocalRectCenter;
    } else {
        vec2 localPos = vPixelCoord - uPaddingOffset;
        vec2 elementCenter = uElementSize * 0.5;
        p = localPos - elementCenter;
    }
    vec2 halfSize = uElementSize * 0.5;

    float maxR = min(halfSize.x, halfSize.y);
    vec4 baseRadii = min(uBorderRadius, vec4(maxR));

    float elementSDF = sdRoundedBox(p, halfSize, baseRadii);
    float insideElement = 1.0 - smoothstep(-0.5, 0.5, elementSDF);

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

        if (shadowCol.a < 0.001) continue;

        float sigma = blur * 0.5;
        vec2 shadowP = p - offset;
        float shadowValue;

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

    vec4 color = outerResult;
    color = texColor + color * (1.0 - texColor.a);
    color = vec4(
        insetResult.rgb + color.rgb * (1.0 - insetResult.a),
        insetResult.a + color.a * (1.0 - insetResult.a)
    );

    finalColor = color;
}
