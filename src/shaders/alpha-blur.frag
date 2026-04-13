// pixi-box-shadow — Alpha Blur Fragment Shader (WebGL)
//
// Performs a 1D Gaussian blur on a texture's alpha channel.
// Used in two passes (horizontal + vertical) to produce a
// separable 2D Gaussian blur — matching CSS filter: drop-shadow() quality.
//
// The direction uniform controls whether this is a horizontal or vertical pass.
// Output is vec4(0, 0, 0, blurredAlpha) — only alpha matters for shadow generation.

precision highp float;

in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputSize;

uniform vec2 uDirection;   // (1,0) for horizontal, (0,1) for vertical
uniform float uStrength;   // sigma of the Gaussian
uniform float uSigmaExtent;   // radius = ceil(sigma * uSigmaExtent), capped by uMaxRadius
uniform float uSampleStride;  // sample every N pixels (1 or 2)
uniform float uMaxRadius;     // max kernel radius per side (pixels)

void main(void) {
    // If sigma is negligible, pass through the alpha unchanged
    if (uStrength < 0.001) {
        float a = texture(uTexture, vTextureCoord).a;
        finalColor = vec4(0.0, 0.0, 0.0, a);
        return;
    }

    float sigma = uStrength;

    float radiusF = min(ceil(sigma * uSigmaExtent), uMaxRadius);
    int radius = int(radiusF);

    // Pixel step in texture coordinates for the blur direction
    vec2 pixelStep = uDirection * uInputSize.zw;

    // Compute Gaussian weights and accumulate blurred alpha
    float invTwoSigmaSq = 1.0 / (2.0 * sigma * sigma);

    // Center sample (weight = 1.0)
    float totalWeight = 1.0;
    float totalAlpha = texture(uTexture, vTextureCoord).a;

    // Symmetric samples: tap at ±off for off = stride, 2*stride, … ≤ radius
    for (float off = uSampleStride; off <= float(radius) + 1e-4; off += uSampleStride) {
        float weight = exp(-off * off * invTwoSigmaSq);

        vec2 uv1 = vTextureCoord + pixelStep * off;
        vec2 uv2 = vTextureCoord - pixelStep * off;

        totalAlpha += texture(uTexture, uv1).a * weight;
        totalAlpha += texture(uTexture, uv2).a * weight;
        totalWeight += 2.0 * weight;
    }

    float blurredAlpha = totalAlpha / totalWeight;
    finalColor = vec4(0.0, 0.0, 0.0, blurredAlpha);
}
