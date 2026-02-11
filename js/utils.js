/* ═══════════════════════════════════════════════
   Shared utilities
   ═══════════════════════════════════════════════ */

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function showError(el, msg) {
  el.textContent = msg;
  el.classList.add('active');
}

function hideError(el) {
  el.classList.remove('active');
}

function setProgress(fillEl, textEl, pct, text) {
  fillEl.style.width = pct + '%';
  textEl.textContent = text;
}

function floatTo16(floatArr) {
  const int16 = new Int16Array(floatArr.length);
  for (let i = 0; i < floatArr.length; i++) {
    let s = floatArr[i];
    s = s < -1 ? -1 : s > 1 ? 1 : s;
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return int16;
}

function encodeWAV(channels, sampleRate, numChannels, totalSamples) {
  var bytesPerSample = 2; // 16-bit PCM
  var dataSize = totalSamples * numChannels * bytesPerSample;
  var buffer = new ArrayBuffer(44 + dataSize);
  var view = new DataView(buffer);

  function writeString(offset, str) {
    for (var i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  // RIFF header
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');

  // fmt sub-chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);           // sub-chunk size
  view.setUint16(20, 1, true);            // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true); // byte rate
  view.setUint16(32, numChannels * bytesPerSample, true);              // block align
  view.setUint16(34, 16, true);           // bits per sample

  // data sub-chunk
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave and write PCM samples
  var offset = 44;
  for (var i = 0; i < totalSamples; i++) {
    for (var ch = 0; ch < numChannels; ch++) {
      var s = channels[ch] ? channels[ch][i] || 0 : 0;
      s = s < -1 ? -1 : s > 1 ? 1 : s;
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function encodeMP3(channels, sampleRate, numChannels, totalSamples, progressCb) {
  return new Promise((resolve) => {
    const kbps = 192;
    const encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, kbps);
    const mp3Chunks = [];
    const chunkSize = 1152;

    let offset = 0;
    const isStereo = numChannels >= 2;

    function processChunk() {
      const end = Math.min(offset + chunkSize * 100, totalSamples);

      while (offset < end) {
        const remaining = totalSamples - offset;
        const len = Math.min(chunkSize, remaining);

        const leftF = channels[0].subarray(offset, offset + len);
        const left = floatTo16(leftF);

        let mp3buf;
        if (isStereo) {
          const rightF = channels[1].subarray(offset, offset + len);
          const right = floatTo16(rightF);
          mp3buf = encoder.encodeBuffer(left, right);
        } else {
          mp3buf = encoder.encodeBuffer(left);
        }

        if (mp3buf.length > 0) {
          mp3Chunks.push(mp3buf);
        }
        offset += len;
      }

      if (progressCb) {
        progressCb(offset / totalSamples);
      }

      if (offset < totalSamples) {
        setTimeout(processChunk, 0);
      } else {
        const flush = encoder.flush();
        if (flush.length > 0) {
          mp3Chunks.push(flush);
        }
        resolve(mp3Chunks);
      }
    }

    processChunk();
  });
}
