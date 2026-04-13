// pixi-box-shadow — Alpha Blur Shader (WebGPU / WGSL)
//
// Performs a 1D Gaussian blur on a texture's alpha channel.
// Used in two passes (horizontal + vertical) to produce a
// separable 2D Gaussian blur — matching CSS filter: drop-shadow() quality.

struct GlobalFilterUniforms {
  uInputSize: vec4<f32>,
  uInputPixel: vec4<f32>,
  uInputClamp: vec4<f32>,
  uOutputFrame: vec4<f32>,
  uGlobalFrame: vec4<f32>,
  uOutputTexture: vec4<f32>,
};

struct AlphaBlurUniforms {
  uDirection: vec2<f32>,
  uStrength: f32,
  uSigmaExtent: f32,
  uSampleStride: f32,
  uMaxRadius: f32,
  uPad: f32,
};

@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var uSampler: sampler;

@group(1) @binding(0) var<uniform> abu: AlphaBlurUniforms;

struct VSOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

fn filterVertexPosition(aPosition: vec2<f32>) -> vec4<f32> {
  var position = aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy;
  position.x = position.x * (2.0 / gfu.uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * gfu.uOutputTexture.z / gfu.uOutputTexture.y) - gfu.uOutputTexture.z;
  return vec4<f32>(position, 0.0, 1.0);
}

fn filterTextureCoord(aPosition: vec2<f32>) -> vec2<f32> {
  return aPosition * (gfu.uOutputFrame.zw * gfu.uInputSize.zw);
}

@vertex
fn mainVertex(@location(0) aPosition: vec2<f32>) -> VSOutput {
  var output: VSOutput;
  output.position = filterVertexPosition(aPosition);
  output.uv = filterTextureCoord(aPosition);
  return output;
}

@fragment
fn mainFragment(input: VSOutput) -> @location(0) vec4<f32> {
  let sigma = abu.uStrength;

  // If sigma is negligible, pass through the alpha unchanged
  if (sigma < 0.001) {
    let a = textureSample(uTexture, uSampler, input.uv).a;
    return vec4<f32>(0.0, 0.0, 0.0, a);
  }

  let radiusF = min(ceil(sigma * abu.uSigmaExtent), abu.uMaxRadius);
  let radius = i32(radiusF);

  // Pixel step in texture coordinates for the blur direction
  let pixelStep = abu.uDirection * gfu.uInputSize.zw;

  // Compute Gaussian weights and accumulate blurred alpha
  let invTwoSigmaSq = 1.0 / (2.0 * sigma * sigma);

  // Center sample (weight = 1.0)
  var totalWeight: f32 = 1.0;
  var totalAlpha: f32 = textureSample(uTexture, uSampler, input.uv).a;

  var off = abu.uSampleStride;
  loop {
    if (off > f32(radius)) { break; }

    let weight = exp(-off * off * invTwoSigmaSq);

    let uv1 = input.uv + pixelStep * off;
    let uv2 = input.uv - pixelStep * off;

    totalAlpha += textureSample(uTexture, uSampler, uv1).a * weight;
    totalAlpha += textureSample(uTexture, uSampler, uv2).a * weight;
    totalWeight += 2.0 * weight;

    off += abu.uSampleStride;
  }

  let blurredAlpha = totalAlpha / totalWeight;
  return vec4<f32>(0.0, 0.0, 0.0, blurredAlpha);
}
