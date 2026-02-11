/* ═══════════════════════════════════════════════
   AI Music Generator (MusicGen via Hugging Face)
   ─────────────────────────────────────────────
   Uses the Gradio JS client to call the
   Surn/UnlimitedMusicGen HF Space, which runs
   Meta's MusicGen model on a T4 GPU.
   ═══════════════════════════════════════════════ */
(function musicgenModule() {
  const promptInput    = document.getElementById('mg-prompt');
  const modelSelect    = document.getElementById('mg-model');
  const durationRange  = document.getElementById('mg-duration');
  const durationVal    = document.getElementById('mg-durationVal');
  const generateBtn    = document.getElementById('mg-generateBtn');
  const statusEl       = document.getElementById('mg-status');
  const statusIcon     = document.getElementById('mg-statusIcon');
  const statusText     = document.getElementById('mg-statusText');
  const progressWrap   = document.getElementById('mg-progressWrap');
  const progressFill   = document.getElementById('mg-progressFill');
  const progressTextEl = document.getElementById('mg-progressText');
  const errorBox       = document.getElementById('mg-errorBox');
  const resultDiv      = document.getElementById('mg-result');
  const dlLink         = document.getElementById('mg-downloadLink');
  const resultInfo     = document.getElementById('mg-resultInfo');
  const audioPreview   = document.getElementById('mg-audioPreview');

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

  // Duration slider feedback
  durationRange.addEventListener('input', function() {
    durationVal.textContent = durationRange.value + 's';
  });

  // Gradio client ready
  window.addEventListener('gradio-ready', () => {
    gradioReady = true;
    generateBtn.disabled = false;
    generateBtn.textContent = 'Generate Music';
  });

  // If Gradio was already loaded before this script ran
  if (window._GradioClient) {
    gradioReady = true;
    generateBtn.disabled = false;
    generateBtn.textContent = 'Generate Music';
  }

  /**
   * Extract a usable URL from a Gradio result item.
   */
  function extractUrl(item) {
    if (typeof item === 'string') return item;
    if (item && item.url) return item.url;
    if (item && item.path) return item.path;
    if (item && item.data) return item.data;
    return null;
  }

  generateBtn.addEventListener('click', async () => {
    var prompt = (promptInput.value || '').trim();
    if (!prompt) {
      showError(errorBox, 'Please enter a music description.');
      return;
    }

    if (!gradioReady) {
      showError(errorBox, 'Gradio client not loaded. Ensure you are serving this page over HTTP (not file://).');
      return;
    }

    var GradioClient = window._GradioClient;
    if (!GradioClient) {
      showError(errorBox, 'Gradio client not available.');
      return;
    }

    var model = modelSelect.value;
    var duration = parseInt(durationRange.value) || 10;

    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';
    resultDiv.classList.remove('active');
    hideError(errorBox);
    progressWrap.classList.add('active');

    try {
      // Step 1: Connect
      updateStatus('connecting', 'Connecting to AI service...');
      sp(5, 'Connecting to Hugging Face...');

      var client;
      try {
        client = await GradioClient.connect("Surn/UnlimitedMusicGen");
      } catch (connErr) {
        updateStatus('connecting', 'Waking up AI service (this may take a minute)...');
        sp(10, 'Waiting for AI service to wake up...');
        await new Promise(r => setTimeout(r, 8000));
        client = await GradioClient.connect("Surn/UnlimitedMusicGen");
      }

      // Step 2: Generate
      updateStatus('uploading', 'Generating music with MusicGen AI...');
      sp(20, 'Generating ' + duration + 's of music (this may take 30\u2013120 seconds)...');

      var result = await client.predict("/predict_simple", [
        model,             // model
        prompt,            // text description
        null,              // melody_filepath (no melody conditioning)
        duration,          // duration in seconds
        2,                 // dimension
        200,               // topk
        0.01,              // topp
        1.0,               // temperature
        4.0,               // cfg_coef
        "./assets/background.png",  // background
        "AI Generated",    // title
        "./assets/arial.ttf",       // settings_font
        "#c87f05",         // settings_font_color
        -1,                // seed (-1 for random)
        1,                 // overlap
        -1,                // prompt_index
        false,             // include_title
        false,             // include_settings
        false,             // harmony_only
        "anonymous",       // profile
        30,                // segment_length
        28,                // settings_font_size
        false,             // settings_animate_waveform
        "Landscape",       // video_orientation
        false              // return_history_json
      ]);

      sp(80, 'Receiving generated audio...');

      // Result: [video_path, audio_path, seed_used]
      // Try to extract audio (index 1) first, fallback to video (index 0)
      var audioUrl = null;
      if (result.data && result.data.length > 1) {
        audioUrl = extractUrl(result.data[1]);
      }
      if (!audioUrl && result.data && result.data.length > 0) {
        audioUrl = extractUrl(result.data[0]);
      }

      if (!audioUrl) {
        throw new Error('No audio returned from AI service. The service may be experiencing issues.');
      }

      // Step 3: Download
      updateStatus('downloading', 'Downloading generated audio...');
      sp(85, 'Downloading audio...');

      var response = await fetch(audioUrl);
      var blob = await response.blob();
      var objUrl = URL.createObjectURL(blob);

      // Determine extension
      var ct = response.headers.get('content-type') || '';
      var ext = '.wav';
      if (ct.includes('mpeg') || ct.includes('mp3')) ext = '.mp3';
      else if (ct.includes('flac')) ext = '.flac';
      else if (audioUrl.includes('.mp3')) ext = '.mp3';
      else if (audioUrl.includes('.flac')) ext = '.flac';

      // Set up preview and download
      audioPreview.src = objUrl;
      var safeName = prompt.substring(0, 40).replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '_');
      var fileName = 'musicgen_' + safeName + ext;
      dlLink.href = objUrl;
      dlLink.download = fileName;

      resultInfo.textContent = fileName + ' \u2014 ' + formatSize(blob.size) +
        ' \u2014 ' + duration + 's \u2014 Model: ' + model;

      sp(100, 'Done!');
      updateStatus('done', 'Music generated successfully!');
      resultDiv.classList.add('active');

    } catch (err) {
      console.error('MusicGen error:', err);
      showError(errorBox, 'Music generation failed: ' + err.message);
      updateStatus('error', 'Failed');
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = 'Generate Music';
      setTimeout(() => {
        progressWrap.classList.remove('active');
      }, 2000);
    }
  });
})();
