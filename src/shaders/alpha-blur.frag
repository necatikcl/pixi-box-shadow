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

// Maximum kernel radius (one side). Limits GPU loop iterations.
const int MAX_KERNEL_RADIUS = 64;

void main(void) {
    // If sigma is negligible, pass through the alpha unchanged
    if (uStrength < 0.001) {
        float a = texture(uTexture, vTextureCoord).a;
        finalColor = vec4(0.0, 0.0, 0.0, a);
        return;
    }

    float sigma = uStrength;

    // Kernel radius: cover 3 sigma for excellent quality (99.7% of Gaussian energy)
    int radius = int(ceil(sigma * 3.0));
    if (radius > MAX_KERNEL_RADIUS) radius = MAX_KERNEL_RADIUS;

    // Pixel step in texture coordinates for the blur direction
    vec2 pixelStep = uDirection * uInputSize.zw;

    // Compute Gaussian weights and accumulate blurred alpha
    float invTwoSigmaSq = 1.0 / (2.0 * sigma * sigma);

    // Center sample (weight = 1.0)
    float totalWeight = 1.0;
    float totalAlpha = texture(uTexture, vTextureCoord).a;

    // Symmetric samples: tap at +i and -i simultaneously
    for (int i = 1; i <= MAX_KERNEL_RADIUS; i++) {
        if (i > radius) break;

        float offset = float(i);
        float weight = exp(-offset * offset * invTwoSigmaSq);

        vec2 uv1 = vTextureCoord + pixelStep * offset;
        vec2 uv2 = vTextureCoord - pixelStep * offset;

        totalAlpha += texture(uTexture, uv1).a * weight;
        totalAlpha += texture(uTexture, uv2).a * weight;
        totalWeight += 2.0 * weight;
    }

    float blurredAlpha = totalAlpha / totalWeight;
    finalColor = vec4(0.0, 0.0, 0.0, blurredAlpha);
}
