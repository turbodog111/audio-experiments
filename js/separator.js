/* ═══════════════════════════════════════════════
   Stem Separation (Demucs via Hugging Face)
   ─────────────────────────────────────────────
   Uses the Gradio JS client to call the
   abidlabs/music-separation HF Space.
   The Gradio client is loaded as an ES module
   in index.html and bridged to window globals.
   ═══════════════════════════════════════════════ */
(function separatorModule() {
  const startBtn       = document.getElementById('sep-startBtn');
  const statusEl       = document.getElementById('sep-status');
  const statusIcon     = document.getElementById('sep-statusIcon');
  const statusText     = document.getElementById('sep-statusText');
  const progressWrap   = document.getElementById('sep-progressWrap');
  const progressFill   = document.getElementById('sep-progressFill');
  const progressTextEl = document.getElementById('sep-progressText');
  const errorBox       = document.getElementById('sep-errorBox');
  const resultsEl      = document.getElementById('sep-results');
  const vocalsAudio    = document.getElementById('sep-vocalsAudio');
  const vocalsDownload = document.getElementById('sep-vocalsDownload');
  const instrumentalAudio    = document.getElementById('sep-instrumentalAudio');
  const instrumentalDownload = document.getElementById('sep-instrumentalDownload');

  let currentFile = null;
  let currentFileName = '';
  let gradioReady = false;

  function sp(pct, text) { setProgress(progressFill, progressTextEl, pct, text); }

  function updateStatus(state, text) {
    statusEl.style.display = 'flex';
    statusText.textContent = text;
    statusIcon.className = 'separator-status-icon status-' + state;
  }

  function hideStatus() {
    statusEl.style.display = 'none';
  }

  /**
   * Extract a usable URL from a Gradio result item.
   * The response format can vary between Gradio versions.
   */
  function extractUrl(item) {
    if (typeof item === 'string') return item;
    if (item && item.url) return item.url;
    if (item && item.path) return item.path;
    if (item && item.data) return item.data;
    throw new Error('Unexpected response format from separation service');
  }

  /**
   * Determine a file extension from a fetch response or URL.
   */
  function getExtension(resp, url) {
    const ct = resp.headers.get('content-type') || '';
    if (ct.includes('wav')) return '.wav';
    if (ct.includes('flac')) return '.flac';
    if (ct.includes('mpeg') || ct.includes('mp3')) return '.mp3';
    // Fallback: check url
    if (url.includes('.wav')) return '.wav';
    if (url.includes('.flac')) return '.flac';
    return '.mp3';
  }

  // Listen for the Gradio client becoming available
  window.addEventListener('gradio-ready', () => {
    gradioReady = true;
    if (currentFile) {
      startBtn.disabled = false;
      startBtn.textContent = 'Separate Vocals & Instrumental';
    }
  });

  // Listen for editor file loads
  window.addEventListener('editor-file-loaded', (e) => {
    // Reset previous results
    resultsEl.style.display = 'none';
    hideError(errorBox);
    hideStatus();

    // Multi-track mode: separator only works with a single track
    if (e.detail.multiTrack) {
      currentFile = null;
      currentFileName = '';
      startBtn.disabled = true;
      startBtn.textContent = 'Separator requires single track mode';
      return;
    }

    currentFile = e.detail.file;
    currentFileName = e.detail.fileName;

    if (gradioReady) {
      startBtn.disabled = false;
      startBtn.textContent = 'Separate Vocals & Instrumental';
    } else {
      startBtn.disabled = true;
      startBtn.textContent = 'Loading AI service...';
    }
  });

  startBtn.addEventListener('click', async () => {
    if (!currentFile || !gradioReady) return;

    var GradioClient = window._GradioClient;
    var handleFile = window._GradioHandleFile;

    if (!GradioClient || !handleFile) {
      showError(errorBox, 'Gradio client not loaded. Ensure you are serving this page over HTTP (not file://).');
      return;
    }

    startBtn.disabled = true;
    startBtn.textContent = 'Processing...';
    resultsEl.style.display = 'none';
    hideError(errorBox);
    progressWrap.classList.add('active');

    try {
      // Step 1: Connect
      updateStatus('connecting', 'Connecting to AI service...');
      sp(10, 'Connecting to Hugging Face...');

      var client;
      try {
        client = await GradioClient.connect("abidlabs/music-separation");
      } catch (connErr) {
        updateStatus('connecting', 'Waking up AI service (this may take a minute)...');
        sp(15, 'Waiting for AI service to wake up...');
        // Retry once after a short delay
        await new Promise(r => setTimeout(r, 5000));
        client = await GradioClient.connect("abidlabs/music-separation");
      }

      // Step 2: Upload & Process
      updateStatus('uploading', 'Uploading audio & processing with Demucs AI...');
      sp(30, 'Processing audio (this may take 30\u201390 seconds)...');

      var result = await client.predict("/predict", [
        handleFile(currentFile)
      ]);

      sp(80, 'Receiving results...');

      // Step 3: Handle results
      // result.data contains two items: vocals and instrumental
      var vocalsUrl = extractUrl(result.data[0]);
      var instrumentalUrl = extractUrl(result.data[1]);

      // Fetch both as blobs for local playback and download
      updateStatus('downloading', 'Downloading separated stems...');
      sp(85, 'Downloading stems...');

      var responses = await Promise.all([
        fetch(vocalsUrl),
        fetch(instrumentalUrl)
      ]);

      var vocalsExt = getExtension(responses[0], vocalsUrl);
      var instrumentalExt = getExtension(responses[1], instrumentalUrl);

      var vocalsBlob = await responses[0].blob();
      var instrumentalBlob = await responses[1].blob();

      // Create object URLs
      var vocalsObjUrl = URL.createObjectURL(vocalsBlob);
      var instrumentalObjUrl = URL.createObjectURL(instrumentalBlob);

      // Set up audio players
      vocalsAudio.src = vocalsObjUrl;
      instrumentalAudio.src = instrumentalObjUrl;

      // Set up download links
      var baseName = currentFileName.replace(/\.mp3$/i, '');
      vocalsDownload.href = vocalsObjUrl;
      vocalsDownload.download = baseName + '_vocals' + vocalsExt;
      instrumentalDownload.href = instrumentalObjUrl;
      instrumentalDownload.download = baseName + '_instrumental' + instrumentalExt;

      // Show results
      sp(100, 'Done!');
      updateStatus('done', 'Separation complete!');
      resultsEl.style.display = 'grid';

    } catch (err) {
      console.error('Separation error:', err);
      showError(errorBox, 'Vocal separation failed: ' + err.message);
      updateStatus('error', 'Failed');
    } finally {
      startBtn.disabled = false;
      startBtn.textContent = 'Separate Vocals & Instrumental';
      setTimeout(() => {
        progressWrap.classList.remove('active');
      }, 2000);
    }
  });
})();
