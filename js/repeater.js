/* ═══════════════════════════════════════════════
   Tab 1: MP3 Repeater
   ═══════════════════════════════════════════════ */
(function repeaterTab() {
  const uploadArea = document.getElementById('rpt-uploadArea');
  const fileInput  = document.getElementById('rpt-fileInput');
  const fileNameEl = document.getElementById('rpt-fileName');
  const repeatInput = document.getElementById('rpt-repeatCount');
  const processBtn = document.getElementById('rpt-processBtn');
  const progressWrap = document.getElementById('rpt-progressWrap');
  const progressFill = document.getElementById('rpt-progressFill');
  const progressTextEl = document.getElementById('rpt-progressText');
  const resultDiv  = document.getElementById('rpt-result');
  const dlLink     = document.getElementById('rpt-downloadLink');
  const resultInfo = document.getElementById('rpt-resultInfo');
  const audioPreview = document.getElementById('rpt-audioPreview');
  const errorBox   = document.getElementById('rpt-errorBox');

  let selectedFile = null;

  function sp(pct, text) { setProgress(progressFill, progressTextEl, pct, text); }

  uploadArea.addEventListener('click', () => fileInput.click());
  uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('dragover'); });
  uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); });

  function handleFile(file) {
    if (!file.name.toLowerCase().endsWith('.mp3') && file.type !== 'audio/mpeg') {
      showError(errorBox, 'Please select an MP3 file.');
      return;
    }
    selectedFile = file;
    fileNameEl.textContent = file.name + ' (' + formatSize(file.size) + ')';
    uploadArea.classList.add('has-file');
    processBtn.disabled = false;
    processBtn.textContent = 'Create Repeated MP3';
    resultDiv.classList.remove('active');
    hideError(errorBox);
  }

  processBtn.addEventListener('click', async () => {
    if (!selectedFile) return;
    const repeats = parseInt(repeatInput.value, 10);
    if (isNaN(repeats) || repeats < 1 || repeats > 50) {
      showError(errorBox, 'Please enter a repeat count between 1 and 50.');
      return;
    }

    hideError(errorBox);
    processBtn.disabled = true;
    processBtn.textContent = 'Processing...';
    resultDiv.classList.remove('active');
    progressWrap.classList.add('active');
    sp(5, 'Reading file...');

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      sp(15, 'Decoding audio...');

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      audioCtx.close();

      const sampleRate = audioBuffer.sampleRate;
      const numChannels = audioBuffer.numberOfChannels;
      const originalLength = audioBuffer.length;
      const silenceSamples = Math.floor(sampleRate * 0.5);
      const totalLength = originalLength * repeats + silenceSamples * (repeats - 1);

      sp(25, 'Building repeated audio...');

      const channels = [];
      for (let ch = 0; ch < numChannels; ch++) channels.push(audioBuffer.getChannelData(ch));

      const repeatedChannels = [];
      for (let ch = 0; ch < numChannels; ch++) {
        const out = new Float32Array(totalLength);
        let offset = 0;
        for (let r = 0; r < repeats; r++) {
          out.set(channels[ch], offset);
          offset += originalLength;
          if (r < repeats - 1) offset += silenceSamples;
        }
        repeatedChannels.push(out);
      }

      sp(40, 'Encoding to MP3...');

      const mp3Data = await encodeMP3(repeatedChannels, sampleRate, numChannels, totalLength, (ratio) => {
        sp(40 + Math.floor(ratio * 55), 'Encoding to MP3... ' + Math.floor(ratio * 100) + '%');
      });

      sp(95, 'Finalizing...');

      const blob = new Blob(mp3Data, { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const baseName = selectedFile.name.replace(/\.mp3$/i, '');
      const outName = baseName + '_x' + repeats + '.mp3';

      dlLink.href = url;
      dlLink.download = outName;
      audioPreview.src = url;

      const durationSec = totalLength / sampleRate;
      resultInfo.textContent = outName + ' \u2014 ' + formatSize(blob.size) + ' \u2014 ' + Math.floor(durationSec / 60) + 'm ' + Math.floor(durationSec % 60) + 's';

      sp(100, 'Done!');
      resultDiv.classList.add('active');
    } catch (err) {
      console.error(err);
      showError(errorBox, 'Error processing audio: ' + err.message);
    } finally {
      processBtn.disabled = false;
      processBtn.textContent = 'Create Repeated MP3';
      setTimeout(() => progressWrap.classList.remove('active'), 1500);
    }
  });
})();
