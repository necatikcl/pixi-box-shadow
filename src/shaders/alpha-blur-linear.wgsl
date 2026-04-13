// pixi-box-shadow — Alpha Blur Shader (WebGPU / WGSL, linear-optimized)
//
// 1D Gaussian blur on texture alpha using bilinear tap pairing.
// Neighboring taps are merged into one texture fetch on each side.

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

const MAX_KERNEL_RADIUS: i32 = 64;

@fragment
fn mainFragment(input: VSOutput) -> @location(0) vec4<f32> {
  let sigma = abu.uStrength;

  if (sigma < 0.001) {
    let a = textureSample(uTexture, uSampler, input.uv).a;
    return vec4<f32>(0.0, 0.0, 0.0, a);
  }

  var radius = i32(ceil(sigma * 3.0));
  if (radius > MAX_KERNEL_RADIUS) {
    radius = MAX_KERNEL_RADIUS;
  }

  let pixelStep = abu.uDirection * gfu.uInputSize.zw;
  let invTwoSigmaSq = 1.0 / (2.0 * sigma * sigma);

  var totalWeight: f32 = 1.0;
  var totalAlpha: f32 = textureSample(uTexture, uSampler, input.uv).a;

  for (var i = 1; i <= MAX_KERNEL_RADIUS; i += 2) {
    if (i > radius) { break; }

    // Odd tail: one unpaired tap remains
    if (i == radius) {
      let fi = f32(i);
      let w = exp(-(fi * fi) * invTwoSigmaSq);
      let stepVec = pixelStep * fi;
      totalAlpha += textureSample(uTexture, uSampler, input.uv + stepVec).a * w;
      totalAlpha += textureSample(uTexture, uSampler, input.uv - stepVec).a * w;
      totalWeight += 2.0 * w;
      continue;
    }

    let j = i + 1;
    let fi = f32(i);
    let fj = f32(j);

    let w0 = exp(-(fi * fi) * invTwoSigmaSq);
    let w1 = exp(-(fj * fj) * invTwoSigmaSq);
    let pairWeight = w0 + w1;
    if (pairWeight < 0.00001) { continue; }

    // Bilinear offset that matches weighted pair contribution
    let offset = (fi * w0 + fj * w1) / pairWeight;
    let stepVec = pixelStep * offset;

    totalAlpha += textureSample(uTexture, uSampler, input.uv + stepVec).a * pairWeight;
    totalAlpha += textureSample(uTexture, uSampler, input.uv - stepVec).a * pairWeight;
    totalWeight += 2.0 * pairWeight;
  }

  let blurredAlpha = totalAlpha / totalWeight;
  return vec4<f32>(0.0, 0.0, 0.0, blurredAlpha);
}
