// pixi-box-shadow — Alpha Blur Shader (WebGPU / WGSL)
//
// Performs a 1D Gaussian blur on a texture's alpha channel.
// Used in two passes (horizontal + vertical) to produce a
// separable 2D Gaussian blur — matching CSS filter: drop-shadow() quality.
//
// Uses bilinear filtering to halve the number of texture fetches:
// adjacent Gaussian samples are merged into a single lookup at a
// fractional offset, exploiting the GPU's linear interpolation.

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

  // Bilinear sampling: pair adjacent kernel taps (i, i+1) into one
  // texture fetch at a fractional offset. The GPU's linear interpolation
  // returns the weighted average, halving the total number of lookups.
  var i = 1;
  loop {
    if (i > MAX_KERNEL_RADIUS) { break; }
    if (i > radius) { break; }

    let fi = f32(i);
    let w1 = exp(-fi * fi * invTwoSigmaSq);

    if (i + 1 <= radius) {
      let fi1 = f32(i + 1);
      let w2 = exp(-fi1 * fi1 * invTwoSigmaSq);
      let wSum = w1 + w2;
      let offset = (fi * w1 + fi1 * w2) / wSum;

      let uv1 = input.uv + pixelStep * offset;
      let uv2 = input.uv - pixelStep * offset;

      totalAlpha += textureSample(uTexture, uSampler, uv1).a * wSum;
      totalAlpha += textureSample(uTexture, uSampler, uv2).a * wSum;
      totalWeight += 2.0 * wSum;
    } else {
      let uv1 = input.uv + pixelStep * fi;
      let uv2 = input.uv - pixelStep * fi;

      totalAlpha += textureSample(uTexture, uSampler, uv1).a * w1;
      totalAlpha += textureSample(uTexture, uSampler, uv2).a * w1;
      totalWeight += 2.0 * w1;
    }

    i += 2;
  }

  let blurredAlpha = totalAlpha / totalWeight;
  return vec4<f32>(0.0, 0.0, 0.0, blurredAlpha);
}
