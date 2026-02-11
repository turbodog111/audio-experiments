/* ═══════════════════════════════════════════════
   Tab 3: MP3 Editor — Multi-Track Mixer
   ─────────────────────────────────────────────
   File Library + Blank Track Slots + Drag & Drop
   ═══════════════════════════════════════════════ */
(function editorTab() {
  /* ── DOM references ── */
  var uploadArea      = document.getElementById('ed-uploadArea');
  var fileInput       = document.getElementById('ed-fileInput');
  var fileNameEl      = document.getElementById('ed-fileName');
  var errorBox        = document.getElementById('ed-errorBox');
  var gdriveBtn       = document.getElementById('ed-gdriveBtn');
  var gdriveNotice    = document.getElementById('ed-gdriveNotice');
  var workspace       = document.getElementById('ed-workspace');
  var addTrackBtn     = document.getElementById('ed-addTrackBtn');
  var trackCountEl    = document.getElementById('ed-trackCount');
  var tracksContainer = document.getElementById('ed-tracksContainer');
  var libraryList     = document.getElementById('ed-libraryList');
  var libraryFooter   = document.getElementById('ed-libraryFooter');
  var waveformContainer = document.getElementById('ed-waveformContainer');
  var waveformLanes   = document.getElementById('ed-waveformLanes');
  var overlayLeft     = document.getElementById('ed-overlayLeft');
  var overlayRight    = document.getElementById('ed-overlayRight');
  var handleLeft      = document.getElementById('ed-handleLeft');
  var handleRight     = document.getElementById('ed-handleRight');
  var playheadEl      = document.getElementById('ed-playhead');
  var trimStartEl     = document.getElementById('ed-trimStart');
  var trimEndEl       = document.getElementById('ed-trimEnd');
  var trimDurEl       = document.getElementById('ed-trimDuration');
  var playToggle      = document.getElementById('ed-playToggle');
  var resetBtn        = document.getElementById('ed-resetBtn');
  var fadeToggle      = document.getElementById('ed-fadeToggle');
  var fadeControls    = document.getElementById('ed-fadeControls');
  var fadeInRange     = document.getElementById('ed-fadeIn');
  var fadeOutRange    = document.getElementById('ed-fadeOut');
  var fadeInVal       = document.getElementById('ed-fadeInVal');
  var fadeOutVal      = document.getElementById('ed-fadeOutVal');
  var exportBtn       = document.getElementById('ed-exportBtn');
  var progressWrap    = document.getElementById('ed-progressWrap');
  var progressFill    = document.getElementById('ed-progressFill');
  var progressTextEl  = document.getElementById('ed-progressText');
  var resultDiv       = document.getElementById('ed-result');
  var dlLink          = document.getElementById('ed-downloadLink');
  var resultInfo      = document.getElementById('ed-resultInfo');
  var audioPreview    = document.getElementById('ed-audioPreview');

  /* ── Effects DOM references ── */
  var eqToggle         = document.getElementById('ed-eqToggle');
  var eqControls       = document.getElementById('ed-eqControls');
  var eqLowRange       = document.getElementById('ed-eqLow');
  var eqMidRange       = document.getElementById('ed-eqMid');
  var eqHighRange      = document.getElementById('ed-eqHigh');
  var eqLowVal         = document.getElementById('ed-eqLowVal');
  var eqMidVal         = document.getElementById('ed-eqMidVal');
  var eqHighVal        = document.getElementById('ed-eqHighVal');

  var compToggle       = document.getElementById('ed-compToggle');
  var compControls     = document.getElementById('ed-compControls');
  var compThreshRange  = document.getElementById('ed-compThreshold');
  var compRatioRange   = document.getElementById('ed-compRatio');
  var compAttackRange  = document.getElementById('ed-compAttack');
  var compReleaseRange = document.getElementById('ed-compRelease');
  var compThreshVal    = document.getElementById('ed-compThresholdVal');
  var compRatioVal     = document.getElementById('ed-compRatioVal');
  var compAttackVal    = document.getElementById('ed-compAttackVal');
  var compReleaseVal   = document.getElementById('ed-compReleaseVal');

  var reverbToggle     = document.getElementById('ed-reverbToggle');
  var reverbControls   = document.getElementById('ed-reverbControls');
  var reverbDecayRange = document.getElementById('ed-reverbDecay');
  var reverbMixRange   = document.getElementById('ed-reverbMix');
  var reverbDecayVal   = document.getElementById('ed-reverbDecayVal');
  var reverbMixVal     = document.getElementById('ed-reverbMixVal');

  var delayToggle      = document.getElementById('ed-delayToggle');
  var delayControls    = document.getElementById('ed-delayControls');
  var delayTimeRange   = document.getElementById('ed-delayTime');
  var delayFbRange     = document.getElementById('ed-delayFeedback');
  var delayMixRange    = document.getElementById('ed-delayMix');
  var delayTimeVal     = document.getElementById('ed-delayTimeVal');
  var delayFbVal       = document.getElementById('ed-delayFeedbackVal');
  var delayMixVal      = document.getElementById('ed-delayMixVal');

  var distortToggle    = document.getElementById('ed-distortToggle');
  var distortControls  = document.getElementById('ed-distortControls');
  var distortDriveRange = document.getElementById('ed-distortDrive');
  var distortToneRange = document.getElementById('ed-distortTone');
  var distortDriveVal  = document.getElementById('ed-distortDriveVal');
  var distortToneVal   = document.getElementById('ed-distortToneVal');

  /* ── Constants ── */
  var TRACK_COLORS = ['#e94560', '#4ecca3', '#4285f4', '#ffa726', '#ab47bc', '#26c6da'];

  /* ── File Library state ── */
  var libraryFiles = [];
  var nextFileId = 0;

  /* ── Track Slots state ── */
  var trackSlots = [];
  var nextSlotId = 0;

  /* ── Trim state ── */
  var trimStartRatio = 0;
  var trimEndRatio = 1;

  /* ── Playhead state ── */
  var totalDuration = 0;
  var playheadRatio = 0;
  var isPlaying = false;
  var playCtx = null;
  var playStartTime = 0;
  var playStartRatio = 0;
  var playAnimId = null;

  /* ── Drag state ── */
  var draggedFileId = null;

  /* ── Effects state ── */
  var fxEnabled = { eq: false, compressor: false, reverb: false, delay: false, distortion: false };
  var masterGain = null;
  var fxNodes = {
    eqLow: null, eqMid: null, eqHigh: null,
    compressor: null,
    reverbConvolver: null, reverbDryGain: null, reverbWetGain: null,
    delayNode: null, delayFeedbackGain: null, delayDryGain: null, delayWetGain: null,
    distortShaper: null, distortToneFilter: null
  };

  function sp(pct, text) { setProgress(progressFill, progressTextEl, pct, text); }

  showGdriveSetupNotice(gdriveNotice);

  /* ═══════════════════════════════════════════════
     Helpers
     ═══════════════════════════════════════════════ */

  function fmtTime(sec) {
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ':' + s.toFixed(1).padStart(4, '0');
  }

  function formatPan(pan) {
    var pct = Math.round(pan * 100);
    if (pct === 0) return 'C';
    if (pct < 0) return Math.abs(pct) + 'L';
    return pct + 'R';
  }

  function getLibFile(fileId) {
    for (var i = 0; i < libraryFiles.length; i++) {
      if (libraryFiles[i].id === fileId) return libraryFiles[i];
    }
    return null;
  }

  function getAssignedSlots() {
    var out = [];
    for (var i = 0; i < trackSlots.length; i++) {
      if (trackSlots[i].assignedFileId !== null) out.push(trackSlots[i]);
    }
    return out;
  }

  /* ═══════════════════════════════════════════════
     Audio Effect Utilities
     ═══════════════════════════════════════════════ */

  function generateReverbIR(ctx, decayTime) {
    var sampleRate = ctx.sampleRate;
    var length = Math.floor(sampleRate * decayTime);
    var irBuffer = ctx.createBuffer(2, length, sampleRate);
    var leftCh = irBuffer.getChannelData(0);
    var rightCh = irBuffer.getChannelData(1);
    for (var i = 0; i < length; i++) {
      var envelope = Math.exp(-3 * (i / sampleRate) / decayTime);
      leftCh[i] = (Math.random() * 2 - 1) * envelope;
      rightCh[i] = (Math.random() * 2 - 1) * envelope;
    }
    return irBuffer;
  }

  function generateDistortionCurve(drive) {
    var samples = 8192;
    var curve = new Float32Array(samples);
    var k = drive * 2;
    for (var i = 0; i < samples; i++) {
      var x = (i * 2) / samples - 1;
      curve[i] = k === 0 ? x : ((1 + k) * x) / (1 + k * Math.abs(x));
    }
    return curve;
  }

  /* ═══════════════════════════════════════════════
     File Library — Upload & Management
     ═══════════════════════════════════════════════ */

  uploadArea.addEventListener('click', function() { fileInput.click(); });
  uploadArea.addEventListener('dragover', function(e) { e.preventDefault(); uploadArea.classList.add('dragover'); });
  uploadArea.addEventListener('dragleave', function() { uploadArea.classList.remove('dragover'); });
  uploadArea.addEventListener('drop', function(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) addFilesToLibrary(e.dataTransfer.files);
  });
  fileInput.addEventListener('change', function() {
    if (fileInput.files.length > 0) addFilesToLibrary(fileInput.files);
    fileInput.value = '';
  });

  gdriveBtn.addEventListener('click', async function() {
    try {
      gdriveBtn.disabled = true;
      gdriveBtn.textContent = 'Opening Drive...';
      var results = await openDrivePicker(true);
      if (results.length > 0) {
        var files = results.map(function(r) {
          return new File([r.blob], r.name, { type: 'audio/mpeg' });
        });
        await addFilesToLibrary(files);
      }
    } catch (err) {
      showError(errorBox, 'Google Drive import failed: ' + err.message);
    } finally {
      gdriveBtn.disabled = false;
      gdriveBtn.textContent = 'Import from Google Drive';
    }
  });

  async function addFilesToLibrary(fileList) {
    hideError(errorBox);
    var actx = new (window.AudioContext || window.webkitAudioContext)();
    var added = 0;

    for (var i = 0; i < fileList.length; i++) {
      var file = fileList[i];
      if (!file.name.toLowerCase().endsWith('.mp3') && file.type !== 'audio/mpeg') continue;

      // Skip duplicates (same name + size)
      var dup = false;
      for (var j = 0; j < libraryFiles.length; j++) {
        if (libraryFiles[j].name === file.name && libraryFiles[j].size === file.size) { dup = true; break; }
      }
      if (dup) continue;

      try {
        var arrayBuf = await file.arrayBuffer();
        var buffer = await actx.decodeAudioData(arrayBuf);
        libraryFiles.push({
          id: nextFileId++,
          file: file,
          buffer: buffer,
          name: file.name,
          duration: buffer.duration,
          size: file.size
        });
        added++;
      } catch (err) {
        showError(errorBox, 'Failed to decode ' + file.name + ': ' + err.message);
      }
    }

    actx.close();

    if (added > 0) {
      uploadArea.classList.add('has-file');
      fileNameEl.textContent = libraryFiles.length + ' file' + (libraryFiles.length !== 1 ? 's' : '') + ' in library';

      // Auto-add one blank track if none exist yet
      if (trackSlots.length === 0) {
        addTrackSlot();
      }
    }

    rebuildLibraryUI();
  }

  function removeFromLibrary(fileId) {
    libraryFiles = libraryFiles.filter(function(f) { return f.id !== fileId; });

    // Unassign any track slots using this file
    var changed = false;
    for (var i = 0; i < trackSlots.length; i++) {
      if (trackSlots[i].assignedFileId === fileId) {
        trackSlots[i].assignedFileId = null;
        changed = true;
      }
    }

    if (libraryFiles.length === 0) {
      uploadArea.classList.remove('has-file');
      fileNameEl.textContent = '';
    } else {
      fileNameEl.textContent = libraryFiles.length + ' file' + (libraryFiles.length !== 1 ? 's' : '') + ' in library';
    }

    rebuildLibraryUI();
    if (changed) {
      rebuildTracksUI();
      recalcDuration();
      buildWaveformLanes();
      drawAllWaveforms();
      updateWorkspaceVisibility();
      dispatchSeparatorEvent();
    }
  }

  /* ═══════════════════════════════════════════════
     Library Panel UI
     ═══════════════════════════════════════════════ */

  function rebuildLibraryUI() {
    libraryList.innerHTML = '';

    for (var i = 0; i < libraryFiles.length; i++) {
      (function(lf) {
        var item = document.createElement('div');
        item.className = 'file-panel-item';
        item.draggable = true;
        item.dataset.fileId = lf.id;

        var icon = document.createElement('span');
        icon.className = 'file-panel-icon';
        icon.textContent = '\u266A';
        item.appendChild(icon);

        var info = document.createElement('div');
        info.className = 'file-panel-info';

        var nameEl = document.createElement('div');
        nameEl.className = 'file-panel-name';
        nameEl.textContent = lf.name.replace(/\.mp3$/i, '');
        nameEl.title = lf.name;
        info.appendChild(nameEl);

        var meta = document.createElement('div');
        meta.className = 'file-panel-meta';
        meta.textContent = fmtTime(lf.duration) + ' \u2022 ' + formatSize(lf.size);
        info.appendChild(meta);

        item.appendChild(info);

        var removeBtn = document.createElement('button');
        removeBtn.className = 'file-panel-remove';
        removeBtn.textContent = '\u00d7';
        removeBtn.title = 'Remove from library';
        removeBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          removeFromLibrary(lf.id);
        });
        item.appendChild(removeBtn);

        // Drag handlers
        item.addEventListener('dragstart', function(e) {
          draggedFileId = lf.id;
          e.dataTransfer.effectAllowed = 'copy';
          e.dataTransfer.setData('text/plain', String(lf.id));
          item.classList.add('dragging');
          document.body.classList.add('drag-in-progress');
        });
        item.addEventListener('dragend', function() {
          item.classList.remove('dragging');
          document.body.classList.remove('drag-in-progress');
          draggedFileId = null;
        });

        libraryList.appendChild(item);
      })(libraryFiles[i]);
    }

    libraryFooter.textContent = libraryFiles.length === 0
      ? 'No files loaded'
      : libraryFiles.length + ' file' + (libraryFiles.length !== 1 ? 's' : '');
  }

  /* ═══════════════════════════════════════════════
     Track Slot Management
     ═══════════════════════════════════════════════ */

  function addTrackSlot() {
    trackSlots.push({
      id: nextSlotId++,
      assignedFileId: null,
      volume: 1.0,
      pan: 0,
      canvas: null,
      gainNode: null,
      panNode: null,
      sourceNode: null
    });
    rebuildTracksUI();
    updateTrackCount();
  }

  function removeTrackSlot(slotId) {
    trackSlots = trackSlots.filter(function(s) { return s.id !== slotId; });
    rebuildTracksUI();
    recalcDuration();
    buildWaveformLanes();
    drawAllWaveforms();
    updateWorkspaceVisibility();
    updateTrackCount();
    dispatchSeparatorEvent();
    if (getAssignedSlots().length === 0) stopPlayback();
  }

  function moveSlotUp(slotId) {
    var idx = -1;
    for (var i = 0; i < trackSlots.length; i++) {
      if (trackSlots[i].id === slotId) { idx = i; break; }
    }
    if (idx <= 0) return;
    var tmp = trackSlots[idx - 1];
    trackSlots[idx - 1] = trackSlots[idx];
    trackSlots[idx] = tmp;
    rebuildTracksUI();
    buildWaveformLanes();
    drawAllWaveforms();
  }

  function moveSlotDown(slotId) {
    var idx = -1;
    for (var i = 0; i < trackSlots.length; i++) {
      if (trackSlots[i].id === slotId) { idx = i; break; }
    }
    if (idx < 0 || idx >= trackSlots.length - 1) return;
    var tmp = trackSlots[idx + 1];
    trackSlots[idx + 1] = trackSlots[idx];
    trackSlots[idx] = tmp;
    rebuildTracksUI();
    buildWaveformLanes();
    drawAllWaveforms();
  }

  function assignFileToSlot(fileId, slotId) {
    var slot = null;
    for (var i = 0; i < trackSlots.length; i++) {
      if (trackSlots[i].id === slotId) { slot = trackSlots[i]; break; }
    }
    if (!slot || !getLibFile(fileId)) return;

    slot.assignedFileId = fileId;
    rebuildTracksUI();
    recalcDuration();
    buildWaveformLanes();
    drawAllWaveforms();
    updateWorkspaceVisibility();
    updateTrimUI();
    updatePlayheadUI();
    dispatchSeparatorEvent();
  }

  function unassignSlot(slotId) {
    var slot = null;
    for (var i = 0; i < trackSlots.length; i++) {
      if (trackSlots[i].id === slotId) { slot = trackSlots[i]; break; }
    }
    if (!slot) return;
    slot.assignedFileId = null;
    rebuildTracksUI();
    recalcDuration();
    buildWaveformLanes();
    drawAllWaveforms();
    updateWorkspaceVisibility();
    dispatchSeparatorEvent();
    if (getAssignedSlots().length === 0) stopPlayback();
  }

  function updateTrackCount() {
    trackCountEl.textContent = trackSlots.length + ' track' + (trackSlots.length !== 1 ? 's' : '');
  }

  function updateWorkspaceVisibility() {
    if (getAssignedSlots().length > 0) {
      workspace.classList.add('active');
    } else {
      workspace.classList.remove('active');
    }
  }

  addTrackBtn.addEventListener('click', function() { addTrackSlot(); });

  /* ═══════════════════════════════════════════════
     Track Rows UI
     ═══════════════════════════════════════════════ */

  function rebuildTracksUI() {
    tracksContainer.innerHTML = '';

    for (var idx = 0; idx < trackSlots.length; idx++) {
      (function(slot, index) {
        var lf = slot.assignedFileId !== null ? getLibFile(slot.assignedFileId) : null;
        var color = lf ? TRACK_COLORS[index % TRACK_COLORS.length] : '';

        var row = document.createElement('div');
        row.className = 'editor-track-row';
        row.dataset.slotId = slot.id;
        if (color) row.style.setProperty('--track-color', color);

        // ── Left Controls ──
        var left = document.createElement('div');
        left.className = 'track-left-controls';

        var dot = document.createElement('span');
        dot.className = 'track-color-dot';
        left.appendChild(dot);

        var num = document.createElement('span');
        num.className = 'track-number';
        num.textContent = (index + 1);
        left.appendChild(num);

        var reorderBtns = document.createElement('div');
        reorderBtns.className = 'track-reorder-btns';

        var upBtn = document.createElement('button');
        upBtn.textContent = '\u25B2';
        upBtn.title = 'Move up';
        if (index === 0) upBtn.disabled = true;
        upBtn.addEventListener('click', function() { moveSlotUp(slot.id); });
        reorderBtns.appendChild(upBtn);

        var downBtn = document.createElement('button');
        downBtn.textContent = '\u25BC';
        downBtn.title = 'Move down';
        if (index === trackSlots.length - 1) downBtn.disabled = true;
        downBtn.addEventListener('click', function() { moveSlotDown(slot.id); });
        reorderBtns.appendChild(downBtn);

        left.appendChild(reorderBtns);

        var removeBtn = document.createElement('button');
        removeBtn.className = 'track-remove-btn';
        removeBtn.textContent = '\u00d7';
        removeBtn.title = 'Remove track';
        removeBtn.addEventListener('click', function() { removeTrackSlot(slot.id); });
        left.appendChild(removeBtn);

        row.appendChild(left);

        // ── Center Content ──
        var center = document.createElement('div');
        center.className = 'track-center';

        if (!lf) {
          // Blank — drop zone
          var dropZone = document.createElement('div');
          dropZone.className = 'track-drop-zone';
          dropZone.dataset.slotId = slot.id;

          var dzText = document.createElement('span');
          dzText.className = 'drop-zone-text';
          dzText.textContent = 'Drag file here';
          dropZone.appendChild(dzText);

          // Drop handlers
          dropZone.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            dropZone.classList.add('drag-over');
          });
          dropZone.addEventListener('dragleave', function() {
            dropZone.classList.remove('drag-over');
          });
          dropZone.addEventListener('drop', function(e) {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            if (draggedFileId !== null) {
              assignFileToSlot(draggedFileId, slot.id);
            }
          });

          center.appendChild(dropZone);
        } else {
          // Assigned — show file info + mini waveform
          var assigned = document.createElement('div');
          assigned.className = 'track-assigned';

          var infoBar = document.createElement('div');
          infoBar.className = 'track-info-bar';

          var nameEl = document.createElement('span');
          nameEl.className = 'track-name';
          nameEl.textContent = lf.name.replace(/\.mp3$/i, '');
          nameEl.title = lf.name;
          infoBar.appendChild(nameEl);

          var unassignBtn = document.createElement('button');
          unassignBtn.className = 'track-unassign-btn';
          unassignBtn.textContent = '\u232B';
          unassignBtn.title = 'Unassign file';
          unassignBtn.addEventListener('click', function() { unassignSlot(slot.id); });
          infoBar.appendChild(unassignBtn);

          assigned.appendChild(infoBar);

          var canvas = document.createElement('canvas');
          canvas.className = 'track-mini-canvas';
          assigned.appendChild(canvas);
          slot.canvas = canvas;

          // Draw mini waveform after append
          setTimeout(function() { drawMiniWaveform(lf.buffer, canvas, color); }, 0);

          // Also allow re-drop to replace
          assigned.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            assigned.style.outline = '2px solid var(--accent-green)';
          });
          assigned.addEventListener('dragleave', function() {
            assigned.style.outline = '';
          });
          assigned.addEventListener('drop', function(e) {
            e.preventDefault();
            assigned.style.outline = '';
            if (draggedFileId !== null) {
              assignFileToSlot(draggedFileId, slot.id);
            }
          });

          center.appendChild(assigned);
        }

        row.appendChild(center);

        // ── Right Controls (vol + pan) ──
        var right = document.createElement('div');
        right.className = 'track-right-controls';

        // Volume row
        var volRow = document.createElement('div');
        volRow.className = 'track-ctrl-row';

        var volLabel = document.createElement('label');
        volLabel.textContent = 'Vol';
        volRow.appendChild(volLabel);

        var volSlider = document.createElement('input');
        volSlider.type = 'range';
        volSlider.className = 'track-vol';
        volSlider.min = '0';
        volSlider.max = '150';
        volSlider.step = '5';
        volSlider.value = String(Math.round(slot.volume * 100));
        volRow.appendChild(volSlider);

        var volValEl = document.createElement('span');
        volValEl.className = 'track-vol-val';
        volValEl.textContent = Math.round(slot.volume * 100) + '%';
        volRow.appendChild(volValEl);

        volSlider.addEventListener('input', function() {
          slot.volume = parseInt(volSlider.value) / 100;
          volValEl.textContent = volSlider.value + '%';
          if (slot.gainNode) slot.gainNode.gain.value = slot.volume;
        });

        right.appendChild(volRow);

        // Pan row
        var panRow = document.createElement('div');
        panRow.className = 'track-ctrl-row';

        var panLabel = document.createElement('label');
        panLabel.textContent = 'Pan';
        panRow.appendChild(panLabel);

        var panSlider = document.createElement('input');
        panSlider.type = 'range';
        panSlider.className = 'track-pan';
        panSlider.min = '-100';
        panSlider.max = '100';
        panSlider.step = '5';
        panSlider.value = String(Math.round(slot.pan * 100));
        panRow.appendChild(panSlider);

        var panValEl = document.createElement('span');
        panValEl.className = 'track-pan-val';
        panValEl.textContent = formatPan(slot.pan);
        panRow.appendChild(panValEl);

        panSlider.addEventListener('input', function() {
          slot.pan = parseInt(panSlider.value) / 100;
          panValEl.textContent = formatPan(slot.pan);
          if (slot.panNode) slot.panNode.pan.value = slot.pan;
        });

        right.appendChild(panRow);
        row.appendChild(right);

        tracksContainer.appendChild(row);
      })(trackSlots[idx], idx);
    }

    updateTrackCount();
  }

  /* ═══════════════════════════════════════════════
     Mini waveform (per-track row canvas)
     ═══════════════════════════════════════════════ */

  function drawMiniWaveform(buffer, canvas, color) {
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    var w = rect.width;
    var h = rect.height;
    var mid = h / 2;
    var data = buffer.getChannelData(0);
    var step = Math.max(1, Math.floor(data.length / w));

    ctx.clearRect(0, 0, w, h);

    // Center line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(w, mid);
    ctx.stroke();

    // Bars
    for (var x = 0; x < w; x++) {
      var start = Math.floor(x * data.length / w);
      var min = 0, max = 0;
      for (var j = 0; j < step; j++) {
        var val = data[start + j] || 0;
        if (val < min) min = val;
        if (val > max) max = val;
      }
      var top = mid + min * mid;
      var bottom = mid + max * mid;
      ctx.fillStyle = color || '#e94560';
      ctx.fillRect(x, top, 1, bottom - top || 1);
    }
  }

  /* ═══════════════════════════════════════════════
     Duration & Global Waveform
     ═══════════════════════════════════════════════ */

  function recalcDuration() {
    totalDuration = 0;
    var assigned = getAssignedSlots();
    for (var i = 0; i < assigned.length; i++) {
      var lf = getLibFile(assigned[i].assignedFileId);
      if (lf && lf.buffer.duration > totalDuration) {
        totalDuration = lf.buffer.duration;
      }
    }
  }

  function buildWaveformLanes() {
    waveformLanes.innerHTML = '';
    var assigned = getAssignedSlots();
    for (var i = 0; i < assigned.length; i++) {
      var lf = getLibFile(assigned[i].assignedFileId);
      if (!lf) continue;

      var lane = document.createElement('div');
      lane.className = 'waveform-lane';

      var canvas = document.createElement('canvas');
      canvas.className = 'lane-canvas';
      lane.appendChild(canvas);

      waveformLanes.appendChild(lane);
      assigned[i]._globalCanvas = canvas;
    }
  }

  function drawAllWaveforms() {
    var assigned = getAssignedSlots();
    for (var i = 0; i < assigned.length; i++) {
      var canvas = assigned[i]._globalCanvas;
      var lf = getLibFile(assigned[i].assignedFileId);
      if (!canvas || !lf) continue;
      drawGlobalWaveform(lf.buffer, canvas, TRACK_COLORS[i % TRACK_COLORS.length]);
    }
  }

  function drawGlobalWaveform(buffer, canvas, color) {
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    var w = rect.width;
    var h = rect.height;
    var mid = h / 2;
    var data = buffer.getChannelData(0);

    var trackWidthPx = totalDuration > 0 ? (buffer.duration / totalDuration) * w : w;
    var step = Math.max(1, Math.floor(data.length / trackWidthPx));

    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(w, mid);
    ctx.stroke();

    for (var x = 0; x < trackWidthPx; x++) {
      var start = Math.floor(x * data.length / trackWidthPx);
      var min = 0, max = 0;
      for (var j = 0; j < step; j++) {
        var val = data[start + j] || 0;
        if (val < min) min = val;
        if (val > max) max = val;
      }
      var top = mid + min * mid;
      var bottom = mid + max * mid;
      ctx.fillStyle = color;
      ctx.fillRect(x, top, 1, bottom - top || 1);
    }

    // Time markers
    ctx.fillStyle = '#4a4a5e';
    ctx.font = '10px Inter, sans-serif';
    var numMarkers = Math.min(10, Math.floor(totalDuration));
    if (numMarkers > 0) {
      var interval = totalDuration / numMarkers;
      for (var m = 0; m <= numMarkers; m++) {
        var t = m * interval;
        var xm = (t / totalDuration) * w;
        ctx.fillRect(xm, h - 12, 1, 4);
        ctx.fillText(fmtTime(t), xm + 2, h - 2);
      }
    }
  }

  /* ═══════════════════════════════════════════════
     Trim handles
     ═══════════════════════════════════════════════ */

  function updateTrimUI() {
    overlayLeft.style.width = (trimStartRatio * 100) + '%';
    overlayRight.style.width = ((1 - trimEndRatio) * 100) + '%';
    handleLeft.style.left = (trimStartRatio * 100) + '%';
    handleRight.style.left = (trimEndRatio * 100) + '%';

    var startSec = trimStartRatio * totalDuration;
    var endSec = trimEndRatio * totalDuration;
    trimStartEl.textContent = fmtTime(startSec);
    trimEndEl.textContent = fmtTime(endSec);
    trimDurEl.textContent = fmtTime(endSec - startSec);
  }

  function startTrimDrag(isLeft) {
    var onMove = function(e) {
      e.preventDefault();
      var rect = waveformContainer.getBoundingClientRect();
      var clientX = e.touches ? e.touches[0].clientX : e.clientX;
      var ratio = (clientX - rect.left) / rect.width;
      ratio = Math.max(0, Math.min(1, ratio));

      if (isLeft) {
        trimStartRatio = Math.min(ratio, trimEndRatio - 0.005);
      } else {
        trimEndRatio = Math.max(ratio, trimStartRatio + 0.005);
      }
      updateTrimUI();
    };

    var onUp = function() {
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

  handleLeft.addEventListener('mousedown', function(e) { e.preventDefault(); e.stopPropagation(); startTrimDrag(true); });
  handleLeft.addEventListener('touchstart', function(e) { e.preventDefault(); e.stopPropagation(); startTrimDrag(true); }, { passive: false });
  handleRight.addEventListener('mousedown', function(e) { e.preventDefault(); e.stopPropagation(); startTrimDrag(false); });
  handleRight.addEventListener('touchstart', function(e) { e.preventDefault(); e.stopPropagation(); startTrimDrag(false); }, { passive: false });

  resetBtn.addEventListener('click', function() {
    trimStartRatio = 0;
    trimEndRatio = 1;
    updateTrimUI();
  });

  /* ═══════════════════════════════════════════════
     Playhead — click-to-seek & drag
     ═══════════════════════════════════════════════ */

  function updatePlayheadUI() {
    playheadEl.style.left = (playheadRatio * 100) + '%';
  }

  function seekTo(ratio) {
    playheadRatio = Math.max(0, Math.min(1, ratio));
    updatePlayheadUI();
    if (isPlaying) {
      stopPlayback();
      startPlayback();
    }
  }

  waveformContainer.addEventListener('click', function(e) {
    if (getAssignedSlots().length === 0) return;
    var rect = waveformContainer.getBoundingClientRect();
    var ratio = (e.clientX - rect.left) / rect.width;
    seekTo(ratio);
  });

  function onPlayheadDown(e) {
    e.preventDefault();
    e.stopPropagation();

    var onMove = function(ev) {
      ev.preventDefault();
      var rect = waveformContainer.getBoundingClientRect();
      var clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
      var ratio = (clientX - rect.left) / rect.width;
      playheadRatio = Math.max(0, Math.min(1, ratio));
      updatePlayheadUI();
    };

    var onUp = function() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
      if (isPlaying) {
        stopPlayback();
        startPlayback();
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);
  }

  playheadEl.addEventListener('mousedown', onPlayheadDown);
  playheadEl.addEventListener('touchstart', onPlayheadDown, { passive: false });

  /* ═══════════════════════════════════════════════
     Fade toggle
     ═══════════════════════════════════════════════ */

  fadeToggle.addEventListener('click', function() {
    fadeToggle.classList.toggle('active-effect');
    fadeControls.classList.toggle('active');
  });

  fadeInRange.addEventListener('input', function() {
    fadeInVal.textContent = parseFloat(fadeInRange.value).toFixed(1) + 's';
  });
  fadeOutRange.addEventListener('input', function() {
    fadeOutVal.textContent = parseFloat(fadeOutRange.value).toFixed(1) + 's';
  });

  /* ═══════════════════════════════════════════════
     Effects — Toggle & Parameter Handlers
     ═══════════════════════════════════════════════ */

  function setupEffectToggle(btn, panel, fxKey) {
    btn.addEventListener('click', function() {
      btn.classList.toggle('active-effect');
      panel.classList.toggle('active');
      fxEnabled[fxKey] = btn.classList.contains('active-effect');
      if (isPlaying) { stopPlayback(); startPlayback(); }
    });
  }

  setupEffectToggle(eqToggle, eqControls, 'eq');
  setupEffectToggle(compToggle, compControls, 'compressor');
  setupEffectToggle(reverbToggle, reverbControls, 'reverb');
  setupEffectToggle(delayToggle, delayControls, 'delay');
  setupEffectToggle(distortToggle, distortControls, 'distortion');

  function setupSlider(rangeEl, valEl, formatFn, liveParamFn) {
    rangeEl.addEventListener('input', function() {
      valEl.textContent = formatFn(rangeEl.value);
      if (liveParamFn) liveParamFn(parseFloat(rangeEl.value));
    });
  }

  // EQ sliders
  setupSlider(eqLowRange, eqLowVal,
    function(v) { return parseFloat(v).toFixed(1) + ' dB'; },
    function(v) { if (fxNodes.eqLow) fxNodes.eqLow.gain.value = v; });
  setupSlider(eqMidRange, eqMidVal,
    function(v) { return parseFloat(v).toFixed(1) + ' dB'; },
    function(v) { if (fxNodes.eqMid) fxNodes.eqMid.gain.value = v; });
  setupSlider(eqHighRange, eqHighVal,
    function(v) { return parseFloat(v).toFixed(1) + ' dB'; },
    function(v) { if (fxNodes.eqHigh) fxNodes.eqHigh.gain.value = v; });

  // Compressor sliders
  setupSlider(compThreshRange, compThreshVal,
    function(v) { return v + ' dB'; },
    function(v) { if (fxNodes.compressor) fxNodes.compressor.threshold.value = v; });
  setupSlider(compRatioRange, compRatioVal,
    function(v) { return parseFloat(v).toFixed(1) + ':1'; },
    function(v) { if (fxNodes.compressor) fxNodes.compressor.ratio.value = v; });
  setupSlider(compAttackRange, compAttackVal,
    function(v) { return v + ' ms'; },
    function(v) { if (fxNodes.compressor) fxNodes.compressor.attack.value = v / 1000; });
  setupSlider(compReleaseRange, compReleaseVal,
    function(v) { return v + ' ms'; },
    function(v) { if (fxNodes.compressor) fxNodes.compressor.release.value = v / 1000; });

  // Reverb sliders
  setupSlider(reverbDecayRange, reverbDecayVal,
    function(v) { return parseFloat(v).toFixed(1) + ' s'; }, null);
  reverbDecayRange.addEventListener('change', function() {
    if (fxNodes.reverbConvolver && playCtx) {
      fxNodes.reverbConvolver.buffer = generateReverbIR(playCtx, parseFloat(reverbDecayRange.value));
    }
  });
  setupSlider(reverbMixRange, reverbMixVal,
    function(v) { return v + '%'; },
    function(v) {
      var wet = v / 100;
      if (fxNodes.reverbDryGain) fxNodes.reverbDryGain.gain.value = 1 - wet;
      if (fxNodes.reverbWetGain) fxNodes.reverbWetGain.gain.value = wet;
    });

  // Delay sliders
  setupSlider(delayTimeRange, delayTimeVal,
    function(v) { return v + ' ms'; },
    function(v) { if (fxNodes.delayNode) fxNodes.delayNode.delayTime.value = v / 1000; });
  setupSlider(delayFbRange, delayFbVal,
    function(v) { return v + '%'; },
    function(v) { if (fxNodes.delayFeedbackGain) fxNodes.delayFeedbackGain.gain.value = v / 100; });
  setupSlider(delayMixRange, delayMixVal,
    function(v) { return v + '%'; },
    function(v) {
      var wet = v / 100;
      if (fxNodes.delayDryGain) fxNodes.delayDryGain.gain.value = 1 - wet;
      if (fxNodes.delayWetGain) fxNodes.delayWetGain.gain.value = wet;
    });

  // Distortion sliders
  setupSlider(distortDriveRange, distortDriveVal,
    function(v) { return v; },
    function(v) {
      if (fxNodes.distortShaper) fxNodes.distortShaper.curve = generateDistortionCurve(parseFloat(v));
    });
  setupSlider(distortToneRange, distortToneVal,
    function(v) { return v + ' Hz'; },
    function(v) { if (fxNodes.distortToneFilter) fxNodes.distortToneFilter.frequency.value = v; });

  /* ═══════════════════════════════════════════════
     Effects Chain — Build master bus
     ═══════════════════════════════════════════════ */

  function buildEffectsChain(ctx) {
    // Reset node references
    for (var key in fxNodes) fxNodes[key] = null;

    masterGain = ctx.createGain();
    masterGain.gain.value = 1.0;
    var currentNode = masterGain;

    // EQ: 3 BiquadFilters in series
    if (fxEnabled.eq) {
      var eqLow = ctx.createBiquadFilter();
      eqLow.type = 'lowshelf';
      eqLow.frequency.value = 320;
      eqLow.gain.value = parseFloat(eqLowRange.value);

      var eqMid = ctx.createBiquadFilter();
      eqMid.type = 'peaking';
      eqMid.frequency.value = 1000;
      eqMid.Q.value = 1.0;
      eqMid.gain.value = parseFloat(eqMidRange.value);

      var eqHigh = ctx.createBiquadFilter();
      eqHigh.type = 'highshelf';
      eqHigh.frequency.value = 3200;
      eqHigh.gain.value = parseFloat(eqHighRange.value);

      currentNode.connect(eqLow);
      eqLow.connect(eqMid);
      eqMid.connect(eqHigh);
      currentNode = eqHigh;

      fxNodes.eqLow = eqLow;
      fxNodes.eqMid = eqMid;
      fxNodes.eqHigh = eqHigh;
    }

    // Compressor
    if (fxEnabled.compressor) {
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = parseFloat(compThreshRange.value);
      comp.ratio.value = parseFloat(compRatioRange.value);
      comp.attack.value = parseFloat(compAttackRange.value) / 1000;
      comp.release.value = parseFloat(compReleaseRange.value) / 1000;
      comp.knee.value = 6;

      currentNode.connect(comp);
      currentNode = comp;
      fxNodes.compressor = comp;
    }

    // Distortion: WaveShaperNode + tone filter
    if (fxEnabled.distortion) {
      var shaper = ctx.createWaveShaper();
      shaper.curve = generateDistortionCurve(parseFloat(distortDriveRange.value));
      shaper.oversample = '4x';

      var toneFilter = ctx.createBiquadFilter();
      toneFilter.type = 'lowpass';
      toneFilter.frequency.value = parseFloat(distortToneRange.value);
      toneFilter.Q.value = 0.7;

      currentNode.connect(shaper);
      shaper.connect(toneFilter);
      currentNode = toneFilter;

      fxNodes.distortShaper = shaper;
      fxNodes.distortToneFilter = toneFilter;
    }

    // Delay: parallel wet/dry with feedback loop
    if (fxEnabled.delay) {
      var delayMerger = ctx.createGain();
      var wetMix = parseFloat(delayMixRange.value) / 100;

      var dryGain = ctx.createGain();
      dryGain.gain.value = 1 - wetMix;

      var delayNode = ctx.createDelay(2.0);
      delayNode.delayTime.value = parseFloat(delayTimeRange.value) / 1000;

      var feedbackGain = ctx.createGain();
      feedbackGain.gain.value = parseFloat(delayFbRange.value) / 100;

      var wetGain = ctx.createGain();
      wetGain.gain.value = wetMix;

      currentNode.connect(dryGain);
      dryGain.connect(delayMerger);
      currentNode.connect(delayNode);
      delayNode.connect(feedbackGain);
      feedbackGain.connect(delayNode);
      delayNode.connect(wetGain);
      wetGain.connect(delayMerger);
      currentNode = delayMerger;

      fxNodes.delayNode = delayNode;
      fxNodes.delayFeedbackGain = feedbackGain;
      fxNodes.delayDryGain = dryGain;
      fxNodes.delayWetGain = wetGain;
    }

    // Reverb: ConvolverNode with wet/dry mix
    if (fxEnabled.reverb) {
      var reverbMerger = ctx.createGain();
      var wetMixR = parseFloat(reverbMixRange.value) / 100;

      var dryGainR = ctx.createGain();
      dryGainR.gain.value = 1 - wetMixR;

      var convolver = ctx.createConvolver();
      convolver.buffer = generateReverbIR(ctx, parseFloat(reverbDecayRange.value));

      var wetGainR = ctx.createGain();
      wetGainR.gain.value = wetMixR;

      currentNode.connect(dryGainR);
      dryGainR.connect(reverbMerger);
      currentNode.connect(convolver);
      convolver.connect(wetGainR);
      wetGainR.connect(reverbMerger);
      currentNode = reverbMerger;

      fxNodes.reverbConvolver = convolver;
      fxNodes.reverbDryGain = dryGainR;
      fxNodes.reverbWetGain = wetGainR;
    }

    currentNode.connect(ctx.destination);
    return masterGain;
  }

  /* ═══════════════════════════════════════════════
     Playback — Web Audio mixing graph
     ═══════════════════════════════════════════════ */

  function stopPlayback() {
    for (var i = 0; i < trackSlots.length; i++) {
      if (trackSlots[i].sourceNode) {
        try { trackSlots[i].sourceNode.stop(); } catch (_) {}
        trackSlots[i].sourceNode = null;
      }
      trackSlots[i].gainNode = null;
      trackSlots[i].panNode = null;
    }
    masterGain = null;
    for (var key in fxNodes) fxNodes[key] = null;
    if (playCtx) {
      playCtx.close();
      playCtx = null;
    }
    if (playAnimId) {
      cancelAnimationFrame(playAnimId);
      playAnimId = null;
    }
    isPlaying = false;
    playToggle.textContent = 'Play (Space)';
  }

  function startPlayback() {
    var assigned = getAssignedSlots();
    if (assigned.length === 0) return;
    stopPlayback();

    playCtx = new (window.AudioContext || window.webkitAudioContext)();

    var startTimeSec = playheadRatio * totalDuration;
    var endTimeSec = trimEndRatio * totalDuration;
    var playDuration = endTimeSec - startTimeSec;
    if (playDuration <= 0) return;

    // Build master bus effects chain
    var chainInput = buildEffectsChain(playCtx);

    for (var i = 0; i < assigned.length; i++) {
      var slot = assigned[i];
      var lf = getLibFile(slot.assignedFileId);
      if (!lf) continue;

      var source = playCtx.createBufferSource();
      source.buffer = lf.buffer;

      var gain = playCtx.createGain();
      gain.gain.value = slot.volume;

      var panner = playCtx.createStereoPanner();
      panner.pan.value = slot.pan;

      source.connect(gain);
      gain.connect(panner);
      panner.connect(chainInput);

      slot.sourceNode = source;
      slot.gainNode = gain;
      slot.panNode = panner;

      if (startTimeSec < lf.buffer.duration) {
        var trackPlayDuration = Math.min(playDuration, lf.buffer.duration - startTimeSec);
        source.start(0, startTimeSec, trackPlayDuration);
      }
    }

    isPlaying = true;
    playToggle.textContent = 'Stop (Space)';
    playStartTime = playCtx.currentTime;
    playStartRatio = playheadRatio;

    function animatePlayhead() {
      if (!playCtx || !isPlaying) return;
      var elapsed = playCtx.currentTime - playStartTime;
      var currentRatio = playStartRatio + (elapsed / totalDuration);

      if (currentRatio >= trimEndRatio) {
        playheadRatio = trimEndRatio;
        updatePlayheadUI();
        stopPlayback();
        return;
      }

      playheadRatio = currentRatio;
      updatePlayheadUI();
      playAnimId = requestAnimationFrame(animatePlayhead);
    }
    animatePlayhead();
  }

  function togglePlayback() {
    if (isPlaying) stopPlayback();
    else startPlayback();
  }

  playToggle.addEventListener('click', togglePlayback);

  document.addEventListener('keydown', function(e) {
    if (e.code === 'Space' && !e.repeat) {
      var tag = document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return;
      if (!document.getElementById('tab-editor').classList.contains('active')) return;
      if (getAssignedSlots().length === 0) return;
      e.preventDefault();
      togglePlayback();
    }
  });

  /* ═══════════════════════════════════════════════
     Export — mix assigned tracks to stereo MP3
     ═══════════════════════════════════════════════ */

  exportBtn.addEventListener('click', async function() {
    var assigned = getAssignedSlots();
    if (assigned.length === 0) {
      showError(errorBox, 'No tracks assigned. Drag files onto tracks first.');
      return;
    }

    hideError(errorBox);
    exportBtn.disabled = true;
    exportBtn.textContent = 'Exporting...';
    resultDiv.classList.remove('active');
    progressWrap.classList.add('active');
    sp(5, 'Preparing mix...');

    try {
      var firstLf = getLibFile(assigned[0].assignedFileId);
      var sampleRate = firstLf.buffer.sampleRate;
      var numChannels = 2;

      var trimStartSec = trimStartRatio * totalDuration;
      var trimEndSec = trimEndRatio * totalDuration;
      var outputDurationSec = trimEndSec - trimStartSec;
      if (outputDurationSec <= 0) {
        showError(errorBox, 'Trim selection is empty.');
        exportBtn.disabled = false;
        exportBtn.textContent = 'Export Mixed MP3';
        progressWrap.classList.remove('active');
        return;
      }

      // Extra tail time for reverb/delay decay
      var tailSec = 0;
      if (fxEnabled.reverb) tailSec = Math.max(tailSec, parseFloat(reverbDecayRange.value));
      if (fxEnabled.delay) {
        var fb = parseFloat(delayFbRange.value) / 100;
        var dt = parseFloat(delayTimeRange.value) / 1000;
        if (fb > 0 && dt > 0) tailSec = Math.max(tailSec, dt * Math.min(10, 1 / (1 - fb)));
      }

      var renderDurationSec = outputDurationSec + tailSec;
      var renderLength = Math.ceil(renderDurationSec * sampleRate);
      var outputSamples = Math.floor(outputDurationSec * sampleRate);

      sp(10, 'Building offline audio graph...');

      var offCtx = new OfflineAudioContext(numChannels, renderLength, sampleRate);
      var chainInput = buildEffectsChain(offCtx);

      // Per-track sources
      for (var i = 0; i < assigned.length; i++) {
        var slot = assigned[i];
        var lf = getLibFile(slot.assignedFileId);
        if (!lf) continue;

        var source = offCtx.createBufferSource();
        source.buffer = lf.buffer;

        var gain = offCtx.createGain();
        gain.gain.value = slot.volume;

        var panner = offCtx.createStereoPanner();
        panner.pan.value = slot.pan;

        source.connect(gain);
        gain.connect(panner);
        panner.connect(chainInput);

        var trackAvailDur = Math.max(0, lf.buffer.duration - trimStartSec);
        if (trackAvailDur > 0) {
          source.start(0, trimStartSec, Math.min(outputDurationSec, trackAvailDur));
        }
      }

      // Fades via GainNode automation
      var fadeInSec = parseFloat(fadeInRange.value) || 0;
      var fadeOutSec = parseFloat(fadeOutRange.value) || 0;
      if (fadeInSec > 0) {
        masterGain.gain.setValueAtTime(0, 0);
        masterGain.gain.linearRampToValueAtTime(1, fadeInSec);
      }
      if (fadeOutSec > 0) {
        var fadeOutStart = outputDurationSec - fadeOutSec;
        if (fadeOutStart > 0) {
          masterGain.gain.setValueAtTime(1, fadeOutStart);
          masterGain.gain.linearRampToValueAtTime(0, outputDurationSec);
        }
      }

      sp(20, 'Rendering ' + assigned.length + ' track' + (assigned.length !== 1 ? 's' : '') + ' with effects...');

      var renderedBuffer = await offCtx.startRendering();

      sp(60, 'Encoding to MP3...');

      var outLeft = renderedBuffer.getChannelData(0);
      var outRight = renderedBuffer.numberOfChannels >= 2
        ? renderedBuffer.getChannelData(1) : renderedBuffer.getChannelData(0);

      // Find end of audible content (trim silence from effect tails)
      var encodeSamples = outputSamples;
      if (tailSec > 0) {
        var silenceThreshold = 0.001;
        for (var s = Math.min(renderedBuffer.length, renderLength) - 1; s >= outputSamples; s--) {
          if (Math.abs(outLeft[s]) > silenceThreshold || Math.abs(outRight[s]) > silenceThreshold) {
            encodeSamples = s + 1;
            break;
          }
        }
      }

      // Clamp
      var encL = outLeft.subarray(0, encodeSamples);
      var encR = outRight.subarray(0, encodeSamples);
      for (var i = 0; i < encodeSamples; i++) {
        if (encL[i] > 1) encL[i] = 1; else if (encL[i] < -1) encL[i] = -1;
        if (encR[i] > 1) encR[i] = 1; else if (encR[i] < -1) encR[i] = -1;
      }

      var channels = [encL, encR];
      var mp3Data = await encodeMP3(channels, sampleRate, numChannels, encodeSamples, function(ratio) {
        sp(60 + Math.floor(ratio * 35), 'Encoding to MP3... ' + Math.floor(ratio * 100) + '%');
      });

      sp(96, 'Finalizing...');

      var blob = new Blob(mp3Data, { type: 'audio/mpeg' });
      var url = URL.createObjectURL(blob);
      var outName = assigned.length === 1
        ? getLibFile(assigned[0].assignedFileId).name.replace(/\.mp3$/i, '') + '_edited.mp3'
        : 'mix_' + assigned.length + '_tracks.mp3';

      dlLink.href = url;
      dlLink.download = outName;
      audioPreview.src = url;

      var durationSec = encodeSamples / sampleRate;
      var mins = Math.floor(durationSec / 60);
      var secs = Math.floor(durationSec % 60);
      resultInfo.textContent = outName + ' \u2014 ' + formatSize(blob.size) +
        ' \u2014 ' + mins + 'm ' + secs + 's' +
        ' \u2014 ' + assigned.length + ' track' + (assigned.length !== 1 ? 's' : '');

      sp(100, 'Done!');
      resultDiv.classList.add('active');
    } catch (err) {
      console.error(err);
      showError(errorBox, 'Export failed: ' + err.message);
    } finally {
      masterGain = null;
      for (var key in fxNodes) fxNodes[key] = null;
      exportBtn.disabled = false;
      exportBtn.textContent = 'Export Mixed MP3';
      setTimeout(function() { progressWrap.classList.remove('active'); }, 1500);
    }
  });

  /* ═══════════════════════════════════════════════
     Separator integration
     ═══════════════════════════════════════════════ */

  function dispatchSeparatorEvent() {
    var assigned = getAssignedSlots();
    if (assigned.length === 1) {
      var lf = getLibFile(assigned[0].assignedFileId);
      if (lf) {
        window.dispatchEvent(new CustomEvent('editor-file-loaded', {
          detail: { file: lf.file, audioBuffer: lf.buffer, fileName: lf.name }
        }));
        return;
      }
    }
    window.dispatchEvent(new CustomEvent('editor-file-loaded', {
      detail: { file: null, audioBuffer: null, fileName: '', multiTrack: true }
    }));
  }

  /* ═══════════════════════════════════════════════
     Redraw on resize
     ═══════════════════════════════════════════════ */

  var resizeTimer;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {
      if (getAssignedSlots().length > 0) {
        drawAllWaveforms();
        updateTrimUI();
        updatePlayheadUI();
      }
      // Redraw mini canvases
      rebuildTracksUI();
    }, 150);
  });

  /* ── Initial state ── */
  updateTrackCount();
  rebuildLibraryUI();
})();
