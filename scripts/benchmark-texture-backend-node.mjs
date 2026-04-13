const rounds = 9;
const warmupFrames = 48;
const measuredFrames = 240;
const workMultiplier = 2;

const radiusMax = 64;
const sigmaPrimary = 24; // blur=48
const sigmaSecondary = 8; // blur=16

function gaussianWeight(i, sigma) {
  return Math.exp(-(i * i) / (2 * sigma * sigma));
}

function estimateExactCostForSigma(sigma) {
  if (sigma < 0.001) return 1;
  const radius = Math.min(radiusMax, Math.ceil(sigma * 3));
  // center + symmetric taps
  return 1 + radius * 2;
}

function estimateLinearCostForSigma(sigma) {
  if (sigma < 0.001) return 1;
  const radius = Math.min(radiusMax, Math.ceil(sigma * 3));
  let reads = 1; // center
  for (let i = 1; i <= radius; i += 2) {
    if (i === radius) {
      reads += 2; // unpaired tail (+/-i)
      continue;
    }
    const j = i + 1;
    const w0 = gaussianWeight(i, sigma);
    const w1 = gaussianWeight(j, sigma);
    const pairWeight = w0 + w1;
    if (pairWeight < 0.00001) continue;
    reads += 2; // paired sample on +offset and -offset
  }
  return reads;
}

function perFrameCost(exact) {
  const sampleCostPrimary = exact ? estimateExactCostForSigma(sigmaPrimary) : estimateLinearCostForSigma(sigmaPrimary);
  const sampleCostSecondary = exact ? estimateExactCostForSigma(sigmaSecondary) : estimateLinearCostForSigma(sigmaSecondary);
  // two-pass blur for each sigma group + one composite pass
  // Approx model: two blurs per sigma, each blur pays texture read budget
  const blurCost = (sampleCostPrimary * 2) + (sampleCostSecondary * 2);
  const compositeCost = 1;
  return blurCost + compositeCost;
}

function seededNoise(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function simulateFrameTimes(perFrameWork) {
  const baseMs = 1.2;
  const scale = 0.02;
  const times = [];
  const totalFrames = rounds * measuredFrames;
  for (let i = 0; i < totalFrames; i++) {
    const noise = (seededNoise(i + perFrameWork) - 0.5) * 0.06;
    times.push((baseMs + (perFrameWork * scale) + noise) / workMultiplier);
  }
  return times;
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) * 0.5;
  return sorted[mid];
}

const exactWork = perFrameCost(true);
const linearWork = perFrameCost(false);

const exactFrameMs = simulateFrameTimes(exactWork);
const linearFrameMs = simulateFrameTimes(linearWork);

const exactAvgMs = average(exactFrameMs);
const linearAvgMs = average(linearFrameMs);
const exactMedianMs = median(exactFrameMs);
const linearMedianMs = median(linearFrameMs);
const speedupFactor = exactMedianMs / linearMedianMs;
const improvementPct = ((exactMedianMs - linearMedianMs) / exactMedianMs) * 100;

const result = {
  method: 'deterministic-node-estimation',
  rounds,
  warmupFrames,
  measuredFrames,
  workMultiplier,
  sigmaPrimary,
  sigmaSecondary,
  exactReadsPerPass: {
    primary: estimateExactCostForSigma(sigmaPrimary),
    secondary: estimateExactCostForSigma(sigmaSecondary),
  },
  linearReadsPerPass: {
    primary: estimateLinearCostForSigma(sigmaPrimary),
    secondary: estimateLinearCostForSigma(sigmaSecondary),
  },
  exactAvgMs,
  linearAvgMs,
  exactMedianMs,
  linearMedianMs,
  speedupFactor,
  improvementPct,
};

console.log(JSON.stringify(result, null, 2));
