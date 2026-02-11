/* ═══════════════════════════════════════════════
   Audio Analyzer — BPM & Key Detection
   ─────────────────────────────────────────────
   Pure JavaScript implementation using decoded
   AudioBuffer data. No external dependencies.
   ═══════════════════════════════════════════════ */

/**
 * Analyze an AudioBuffer and return BPM, key, and other metadata.
 * @param {AudioBuffer} buffer - Decoded audio buffer
 * @returns {{ bpm: number, key: string, scale: string, keyFull: string }}
 */
function analyzeAudio(buffer) {
  var mono = getMono(buffer);
  var sampleRate = buffer.sampleRate;

  var bpm = detectBPM(mono, sampleRate);
  var keyResult = detectKey(mono, sampleRate);

  return {
    bpm: bpm,
    key: keyResult.key,
    scale: keyResult.scale,
    keyFull: keyResult.key + ' ' + keyResult.scale
  };
}

/* ═══════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════ */

function getMono(buffer) {
  if (buffer.numberOfChannels === 1) return buffer.getChannelData(0);
  var left = buffer.getChannelData(0);
  var right = buffer.getChannelData(1);
  var mono = new Float32Array(left.length);
  for (var i = 0; i < left.length; i++) {
    mono[i] = (left[i] + right[i]) * 0.5;
  }
  return mono;
}

/* ═══════════════════════════════════════════════
   BPM Detection
   ─────────────────────────────────────────────
   1. Downsample to ~11kHz for efficiency
   2. Compute onset strength envelope using
      spectral flux (energy differences in bands)
   3. Autocorrelate the envelope
   4. Find strongest peak in 60-200 BPM range
   ═══════════════════════════════════════════════ */

function detectBPM(mono, sampleRate) {
  // Downsample for efficiency
  var dsRate = 11025;
  var dsRatio = Math.round(sampleRate / dsRate);
  var dsLength = Math.floor(mono.length / dsRatio);
  var ds = new Float32Array(dsLength);
  for (var i = 0; i < dsLength; i++) {
    ds[i] = mono[i * dsRatio];
  }
  var effectiveRate = sampleRate / dsRatio;

  // Compute onset envelope using energy in windowed frames
  var frameSize = 1024;
  var hopSize = 512;
  var numFrames = Math.floor((ds.length - frameSize) / hopSize);
  if (numFrames < 4) return 120; // fallback

  var envelope = new Float32Array(numFrames);

  // Compute energy per frame
  for (var f = 0; f < numFrames; f++) {
    var start = f * hopSize;
    var energy = 0;
    for (var j = 0; j < frameSize; j++) {
      var val = ds[start + j] || 0;
      energy += val * val;
    }
    envelope[f] = Math.sqrt(energy / frameSize);
  }

  // Half-wave rectified first derivative (onset strength)
  var onset = new Float32Array(numFrames);
  for (var f = 1; f < numFrames; f++) {
    var diff = envelope[f] - envelope[f - 1];
    onset[f] = diff > 0 ? diff : 0;
  }

  // Normalize onset
  var maxOnset = 0;
  for (var f = 0; f < numFrames; f++) {
    if (onset[f] > maxOnset) maxOnset = onset[f];
  }
  if (maxOnset > 0) {
    for (var f = 0; f < numFrames; f++) onset[f] /= maxOnset;
  }

  // Autocorrelation of onset envelope
  var minBPM = 60;
  var maxBPM = 200;
  var framesPerSec = effectiveRate / hopSize;
  var minLag = Math.floor(framesPerSec * 60 / maxBPM);
  var maxLag = Math.ceil(framesPerSec * 60 / minBPM);
  maxLag = Math.min(maxLag, numFrames - 1);

  if (minLag >= maxLag) return 120;

  var bestLag = minLag;
  var bestCorr = -1;

  for (var lag = minLag; lag <= maxLag; lag++) {
    var corr = 0;
    var count = numFrames - lag;
    for (var f = 0; f < count; f++) {
      corr += onset[f] * onset[f + lag];
    }
    corr /= count;

    // Weight towards common tempos (slight preference for 100-140 BPM range)
    var bpmAtLag = (framesPerSec * 60) / lag;
    var weight = 1.0;
    if (bpmAtLag >= 100 && bpmAtLag <= 140) weight = 1.15;
    else if (bpmAtLag >= 80 && bpmAtLag <= 160) weight = 1.05;

    corr *= weight;

    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  var bpm = (framesPerSec * 60) / bestLag;

  // Refine: check if double or half tempo is more plausible
  var halfLag = bestLag * 2;
  var doubleLag = Math.round(bestLag / 2);

  if (doubleLag >= minLag && doubleLag <= maxLag) {
    var doubleCorr = 0;
    var count = numFrames - doubleLag;
    for (var f = 0; f < count; f++) {
      doubleCorr += onset[f] * onset[f + doubleLag];
    }
    doubleCorr /= count;
    // If double-tempo correlation is nearly as strong, prefer it if bpm < 90
    if (bpm < 90 && doubleCorr > bestCorr * 0.8) {
      bpm = bpm * 2;
    }
  }

  if (halfLag <= maxLag) {
    var halfCorr = 0;
    var count = numFrames - halfLag;
    if (count > 0) {
      for (var f = 0; f < count; f++) {
        halfCorr += onset[f] * onset[f + halfLag];
      }
      halfCorr /= count;
      // If half-tempo correlation is strong and bpm > 170, prefer half
      if (bpm > 170 && halfCorr > bestCorr * 0.7) {
        bpm = bpm / 2;
      }
    }
  }

  return Math.round(bpm);
}

/* ═══════════════════════════════════════════════
   Key Detection
   ─────────────────────────────────────────────
   1. Compute short-time FFT in overlapping frames
   2. Map frequency bins to 12 pitch classes
   3. Accumulate chromagram (pitch class profile)
   4. Correlate against Krumhansl-Kessler profiles
   5. Return best matching key + scale
   ═══════════════════════════════════════════════ */

var NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Krumhansl-Kessler key profiles (cognitive experiments)
var MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
var MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function detectKey(mono, sampleRate) {
  // Compute chromagram
  var chroma = computeChromagram(mono, sampleRate);

  // Normalize chroma
  var chromaSum = 0;
  for (var i = 0; i < 12; i++) chromaSum += chroma[i];
  if (chromaSum > 0) {
    for (var i = 0; i < 12; i++) chroma[i] /= chromaSum;
  }

  // Correlate against all 24 keys (12 major + 12 minor)
  var bestKey = 0;
  var bestScale = 'major';
  var bestCorr = -Infinity;

  for (var k = 0; k < 12; k++) {
    // Rotate profile to match key
    var majorCorr = pearsonCorrelation(chroma, rotateProfile(MAJOR_PROFILE, k));
    var minorCorr = pearsonCorrelation(chroma, rotateProfile(MINOR_PROFILE, k));

    if (majorCorr > bestCorr) {
      bestCorr = majorCorr;
      bestKey = k;
      bestScale = 'major';
    }
    if (minorCorr > bestCorr) {
      bestCorr = minorCorr;
      bestKey = k;
      bestScale = 'minor';
    }
  }

  return { key: NOTE_NAMES[bestKey], scale: bestScale };
}

function computeChromagram(mono, sampleRate) {
  var chroma = new Float32Array(12);
  var fftSize = 8192;
  var hopSize = 4096;
  var numFrames = Math.floor((mono.length - fftSize) / hopSize);
  if (numFrames < 1) numFrames = 1;

  // Hann window
  var window = new Float32Array(fftSize);
  for (var i = 0; i < fftSize; i++) {
    window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (fftSize - 1)));
  }

  // Process each frame
  for (var f = 0; f < numFrames; f++) {
    var start = f * hopSize;

    // Apply window and compute DFT magnitude spectrum
    var real = new Float32Array(fftSize);
    var imag = new Float32Array(fftSize);
    for (var i = 0; i < fftSize; i++) {
      real[i] = (mono[start + i] || 0) * window[i];
    }

    // FFT (Cooley-Tukey radix-2)
    fft(real, imag);

    // Map frequency bins to pitch classes
    var halfN = fftSize / 2;
    for (var bin = 1; bin < halfN; bin++) {
      var freq = bin * sampleRate / fftSize;
      if (freq < 65 || freq > 2000) continue; // C2 to B6 range

      var magnitude = Math.sqrt(real[bin] * real[bin] + imag[bin] * imag[bin]);

      // Convert frequency to MIDI note, then to pitch class
      var midi = 12 * Math.log2(freq / 440) + 69;
      var pitchClass = Math.round(midi) % 12;
      if (pitchClass < 0) pitchClass += 12;

      chroma[pitchClass] += magnitude * magnitude; // Use energy (squared magnitude)
    }
  }

  return chroma;
}

/**
 * In-place Cooley-Tukey radix-2 FFT.
 * real and imag arrays must have length that is a power of 2.
 */
function fft(real, imag) {
  var n = real.length;

  // Bit-reversal permutation
  for (var i = 1, j = 0; i < n; i++) {
    var bit = n >> 1;
    while (j & bit) {
      j ^= bit;
      bit >>= 1;
    }
    j ^= bit;
    if (i < j) {
      var tmpR = real[i]; real[i] = real[j]; real[j] = tmpR;
      var tmpI = imag[i]; imag[i] = imag[j]; imag[j] = tmpI;
    }
  }

  // Butterfly operations
  for (var len = 2; len <= n; len *= 2) {
    var halfLen = len / 2;
    var angle = -2 * Math.PI / len;
    var wR = Math.cos(angle);
    var wI = Math.sin(angle);

    for (var i = 0; i < n; i += len) {
      var curR = 1, curI = 0;
      for (var j = 0; j < halfLen; j++) {
        var uR = real[i + j];
        var uI = imag[i + j];
        var vR = real[i + j + halfLen] * curR - imag[i + j + halfLen] * curI;
        var vI = real[i + j + halfLen] * curI + imag[i + j + halfLen] * curR;

        real[i + j] = uR + vR;
        imag[i + j] = uI + vI;
        real[i + j + halfLen] = uR - vR;
        imag[i + j + halfLen] = uI - vI;

        var newCurR = curR * wR - curI * wI;
        curI = curR * wI + curI * wR;
        curR = newCurR;
      }
    }
  }
}

function rotateProfile(profile, shift) {
  var rotated = new Float32Array(12);
  for (var i = 0; i < 12; i++) {
    rotated[i] = profile[(i - shift + 12) % 12];
  }
  return rotated;
}

function pearsonCorrelation(a, b) {
  var n = a.length;
  var sumA = 0, sumB = 0;
  for (var i = 0; i < n; i++) { sumA += a[i]; sumB += b[i]; }
  var meanA = sumA / n;
  var meanB = sumB / n;

  var num = 0, denA = 0, denB = 0;
  for (var i = 0; i < n; i++) {
    var da = a[i] - meanA;
    var db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }

  var den = Math.sqrt(denA * denB);
  return den === 0 ? 0 : num / den;
}
