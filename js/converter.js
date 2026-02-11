/* ═══════════════════════════════════════════════
   Tab 4: MP3 / WAV Converter
   ═══════════════════════════════════════════════ */
(function converterTab() {
  var uploadArea   = document.getElementById('cvt-uploadArea');
  var fileInput    = document.getElementById('cvt-fileInput');
  var fileNameEl   = document.getElementById('cvt-fileName');
  var formatInfo   = document.getElementById('cvt-formatInfo');
  var processBtn   = document.getElementById('cvt-processBtn');
  var progressWrap = document.getElementById('cvt-progressWrap');
  var progressFill = document.getElementById('cvt-progressFill');
  var progressTextEl = document.getElementById('cvt-progressText');
  var resultDiv    = document.getElementById('cvt-result');
  var dlLink       = document.getElementById('cvt-downloadLink');
  var resultInfo   = document.getElementById('cvt-resultInfo');
  var audioPreview = document.getElementById('cvt-audioPreview');
  var errorBox     = document.getElementById('cvt-errorBox');

  var selectedFile = null;
  var sourceFormat = null; // 'mp3' or 'wav'

  function sp(pct, text) { setProgress(progressFill, progressTextEl, pct, text); }

  function detectFormat(file) {
    var name = file.name.toLowerCase();
    if (name.endsWith('.wav')) return 'wav';
    if (name.endsWith('.mp3')) return 'mp3';
    var type = file.type.toLowerCase();
    if (type.includes('wav') || type.includes('wave')) return 'wav';
    if (type.includes('mpeg') || type.includes('mp3')) return 'mp3';
    return null;
  }

  uploadArea.addEventListener('click', function() { fileInput.click(); });
  uploadArea.addEventListener('dragover', function(e) { e.preventDefault(); uploadArea.classList.add('dragover'); });
  uploadArea.addEventListener('dragleave', function() { uploadArea.classList.remove('dragover'); });
  uploadArea.addEventListener('drop', function(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', function() {
    if (fileInput.files[0]) handleFile(fileInput.files[0]);
    fileInput.value = '';
  });

  function handleFile(file) {
    hideError(errorBox);
    var fmt = detectFormat(file);
    if (!fmt) {
      showError(errorBox, 'Please select an MP3 or WAV file.');
      return;
    }
    selectedFile = file;
    sourceFormat = fmt;
    fileNameEl.textContent = file.name + ' (' + formatSize(file.size) + ')';
    uploadArea.classList.add('has-file');

    var target = fmt === 'mp3' ? 'WAV' : 'MP3';
    formatInfo.textContent = fmt.toUpperCase() + ' \u2192 ' + target;
    formatInfo.style.display = 'inline-block';

    processBtn.disabled = false;
    processBtn.textContent = 'Convert to ' + target;
    resultDiv.classList.remove('active');
  }

  processBtn.addEventListener('click', async function() {
    if (!selectedFile || !sourceFormat) return;

    hideError(errorBox);
    processBtn.disabled = true;
    processBtn.textContent = 'Converting...';
    resultDiv.classList.remove('active');
    progressWrap.classList.add('active');
    sp(5, 'Reading file...');

    try {
      var arrayBuffer = await selectedFile.arrayBuffer();
      sp(15, 'Decoding audio...');

      var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      var audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      audioCtx.close();

      var sampleRate = audioBuffer.sampleRate;
      var numChannels = audioBuffer.numberOfChannels;
      var totalSamples = audioBuffer.length;

      var channels = [];
      for (var ch = 0; ch < numChannels; ch++) {
        channels.push(audioBuffer.getChannelData(ch));
      }

      var blob, outName, outExt;

      if (sourceFormat === 'mp3') {
        // MP3 → WAV
        sp(30, 'Encoding to WAV...');
        blob = encodeWAV(channels, sampleRate, numChannels, totalSamples);
        outExt = '.wav';
        sp(95, 'Finalizing...');
      } else {
        // WAV → MP3
        sp(30, 'Encoding to MP3...');
        var mp3Data = await encodeMP3(channels, sampleRate, numChannels, totalSamples, function(ratio) {
          sp(30 + Math.floor(ratio * 60), 'Encoding to MP3... ' + Math.floor(ratio * 100) + '%');
        });
        blob = new Blob(mp3Data, { type: 'audio/mpeg' });
        outExt = '.mp3';
        sp(95, 'Finalizing...');
      }

      var baseName = selectedFile.name.replace(/\.(mp3|wav)$/i, '');
      outName = baseName + outExt;

      var url = URL.createObjectURL(blob);
      dlLink.href = url;
      dlLink.download = outName;
      audioPreview.src = url;

      var durationSec = totalSamples / sampleRate;
      var mins = Math.floor(durationSec / 60);
      var secs = Math.floor(durationSec % 60);
      resultInfo.textContent = outName + ' \u2014 ' + formatSize(blob.size) +
        ' \u2014 ' + mins + 'm ' + secs + 's' +
        ' \u2014 ' + sampleRate + ' Hz, ' + numChannels + 'ch';

      sp(100, 'Done!');
      resultDiv.classList.add('active');
    } catch (err) {
      console.error(err);
      showError(errorBox, 'Conversion failed: ' + err.message);
    } finally {
      processBtn.disabled = false;
      var target = sourceFormat === 'mp3' ? 'WAV' : 'MP3';
      processBtn.textContent = 'Convert to ' + target;
      setTimeout(function() { progressWrap.classList.remove('active'); }, 1500);
    }
  });
})();
