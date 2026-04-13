// pixi-box-shadow — Alpha Blur Fragment Shader (WebGL)
//
// Performs a 1D Gaussian blur on a texture's alpha channel.
// Used in two passes (horizontal + vertical) to produce a
// separable 2D Gaussian blur — matching CSS filter: drop-shadow() quality.
//
// Uses bilinear filtering to halve the number of texture fetches:
// adjacent Gaussian samples are merged into a single lookup at a
// fractional offset, exploiting the GPU's linear interpolation.

precision highp float;

in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputSize;

uniform vec2 uDirection;   // (1,0) for horizontal, (0,1) for vertical
uniform float uStrength;   // sigma of the Gaussian

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

    // Bilinear sampling: pair adjacent kernel taps (i, i+1) into one
    // texture fetch at a fractional offset. The GPU's linear interpolation
    // returns the weighted average, halving the total number of lookups.
    for (int i = 1; i <= MAX_KERNEL_RADIUS; i += 2) {
        if (i > radius) break;

        float w1 = exp(-float(i) * float(i) * invTwoSigmaSq);

        if (i + 1 <= radius) {
            float w2 = exp(-float(i + 1) * float(i + 1) * invTwoSigmaSq);
            float wSum = w1 + w2;
            float offset = (float(i) * w1 + float(i + 1) * w2) / wSum;

            vec2 uv1 = vTextureCoord + pixelStep * offset;
            vec2 uv2 = vTextureCoord - pixelStep * offset;

            totalAlpha += texture(uTexture, uv1).a * wSum;
            totalAlpha += texture(uTexture, uv2).a * wSum;
            totalWeight += 2.0 * wSum;
        } else {
            float offset = float(i);

            vec2 uv1 = vTextureCoord + pixelStep * offset;
            vec2 uv2 = vTextureCoord - pixelStep * offset;

            totalAlpha += texture(uTexture, uv1).a * w1;
            totalAlpha += texture(uTexture, uv2).a * w1;
            totalWeight += 2.0 * w1;
        }
    }

    float blurredAlpha = totalAlpha / totalWeight;
    finalColor = vec4(0.0, 0.0, 0.0, blurredAlpha);
}
