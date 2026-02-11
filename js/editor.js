/* ═══════════════════════════════════════════════
   Tab 3: MP3 Editor
   ═══════════════════════════════════════════════ */
(function editorTab() {
  const uploadArea  = document.getElementById('ed-uploadArea');
  const fileInput   = document.getElementById('ed-fileInput');
  const fileNameEl  = document.getElementById('ed-fileName');
  const errorBox    = document.getElementById('ed-errorBox');
  const gdriveBtn   = document.getElementById('ed-gdriveBtn');
  const gdriveNotice = document.getElementById('ed-gdriveNotice');
  const workspace   = document.getElementById('ed-workspace');
  const canvas      = document.getElementById('ed-canvas');
  const ctx         = canvas.getContext('2d');
  const waveformWrap = document.getElementById('ed-waveformWrap');
  const overlayLeft  = document.getElementById('ed-overlayLeft');
  const overlayRight = document.getElementById('ed-overlayRight');
  const handleLeft   = document.getElementById('ed-handleLeft');
  const handleRight  = document.getElementById('ed-handleRight');
  const playhead     = document.getElementById('ed-playhead');
  const trimStartEl  = document.getElementById('ed-trimStart');
  const trimEndEl    = document.getElementById('ed-trimEnd');
  const trimDurEl    = document.getElementById('ed-trimDuration');
  const playToggle   = document.getElementById('ed-playToggle');
  const resetBtn     = document.getElementById('ed-resetBtn');
  const fadeToggle   = document.getElementById('ed-fadeToggle');
  const fadeControls = document.getElementById('ed-fadeControls');
  const fadeInRange  = document.getElementById('ed-fadeIn');
  const fadeOutRange = document.getElementById('ed-fadeOut');
  const fadeInVal    = document.getElementById('ed-fadeInVal');
  const fadeOutVal   = document.getElementById('ed-fadeOutVal');
  const exportBtn    = document.getElementById('ed-exportBtn');
  const progressWrap = document.getElementById('ed-progressWrap');
  const progressFill = document.getElementById('ed-progressFill');
  const progressTextEl = document.getElementById('ed-progressText');
  const resultDiv    = document.getElementById('ed-result');
  const dlLink       = document.getElementById('ed-downloadLink');
  const resultInfo   = document.getElementById('ed-resultInfo');
  const audioPreview = document.getElementById('ed-audioPreview');

  let audioBuffer = null;
  let sampleRate = 44100;
  let duration = 0;
  let fileName = '';

  // Trim state: ratio 0..1 within the full track
  let trimStartRatio = 0;
  let trimEndRatio = 1;

  // Playback state
  let isPlaying = false;
  let playCtx = null;
  let playSource = null;
  let playStartTime = 0;
  let playStartOffset = 0;
  let playAnimId = null;

  function sp(pct, text) { setProgress(progressFill, progressTextEl, pct, text); }

  showGdriveSetupNotice(gdriveNotice);

  /* ── File upload ── */
  uploadArea.addEventListener('click', () => fileInput.click());
  uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('dragover'); });
  uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', () => { if (fileInput.files[0]) loadFile(fileInput.files[0]); });

  gdriveBtn.addEventListener('click', async () => {
    try {
      gdriveBtn.disabled = true;
      gdriveBtn.textContent = 'Opening Drive...';
      const results = await openDrivePicker(false);
      if (results.length > 0) {
        const { name, blob } = results[0];
        loadFile(new File([blob], name, { type: 'audio/mpeg' }));
      }
    } catch (err) {
      showError(errorBox, 'Google Drive import failed: ' + err.message);
    } finally {
      gdriveBtn.disabled = false;
      gdriveBtn.textContent = 'Import from Google Drive';
    }
  });

  async function loadFile(file) {
    if (!file.name.toLowerCase().endsWith('.mp3') && file.type !== 'audio/mpeg') {
      showError(errorBox, 'Please select an MP3 file.');
      return;
    }
    hideError(errorBox);
    fileName = file.name;
    fileNameEl.textContent = file.name + ' (' + formatSize(file.size) + ')';
    uploadArea.classList.add('has-file');

    try {
      const arrayBuf = await file.arrayBuffer();
      const actx = new (window.AudioContext || window.webkitAudioContext)();
      audioBuffer = await actx.decodeAudioData(arrayBuf);
      actx.close();

      sampleRate = audioBuffer.sampleRate;
      duration = audioBuffer.duration;

      trimStartRatio = 0;
      trimEndRatio = 1;

      workspace.classList.add('active');
      resultDiv.classList.remove('active');

      drawWaveform();
      updateTrimUI();

      // Notify separator module that a file was loaded
      window.dispatchEvent(new CustomEvent('editor-file-loaded', {
        detail: { file: file, audioBuffer: audioBuffer, fileName: fileName }
      }));
    } catch (err) {
      console.error(err);
      showError(errorBox, 'Failed to decode audio: ' + err.message);
    }
  }

  /* ── Waveform drawing ── */
  function drawWaveform() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const mid = h / 2;
    const data = audioBuffer.getChannelData(0);
    const step = Math.max(1, Math.floor(data.length / w));

    // Get fade settings to visualize on waveform
    const fadeInSec = parseFloat(fadeInRange.value) || 0;
    const fadeOutSec = parseFloat(fadeOutRange.value) || 0;
    const trimStartSec = trimStartRatio * duration;
    const trimEndSec = trimEndRatio * duration;
    const selectionLen = trimEndSec - trimStartSec;

    ctx.clearRect(0, 0, w, h);

    // Draw center line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(w, mid);
    ctx.stroke();

    // Draw waveform with fade effect applied visually
    for (let x = 0; x < w; x++) {
      const start = Math.floor(x * data.length / w);
      let min = 0, max = 0;
      for (let j = 0; j < step; j++) {
        const val = data[start + j] || 0;
        if (val < min) min = val;
        if (val > max) max = val;
      }

      // Calculate fade multiplier for this pixel position
      const timeSec = (x / w) * duration;
      let fadeMult = 1;
      if (timeSec >= trimStartSec && timeSec <= trimEndSec) {
        const posInSelection = timeSec - trimStartSec;
        // Fade in
        if (fadeInSec > 0 && posInSelection < fadeInSec) {
          fadeMult = posInSelection / fadeInSec;
        }
        // Fade out
        if (fadeOutSec > 0 && posInSelection > selectionLen - fadeOutSec) {
          fadeMult = Math.min(fadeMult, (selectionLen - posInSelection) / fadeOutSec);
        }
      }

      // Apply fade multiplier to waveform amplitude visually
      const scaledMin = min * fadeMult;
      const scaledMax = max * fadeMult;

      const top = mid + scaledMin * mid;
      const bottom = mid + scaledMax * mid;

      // Color: dimmer in faded areas
      const alpha = 0.3 + 0.7 * fadeMult;
      ctx.fillStyle = 'rgba(233, 69, 96, ' + alpha.toFixed(2) + ')';
      ctx.fillRect(x, top, 1, bottom - top || 1);
    }

    // Time markers at bottom
    ctx.fillStyle = '#4a4a5e';
    ctx.font = '10px Inter, sans-serif';
    const numMarkers = Math.min(10, Math.floor(duration));
    if (numMarkers > 0) {
      const interval = duration / numMarkers;
      for (let i = 0; i <= numMarkers; i++) {
        const t = i * interval;
        const x = (t / duration) * w;
        ctx.fillRect(x, h - 12, 1, 4);
        ctx.fillText(fmtTime(t), x + 2, h - 2);
      }
    }
  }

  /* ── Time formatting ── */
  function fmtTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ':' + s.toFixed(1).padStart(4, '0');
  }

  /* ── Trim handle dragging ── */
  function updateTrimUI() {
    const w = waveformWrap.getBoundingClientRect().width;

    overlayLeft.style.width = (trimStartRatio * 100) + '%';
    overlayRight.style.width = ((1 - trimEndRatio) * 100) + '%';

    handleLeft.style.left = (trimStartRatio * 100) + '%';
    handleRight.style.left = (trimEndRatio * 100) + '%';

    const startSec = trimStartRatio * duration;
    const endSec = trimEndRatio * duration;
    trimStartEl.textContent = fmtTime(startSec);
    trimEndEl.textContent = fmtTime(endSec);
    trimDurEl.textContent = fmtTime(endSec - startSec);
  }

  function startDrag(handle, isLeft) {
    const onMove = (e) => {
      e.preventDefault();
      const rect = waveformWrap.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      let ratio = (clientX - rect.left) / rect.width;
      ratio = Math.max(0, Math.min(1, ratio));

      if (isLeft) {
        trimStartRatio = Math.min(ratio, trimEndRatio - 0.005);
      } else {
        trimEndRatio = Math.max(ratio, trimStartRatio + 0.005);
      }
      updateTrimUI();
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);
  }

  handleLeft.addEventListener('mousedown', (e) => { e.preventDefault(); startDrag(handleLeft, true); });
  handleLeft.addEventListener('touchstart', (e) => { e.preventDefault(); startDrag(handleLeft, true); }, { passive: false });
  handleRight.addEventListener('mousedown', (e) => { e.preventDefault(); startDrag(handleRight, false); });
  handleRight.addEventListener('touchstart', (e) => { e.preventDefault(); startDrag(handleRight, false); }, { passive: false });

  // Click on waveform to set playhead position
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    // If clicked outside trim range, move nearest handle
    if (ratio < trimStartRatio) {
      trimStartRatio = Math.max(0, ratio);
      updateTrimUI();
    } else if (ratio > trimEndRatio) {
      trimEndRatio = Math.min(1, ratio);
      updateTrimUI();
    }
  });

  /* ── Reset trim ── */
  resetBtn.addEventListener('click', () => {
    trimStartRatio = 0;
    trimEndRatio = 1;
    updateTrimUI();
  });

  /* ── Fade toggle ── */
  fadeToggle.addEventListener('click', () => {
    fadeToggle.classList.toggle('active-effect');
    fadeControls.classList.toggle('active');
  });

  fadeInRange.addEventListener('input', () => {
    fadeInVal.textContent = parseFloat(fadeInRange.value).toFixed(1) + 's';
    if (audioBuffer) drawWaveform();
  });
  fadeOutRange.addEventListener('input', () => {
    fadeOutVal.textContent = parseFloat(fadeOutRange.value).toFixed(1) + 's';
    if (audioBuffer) drawWaveform();
  });

  /* ── Playback ── */
  function stopPlayback() {
    if (playSource) {
      try { playSource.stop(); } catch (_) {}
      playSource = null;
    }
    if (playCtx) {
      playCtx.close();
      playCtx = null;
    }
    if (playAnimId) {
      cancelAnimationFrame(playAnimId);
      playAnimId = null;
    }
    playhead.classList.remove('active');
    isPlaying = false;
    playToggle.textContent = 'Play (Space)';
  }

  function startPlayback() {
    if (!audioBuffer) return;
    stopPlayback();

    playCtx = new (window.AudioContext || window.webkitAudioContext)();

    const startSample = Math.floor(trimStartRatio * audioBuffer.length);
    const endSample = Math.floor(trimEndRatio * audioBuffer.length);
    const len = endSample - startSample;
    if (len <= 0) return;

    // Create a buffer with just the trimmed region (with fades applied for preview)
    const numCh = audioBuffer.numberOfChannels;
    const previewBuf = playCtx.createBuffer(numCh, len, audioBuffer.sampleRate);

    const fadeInSec = parseFloat(fadeInRange.value) || 0;
    const fadeOutSec = parseFloat(fadeOutRange.value) || 0;
    const fadeInSamples = Math.floor(fadeInSec * audioBuffer.sampleRate);
    const fadeOutSamples = Math.floor(fadeOutSec * audioBuffer.sampleRate);

    for (let ch = 0; ch < numCh; ch++) {
      const src = audioBuffer.getChannelData(ch);
      const dst = previewBuf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        let sample = src[startSample + i];
        // Fade in
        if (i < fadeInSamples) {
          sample *= i / fadeInSamples;
        }
        // Fade out
        if (i >= len - fadeOutSamples) {
          sample *= (len - i) / fadeOutSamples;
        }
        dst[i] = sample;
      }
    }

    playSource = playCtx.createBufferSource();
    playSource.buffer = previewBuf;
    playSource.connect(playCtx.destination);
    playSource.start();

    isPlaying = true;
    playToggle.textContent = 'Stop (Space)';

    playStartTime = playCtx.currentTime;
    playStartOffset = trimStartRatio;
    const selectionDuration = (trimEndRatio - trimStartRatio) * duration;

    playhead.classList.add('active');

    function animatePlayhead() {
      if (!playCtx) return;
      const elapsed = playCtx.currentTime - playStartTime;
      if (elapsed >= selectionDuration) {
        stopPlayback();
        return;
      }
      const ratio = playStartOffset + (elapsed / duration);
      playhead.style.left = (ratio * 100) + '%';
      playAnimId = requestAnimationFrame(animatePlayhead);
    }
    animatePlayhead();

    playSource.onended = () => stopPlayback();
  }

  function togglePlayback() {
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  }

  playToggle.addEventListener('click', togglePlayback);

  // Spacebar to toggle play/stop
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !e.repeat) {
      // Don't intercept spacebar when focused on input/button/select elements
      const tag = document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return;
      // Only respond when the editor tab is active
      if (!document.getElementById('tab-editor').classList.contains('active')) return;
      if (!audioBuffer) return;
      e.preventDefault();
      togglePlayback();
    }
  });

  /* ── Export ── */
  exportBtn.addEventListener('click', async () => {
    if (!audioBuffer) return;

    hideError(errorBox);
    exportBtn.disabled = true;
    exportBtn.textContent = 'Exporting...';
    resultDiv.classList.remove('active');
    progressWrap.classList.add('active');
    sp(5, 'Preparing audio...');

    try {
      const startSample = Math.floor(trimStartRatio * audioBuffer.length);
      const endSample = Math.floor(trimEndRatio * audioBuffer.length);
      const len = endSample - startSample;
      const numCh = audioBuffer.numberOfChannels;

      const fadeInSec = parseFloat(fadeInRange.value) || 0;
      const fadeOutSec = parseFloat(fadeOutRange.value) || 0;
      const fadeInSamples = Math.floor(fadeInSec * sampleRate);
      const fadeOutSamples = Math.floor(fadeOutSec * sampleRate);

      sp(15, 'Applying effects...');

      const channels = [];
      for (let ch = 0; ch < numCh; ch++) {
        const src = audioBuffer.getChannelData(ch);
        const dst = new Float32Array(len);
        for (let i = 0; i < len; i++) {
          let sample = src[startSample + i];
          if (i < fadeInSamples) {
            sample *= i / fadeInSamples;
          }
          if (i >= len - fadeOutSamples) {
            sample *= (len - i) / fadeOutSamples;
          }
          dst[i] = sample;
        }
        channels.push(dst);
      }

      sp(30, 'Encoding to MP3...');

      const mp3Data = await encodeMP3(channels, sampleRate, numCh, len, (ratio) => {
        sp(30 + Math.floor(ratio * 65), 'Encoding to MP3... ' + Math.floor(ratio * 100) + '%');
      });

      sp(96, 'Finalizing...');

      const blob = new Blob(mp3Data, { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const baseName = fileName.replace(/\.mp3$/i, '');
      const outName = baseName + '_edited.mp3';

      dlLink.href = url;
      dlLink.download = outName;
      audioPreview.src = url;

      const durationSec = len / sampleRate;
      const mins = Math.floor(durationSec / 60);
      const secs = Math.floor(durationSec % 60);
      resultInfo.textContent = outName + ' \u2014 ' + formatSize(blob.size) + ' \u2014 ' + mins + 'm ' + secs + 's';

      sp(100, 'Done!');
      resultDiv.classList.add('active');
    } catch (err) {
      console.error(err);
      showError(errorBox, 'Export failed: ' + err.message);
    } finally {
      exportBtn.disabled = false;
      exportBtn.textContent = 'Export Edited MP3';
      setTimeout(() => progressWrap.classList.remove('active'), 1500);
    }
  });

  /* ── Redraw on resize ── */
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (audioBuffer) {
        drawWaveform();
        updateTrimUI();
      }
    }, 150);
  });
})();
