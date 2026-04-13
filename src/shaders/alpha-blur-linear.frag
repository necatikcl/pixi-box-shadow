// pixi-box-shadow — Alpha Blur Fragment Shader (WebGL, linear-optimized)
//
// 1D Gaussian blur on texture alpha using bilinear tap pairing.
// Neighboring taps are merged into one texture fetch on each side,
// cutting fetch count significantly while preserving Gaussian behavior.

precision highp float;

in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputSize;

uniform vec2 uDirection;   // (1,0) horizontal, (0,1) vertical
uniform float uStrength;   // sigma

const int MAX_KERNEL_RADIUS = 64;

void main(void) {
    if (uStrength < 0.001) {
        float a = texture(uTexture, vTextureCoord).a;
        finalColor = vec4(0.0, 0.0, 0.0, a);
        return;
    }

    float sigma = uStrength;
    int radius = int(ceil(sigma * 3.0));
    if (radius > MAX_KERNEL_RADIUS) radius = MAX_KERNEL_RADIUS;

    vec2 pixelStep = uDirection * uInputSize.zw;
    float invTwoSigmaSq = 1.0 / (2.0 * sigma * sigma);

    float totalWeight = 1.0;
    float totalAlpha = texture(uTexture, vTextureCoord).a;

    for (int i = 1; i <= MAX_KERNEL_RADIUS; i += 2) {
        if (i > radius) break;

        // Odd tail: one unpaired tap remains
        if (i == radius) {
            float fi = float(i);
            float w = exp(-(fi * fi) * invTwoSigmaSq);
            vec2 stepVec = pixelStep * fi;
            totalAlpha += texture(uTexture, vTextureCoord + stepVec).a * w;
            totalAlpha += texture(uTexture, vTextureCoord - stepVec).a * w;
            totalWeight += 2.0 * w;
            continue;
        }

        int j = i + 1;
        float fi = float(i);
        float fj = float(j);

        float w0 = exp(-(fi * fi) * invTwoSigmaSq);
        float w1 = exp(-(fj * fj) * invTwoSigmaSq);
        float pairWeight = w0 + w1;
        if (pairWeight < 0.00001) continue;

        // Bilinear offset that matches weighted pair contribution
        float offset = (fi * w0 + fj * w1) / pairWeight;
        vec2 stepVec = pixelStep * offset;

        totalAlpha += texture(uTexture, vTextureCoord + stepVec).a * pairWeight;
        totalAlpha += texture(uTexture, vTextureCoord - stepVec).a * pairWeight;
        totalWeight += 2.0 * pairWeight;
    }

    float blurredAlpha = totalAlpha / totalWeight;
    finalColor = vec4(0.0, 0.0, 0.0, blurredAlpha);
}
