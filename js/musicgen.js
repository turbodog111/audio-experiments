/* ═══════════════════════════════════════════════
   AI Music Generator (MusicGen via HF Inference API)
   ─────────────────────────────────────────────
   Uses the Hugging Face Inference API directly
   to call Meta's MusicGen model. Requires a free
   HF API token (get one at huggingface.co/settings/tokens).
   ═══════════════════════════════════════════════ */
(function musicgenModule() {
  const tokenInput     = document.getElementById('mg-token');
  const saveTokenBtn   = document.getElementById('mg-saveToken');
  const tokenStatus    = document.getElementById('mg-tokenStatus');
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

  const STORAGE_KEY = 'mp3master_hf_token';
  const API_BASE = 'https://router.huggingface.co/hf-inference/models/';

  function sp(pct, text) { setProgress(progressFill, progressTextEl, pct, text); }

  function updateStatus(state, text) {
    statusEl.style.display = 'flex';
    statusText.textContent = text;
    statusIcon.className = 'separator-status-icon status-' + state;
  }

  function hideStatus() {
    statusEl.style.display = 'none';
  }

  /* ── Token management ── */

  function getToken() {
    return (tokenInput.value || '').trim() || localStorage.getItem(STORAGE_KEY) || '';
  }

  function refreshTokenUI() {
    var saved = localStorage.getItem(STORAGE_KEY) || '';
    if (saved) {
      tokenInput.value = saved;
      tokenInput.placeholder = 'Token saved';
      tokenStatus.textContent = 'Token saved';
      tokenStatus.style.color = 'var(--accent-green)';
      generateBtn.disabled = false;
      generateBtn.textContent = 'Generate Music';
    } else {
      tokenStatus.textContent = '';
      generateBtn.disabled = true;
      generateBtn.textContent = 'Enter HF token above first';
    }
  }

  saveTokenBtn.addEventListener('click', () => {
    var token = (tokenInput.value || '').trim();
    if (!token) {
      tokenStatus.textContent = 'Please enter a token';
      tokenStatus.style.color = 'var(--accent-primary)';
      return;
    }
    localStorage.setItem(STORAGE_KEY, token);
    tokenStatus.textContent = 'Token saved!';
    tokenStatus.style.color = 'var(--accent-green)';
    generateBtn.disabled = false;
    generateBtn.textContent = 'Generate Music';
  });

  tokenInput.addEventListener('input', () => {
    var token = (tokenInput.value || '').trim();
    if (token) {
      generateBtn.disabled = false;
      generateBtn.textContent = 'Generate Music';
    }
  });

  // Duration slider feedback
  durationRange.addEventListener('input', function() {
    durationVal.textContent = durationRange.value + 's';
  });

  // Init
  refreshTokenUI();

  /* ── Map duration to max_new_tokens ── */
  // MusicGen generates at 50 tokens/sec for the small/medium models
  // and uses a 32kHz sample rate. ~50 tokens = 1 second of audio.
  function durationToTokens(seconds) {
    return Math.round(seconds * 50);
  }

  generateBtn.addEventListener('click', async () => {
    var prompt = (promptInput.value || '').trim();
    if (!prompt) {
      showError(errorBox, 'Please enter a music description.');
      return;
    }

    var token = getToken();
    if (!token) {
      showError(errorBox, 'Please enter your Hugging Face API token above. Get a free one at huggingface.co/settings/tokens');
      return;
    }

    var model = modelSelect.value;
    var duration = parseInt(durationRange.value) || 10;
    var maxTokens = durationToTokens(duration);

    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';
    resultDiv.classList.remove('active');
    hideError(errorBox);
    progressWrap.classList.add('active');

    try {
      updateStatus('connecting', 'Sending request to HF Inference API...');
      sp(10, 'Generating ' + duration + 's of music (this may take 30\u2013120 seconds)...');

      var apiUrl = API_BASE + model;

      var response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_new_tokens: maxTokens,
            do_sample: true,
            guidance_scale: 3
          }
        })
      });

      if (response.status === 401 || response.status === 403) {
        throw new Error('Invalid or expired HF token. Please check your token at huggingface.co/settings/tokens');
      }

      if (response.status === 503) {
        // Model is loading
        updateStatus('connecting', 'Model is loading on HF servers (this can take 1\u20132 minutes)...');
        sp(15, 'Waiting for model to load...');

        // Wait and retry
        await new Promise(r => setTimeout(r, 30000));

        response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            inputs: prompt,
            parameters: {
              max_new_tokens: maxTokens,
              do_sample: true,
              guidance_scale: 3
            }
          })
        });
      }

      if (!response.ok) {
        var errBody = '';
        try { errBody = await response.text(); } catch(_) {}
        throw new Error('HF API returned ' + response.status + ': ' + (errBody || response.statusText));
      }

      updateStatus('downloading', 'Receiving generated audio...');
      sp(80, 'Downloading generated audio...');

      var blob = await response.blob();

      if (blob.size < 1000) {
        // Likely an error response in text form
        var text = await blob.text();
        throw new Error('Unexpected response: ' + text.substring(0, 200));
      }

      var objUrl = URL.createObjectURL(blob);

      // Determine extension from content-type
      var ct = response.headers.get('content-type') || '';
      var ext = '.flac'; // HF Inference API typically returns FLAC
      if (ct.includes('wav')) ext = '.wav';
      else if (ct.includes('mpeg') || ct.includes('mp3')) ext = '.mp3';
      else if (ct.includes('ogg')) ext = '.ogg';

      // Set up preview and download
      audioPreview.src = objUrl;
      var safeName = prompt.substring(0, 40).replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '_');
      var fileName = 'musicgen_' + safeName + ext;
      dlLink.href = objUrl;
      dlLink.download = fileName;

      resultInfo.textContent = fileName + ' \u2014 ' + formatSize(blob.size) +
        ' \u2014 ~' + duration + 's \u2014 Model: ' + model.replace('facebook/musicgen-', '');

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
