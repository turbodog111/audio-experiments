/* ═══════════════════════════════════════════════
   Tab 2: Set List Creator
   ═══════════════════════════════════════════════ */
(function setListTab() {
  const uploadArea  = document.getElementById('sl-uploadArea');
  const fileInput   = document.getElementById('sl-fileInput');
  const fileStatus  = document.getElementById('sl-fileStatus');
  const fileListDiv = document.getElementById('sl-fileList');
  const fileListUl  = document.getElementById('sl-fileListItems');
  const songCountIn = document.getElementById('sl-songCount');
  const buildBtn    = document.getElementById('sl-buildSlotsBtn');
  const slotsDiv    = document.getElementById('sl-slots');
  const processBtn  = document.getElementById('sl-processBtn');
  const progressWrap = document.getElementById('sl-progressWrap');
  const progressFill = document.getElementById('sl-progressFill');
  const progressTextEl = document.getElementById('sl-progressText');
  const resultDiv   = document.getElementById('sl-result');
  const dlLink      = document.getElementById('sl-downloadLink');
  const resultInfo  = document.getElementById('sl-resultInfo');
  const audioPreview = document.getElementById('sl-audioPreview');
  const errorBox    = document.getElementById('sl-errorBox');

  let uploadedSongs = new Map();

  function sp(pct, text) { setProgress(progressFill, progressTextEl, pct, text); }

  /* ── File upload handling ── */
  uploadArea.addEventListener('click', () => fileInput.click());
  uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('dragover'); });
  uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
  });
  fileInput.addEventListener('change', () => handleFiles(fileInput.files));

  function handleFiles(files) {
    let added = 0;
    for (const file of files) {
      if (file.name.toLowerCase().endsWith('.mp3') || file.type === 'audio/mpeg') {
        uploadedSongs.set(file.name, file);
        added++;
      }
    }
    if (added === 0) {
      showError(errorBox, 'No MP3 files found in selection.');
      return;
    }
    hideError(errorBox);
    refreshFileList();
    refreshSlotDropdowns();
    uploadArea.classList.add('has-file');
    fileStatus.textContent = uploadedSongs.size + ' song' + (uploadedSongs.size !== 1 ? 's' : '') + ' loaded';
    updateProcessBtnState();
  }

  function refreshFileList() {
    fileListUl.innerHTML = '';
    if (uploadedSongs.size === 0) {
      fileListDiv.style.display = 'none';
      return;
    }
    fileListDiv.style.display = 'block';
    for (const [name, file] of uploadedSongs) {
      const li = document.createElement('li');

      const span = document.createElement('span');
      span.textContent = name + ' (' + formatSize(file.size) + ')';
      li.appendChild(span);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-btn';
      removeBtn.textContent = '\u00d7';
      removeBtn.title = 'Remove';
      removeBtn.addEventListener('click', () => {
        uploadedSongs.delete(name);
        refreshFileList();
        refreshSlotDropdowns();
        fileStatus.textContent = uploadedSongs.size + ' song' + (uploadedSongs.size !== 1 ? 's' : '') + ' loaded';
        if (uploadedSongs.size === 0) {
          uploadArea.classList.remove('has-file');
          fileStatus.textContent = '';
        }
        updateProcessBtnState();
      });
      li.appendChild(removeBtn);
      fileListUl.appendChild(li);
    }
  }

  /* ── Slot management ── */
  function buildSlots() {
    const count = parseInt(songCountIn.value, 10);
    if (isNaN(count) || count < 1 || count > 100) {
      showError(errorBox, 'Enter a set list size between 1 and 100.');
      return;
    }
    hideError(errorBox);

    const existing = [];
    slotsDiv.querySelectorAll('select').forEach(sel => existing.push(sel.value));

    slotsDiv.innerHTML = '';
    const names = [...uploadedSongs.keys()];

    for (let i = 0; i < count; i++) {
      const slot = document.createElement('div');
      slot.className = 'slot';

      const num = document.createElement('span');
      num.className = 'slot-number';
      num.textContent = (i + 1) + '.';
      slot.appendChild(num);

      const select = document.createElement('select');
      select.dataset.slot = i;

      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = '\u2014 choose a song \u2014';
      select.appendChild(placeholder);

      names.forEach((name) => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name.replace(/\.mp3$/i, '');
        select.appendChild(opt);
      });

      if (existing[i] && uploadedSongs.has(existing[i])) {
        select.value = existing[i];
      } else if (names[i]) {
        select.value = names[i];
      }

      slot.appendChild(select);
      slotsDiv.appendChild(slot);
    }
    updateProcessBtnState();
  }

  function refreshSlotDropdowns() {
    const names = [...uploadedSongs.keys()];
    slotsDiv.querySelectorAll('select').forEach((select) => {
      const current = select.value;
      while (select.options.length > 1) select.remove(1);

      names.forEach((name) => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name.replace(/\.mp3$/i, '');
        select.appendChild(opt);
      });

      if (uploadedSongs.has(current)) {
        select.value = current;
      } else {
        select.value = '';
      }
    });
    updateProcessBtnState();
  }

  buildBtn.addEventListener('click', buildSlots);
  songCountIn.addEventListener('change', buildSlots);

  buildSlots();

  function updateProcessBtnState() {
    const selects = slotsDiv.querySelectorAll('select');
    const allFilled = selects.length > 0 && [...selects].every(s => s.value !== '');
    const hasSongs = uploadedSongs.size > 0;

    if (!hasSongs) {
      processBtn.disabled = true;
      processBtn.textContent = 'Upload songs first';
    } else if (!allFilled) {
      processBtn.disabled = true;
      processBtn.textContent = 'Fill all set list slots';
    } else {
      processBtn.disabled = false;
      processBtn.textContent = 'Create Set List MP3';
    }
  }

  /* ── Processing ── */
  processBtn.addEventListener('click', async () => {
    const selects = slotsDiv.querySelectorAll('select');
    const songOrder = [...selects].map(s => s.value);

    if (songOrder.some(n => !n || !uploadedSongs.has(n))) {
      showError(errorBox, 'Please fill every slot with a song.');
      return;
    }

    hideError(errorBox);
    processBtn.disabled = true;
    processBtn.textContent = 'Processing...';
    resultDiv.classList.remove('active');
    progressWrap.classList.add('active');
    sp(2, 'Reading files...');

    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

      const decodedCache = new Map();
      const uniqueNames = [...new Set(songOrder)];

      for (let i = 0; i < uniqueNames.length; i++) {
        const name = uniqueNames[i];
        sp(2 + Math.floor((i / uniqueNames.length) * 20), 'Decoding: ' + name.replace(/\.mp3$/i, '') + '...');
        const buf = await uploadedSongs.get(name).arrayBuffer();
        const decoded = await audioCtx.decodeAudioData(buf);
        decodedCache.set(name, decoded);
      }

      audioCtx.close();

      sp(25, 'Building set list...');

      const firstBuffer = decodedCache.get(songOrder[0]);
      const sampleRate = firstBuffer.sampleRate;
      const numChannels = Math.max(...[...decodedCache.values()].map(b => b.numberOfChannels));

      const silenceSamples = Math.floor(sampleRate * 1.0);

      let totalLength = 0;
      for (let i = 0; i < songOrder.length; i++) {
        totalLength += decodedCache.get(songOrder[i]).length;
        if (i < songOrder.length - 1) totalLength += silenceSamples;
      }

      const combined = [];
      for (let ch = 0; ch < numChannels; ch++) {
        const out = new Float32Array(totalLength);
        let offset = 0;
        for (let i = 0; i < songOrder.length; i++) {
          const buf = decodedCache.get(songOrder[i]);
          const srcCh = ch < buf.numberOfChannels ? ch : 0;
          const data = buf.getChannelData(srcCh);
          out.set(data, offset);
          offset += buf.length;
          if (i < songOrder.length - 1) offset += silenceSamples;
        }
        combined.push(out);
      }

      sp(35, 'Encoding to MP3...');

      const mp3Data = await encodeMP3(combined, sampleRate, numChannels, totalLength, (ratio) => {
        sp(35 + Math.floor(ratio * 60), 'Encoding to MP3... ' + Math.floor(ratio * 100) + '%');
      });

      sp(96, 'Finalizing...');

      const blob = new Blob(mp3Data, { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const outName = 'setlist_' + songOrder.length + '_songs.mp3';

      dlLink.href = url;
      dlLink.download = outName;
      audioPreview.src = url;

      const durationSec = totalLength / sampleRate;
      const mins = Math.floor(durationSec / 60);
      const secs = Math.floor(durationSec % 60);
      resultInfo.textContent = outName + ' \u2014 ' + formatSize(blob.size) + ' \u2014 ' + mins + 'm ' + secs + 's \u2014 ' + songOrder.length + ' songs';

      sp(100, 'Done!');
      resultDiv.classList.add('active');
    } catch (err) {
      console.error(err);
      showError(errorBox, 'Error processing audio: ' + err.message);
    } finally {
      processBtn.disabled = false;
      processBtn.textContent = 'Create Set List MP3';
      setTimeout(() => progressWrap.classList.remove('active'), 1500);
    }
  });
})();
