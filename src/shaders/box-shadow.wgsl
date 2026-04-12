struct GlobalFilterUniforms {
  uInputSize: vec4<f32>,
  uInputPixel: vec4<f32>,
  uInputClamp: vec4<f32>,
  uOutputFrame: vec4<f32>,
  uGlobalFrame: vec4<f32>,
  uOutputTexture: vec4<f32>,
};

struct BoxShadowUniforms {
  uElementSize: vec2<f32>,
  uPaddingOffset: vec2<f32>,
  uBorderRadius: vec4<f32>,
  uShadowCount: i32,
  uShapeMode: i32,
  uQuality: i32,
  _pad0: i32,
  uShadowOffsetBlurSpread: array<vec4<f32>, 8>,
  uShadowColor: array<vec4<f32>, 8>,
  uShadowInset: array<vec4<f32>, 2>,
};

@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var uSampler: sampler;
@group(1) @binding(0) var<uniform> bsu: BoxShadowUniforms;

struct VSOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) pixelCoord: vec2<f32>,
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
  output.pixelCoord = aPosition * gfu.uOutputFrame.zw;
  return output;
}

fn erf_approx(x: f32) -> f32 {
  let ax = abs(x);
  let t = 1.0 / (1.0 + 0.3275911 * ax);
  let y = 1.0 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * exp(-ax * ax);
  return sign(x) * y;
}

fn gaussianCDF(x: f32, sigma: f32) -> f32 {
  return 0.5 + 0.5 * erf_approx(x * (0.7071067811865476 / sigma));
}

fn blurredBox1D(x: f32, halfW: f32, sigma: f32) -> f32 {
  return gaussianCDF(x + halfW, sigma) - gaussianCDF(x - halfW, sigma);
}

fn sdRoundedBox(p: vec2<f32>, b: vec2<f32>, r: vec4<f32>) -> f32 {
  var rr = select(r.xw, r.yz, p.x > 0.0);
  rr.x = select(rr.x, rr.y, p.y > 0.0);
  let rad = rr.x;
  let q = abs(p) - b + rad;
  return min(max(q.x, q.y), 0.0) + length(max(q, vec2<f32>(0.0))) - rad;
}

fn roundedBoxShadow(p: vec2<f32>, halfSize: vec2<f32>, sigma: f32, radii: vec4<f32>) -> f32 {
  if (sigma < 0.001) {
    let d = sdRoundedBox(p, halfSize, radii);
    return 1.0 - smoothstep(-0.5, 0.5, d);
  }

  let maxRadius = max(max(radii.x, radii.y), max(radii.z, radii.w));
  if (maxRadius < 0.5) {
    let xInt = blurredBox1D(p.x, halfSize.x, sigma);
    let yInt = blurredBox1D(p.y, halfSize.y, sigma);
    return xInt * yInt;
  }

  let effRadii = sqrt(radii * radii + 2.0 * sigma * sigma);
  let maxDim = min(halfSize.x, halfSize.y);
  let clampedRadii = min(effRadii, vec4<f32>(maxDim));
  let d = sdRoundedBox(p, halfSize, clampedRadii);
  return 1.0 - gaussianCDF(d, sigma);
}

fn getShadowInset(index: i32) -> f32 {
  let vecIndex = index / 4;
  let compIndex = index % 4;
  let v = bsu.uShadowInset[vecIndex];
  if (compIndex == 0) { return v.x; }
  if (compIndex == 1) { return v.y; }
  if (compIndex == 2) { return v.z; }
  return v.w;
}

const GOLDEN_ANGLE: f32 = 2.39996322973;

fn sampleAlphaDisc(uv: vec2<f32>, sigma: f32, spread: f32) -> f32 {
  if (sigma < 0.5 && abs(spread) < 0.5) {
    return textureSample(uTexture, uSampler, uv).a;
  }

  let effectiveSigma = max(sigma, 0.5);

  let baseSamples = bsu.uQuality * 16;
  let sigmaScale = clamp(effectiveSigma / 8.0, 1.0, 4.0);
  var sampleCount = i32(f32(baseSamples) * sigmaScale);
  sampleCount = min(sampleCount, 256);

  var totalWeight: f32 = 0.0;
  var totalAlpha: f32 = 0.0;
  let invSigma2 = 1.0 / (2.0 * effectiveSigma * effectiveSigma);
  let maxR = effectiveSigma * 3.0;

  let centerAlpha = textureSample(uTexture, uSampler, uv).a;
  let centerW: f32 = 1.0;
  totalAlpha += centerAlpha * centerW;
  totalWeight += centerW;

  for (var i = 0; i < 256; i++) {
    if (i >= sampleCount) { break; }
    let fi = f32(i) + 1.0;
    let r = maxR * sqrt(fi / f32(sampleCount + 1));
    let theta = fi * GOLDEN_ANGLE;
    let off = vec2<f32>(cos(theta), sin(theta)) * r;

    let sampleUV = uv + off * gfu.uInputSize.zw;
    let w = exp(-dot(off, off) * invSigma2);
    totalAlpha += textureSample(uTexture, uSampler, sampleUV).a * w;
    totalWeight += w;
  }

  var blurred = totalAlpha / max(totalWeight, 0.001);

  if (abs(spread) > 0.5) {
    let bias = -spread / (effectiveSigma * 2.0 + 1.0);
    let scale = 1.0 + abs(spread) / (effectiveSigma + 1.0);
    blurred = clamp((blurred - 0.5 + bias) * scale + 0.5, 0.0, 1.0);
  }

  return blurred;
}

@fragment
fn mainFragment(input: VSOutput) -> @location(0) vec4<f32> {
  let texColor = textureSample(uTexture, uSampler, input.uv);

  let localPos = input.pixelCoord - bsu.uPaddingOffset;
  let elementCenter = bsu.uElementSize * 0.5;
  let p = localPos - elementCenter;
  let halfSize = bsu.uElementSize * 0.5;

  let maxR = min(halfSize.x, halfSize.y);
  let baseRadii = min(bsu.uBorderRadius, vec4<f32>(maxR));

  let elementSDF = sdRoundedBox(p, halfSize, baseRadii);
  var insideElement: f32;
  if (bsu.uShapeMode == 1) {
    insideElement = texColor.a;
  } else {
    insideElement = 1.0 - smoothstep(-0.5, 0.5, elementSDF);
  }

  var outerResult = vec4<f32>(0.0);
  var insetResult = vec4<f32>(0.0);

  for (var i = 7; i >= 0; i--) {
    if (i >= bsu.uShadowCount) { continue; }

    let obs = bsu.uShadowOffsetBlurSpread[i];
    let offset = obs.xy;
    let blur = obs.z;
    let spread = obs.w;
    let shadowCol = bsu.uShadowColor[i];
    let isInset = getShadowInset(i);

    let sigma = blur * 0.5;

    var shadowValue: f32;

    if (bsu.uShapeMode == 1) {
      let offsetUV = offset * gfu.uInputSize.zw;
      var spreadArg: f32;
      if (isInset > 0.5) {
        spreadArg = -spread;
      } else {
        spreadArg = spread;
      }
      let sampledAlpha = sampleAlphaDisc(input.uv - offsetUV, sigma, spreadArg);

      if (isInset > 0.5) {
        shadowValue = (1.0 - sampledAlpha) * insideElement;
      } else {
        shadowValue = sampledAlpha;
      }

      let shadow = vec4<f32>(shadowCol.rgb * shadowCol.a * shadowValue, shadowCol.a * shadowValue);
      if (isInset > 0.5) {
        insetResult = insetResult + shadow * (1.0 - insetResult.a);
      } else {
        outerResult = outerResult + shadow * (1.0 - outerResult.a);
      }
    } else {
      let shadowP = p - offset;

      if (isInset > 0.5) {
        let insetHalf = max(halfSize - spread, vec2<f32>(0.001));
        let insetRadii = clamp(baseRadii - spread, vec4<f32>(0.0), vec4<f32>(min(insetHalf.x, insetHalf.y)));
        let inner = roundedBoxShadow(shadowP, insetHalf, sigma, insetRadii);
        shadowValue = (1.0 - inner) * insideElement;

        let shadow = vec4<f32>(shadowCol.rgb * shadowCol.a * shadowValue, shadowCol.a * shadowValue);
        insetResult = insetResult + shadow * (1.0 - insetResult.a);
      } else {
        let outerHalf = max(halfSize + spread, vec2<f32>(0.001));
        let outerRadii = clamp(baseRadii + spread, vec4<f32>(0.0), vec4<f32>(min(outerHalf.x, outerHalf.y)));
        shadowValue = roundedBoxShadow(shadowP, outerHalf, sigma, outerRadii);

        let shadow = vec4<f32>(shadowCol.rgb * shadowCol.a * shadowValue, shadowCol.a * shadowValue);
        outerResult = outerResult + shadow * (1.0 - outerResult.a);
      }
    }
  }

  // Composite in CSS order:
  // 1. Outer shadows
  var color = outerResult;
  // 2. Texture on top
  color = texColor + color * (1.0 - texColor.a);
  // 3. Inset shadows on top of texture
  color = vec4<f32>(
    insetResult.rgb + color.rgb * (1.0 - insetResult.a),
    insetResult.a + color.a * (1.0 - insetResult.a)
  );

  return color;
}
