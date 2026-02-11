/* ═══════════════════════════════════════════════
   Tab 3: MP3 Editor — Multi-Track Mixer
   ═══════════════════════════════════════════════ */
(function editorTab() {
  /* ── DOM references ── */
  const uploadArea      = document.getElementById('ed-uploadArea');
  const fileInput       = document.getElementById('ed-fileInput');
  const fileNameEl      = document.getElementById('ed-fileName');
  const errorBox        = document.getElementById('ed-errorBox');
  const gdriveBtn       = document.getElementById('ed-gdriveBtn');
  const gdriveNotice    = document.getElementById('ed-gdriveNotice');
  const workspace       = document.getElementById('ed-workspace');
  const trackListEl     = document.getElementById('ed-trackList');
  const trackCountEl    = document.getElementById('ed-trackCount');
  const trackListItems  = document.getElementById('ed-trackListItems');
  const waveformContainer = document.getElementById('ed-waveformContainer');
  const waveformLanes   = document.getElementById('ed-waveformLanes');
  const overlayLeft     = document.getElementById('ed-overlayLeft');
  const overlayRight    = document.getElementById('ed-overlayRight');
  const handleLeft      = document.getElementById('ed-handleLeft');
  const handleRight     = document.getElementById('ed-handleRight');
  const playheadEl      = document.getElementById('ed-playhead');
  const trimStartEl     = document.getElementById('ed-trimStart');
  const trimEndEl       = document.getElementById('ed-trimEnd');
  const trimDurEl       = document.getElementById('ed-trimDuration');
  const playToggle      = document.getElementById('ed-playToggle');
  const resetBtn        = document.getElementById('ed-resetBtn');
  const fadeToggle      = document.getElementById('ed-fadeToggle');
  const fadeControls    = document.getElementById('ed-fadeControls');
  const fadeInRange     = document.getElementById('ed-fadeIn');
  const fadeOutRange    = document.getElementById('ed-fadeOut');
  const fadeInVal       = document.getElementById('ed-fadeInVal');
  const fadeOutVal      = document.getElementById('ed-fadeOutVal');
  const exportBtn       = document.getElementById('ed-exportBtn');
  const progressWrap    = document.getElementById('ed-progressWrap');
  const progressFill    = document.getElementById('ed-progressFill');
  const progressTextEl  = document.getElementById('ed-progressText');
  const resultDiv       = document.getElementById('ed-result');
  const dlLink          = document.getElementById('ed-downloadLink');
  const resultInfo      = document.getElementById('ed-resultInfo');
  const audioPreview    = document.getElementById('ed-audioPreview');

  /* ── Track state ── */
  var TRACK_COLORS = ['#e94560', '#4ecca3', '#4285f4', '#ffa726', '#ab47bc', '#26c6da'];
  var tracks = [];
  var nextTrackId = 0;
  var totalDuration = 0;

  /* ── Trim state ── */
  var trimStartRatio = 0;
  var trimEndRatio = 1;

  /* ── Playhead state ── */
  var playheadRatio = 0;
  var isPlaying = false;
  var playCtx = null;
  var playStartTime = 0;
  var playStartRatio = 0;
  var playAnimId = null;

  function sp(pct, text) { setProgress(progressFill, progressTextEl, pct, text); }

  showGdriveSetupNotice(gdriveNotice);

  /* ═══════════════════════════════════════════════
     File upload
     ═══════════════════════════════════════════════ */

  uploadArea.addEventListener('click', function() { fileInput.click(); });
  uploadArea.addEventListener('dragover', function(e) { e.preventDefault(); uploadArea.classList.add('dragover'); });
  uploadArea.addEventListener('dragleave', function() { uploadArea.classList.remove('dragover'); });
  uploadArea.addEventListener('drop', function(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  });
  fileInput.addEventListener('change', function() {
    if (fileInput.files.length > 0) addFiles(fileInput.files);
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
        await addFiles(files);
      }
    } catch (err) {
      showError(errorBox, 'Google Drive import failed: ' + err.message);
    } finally {
      gdriveBtn.disabled = false;
      gdriveBtn.textContent = 'Import from Google Drive';
    }
  });

  async function addFiles(fileList) {
    hideError(errorBox);
    var actx = new (window.AudioContext || window.webkitAudioContext)();

    for (var i = 0; i < fileList.length; i++) {
      var file = fileList[i];
      if (!file.name.toLowerCase().endsWith('.mp3') && file.type !== 'audio/mpeg') continue;
      try {
        var arrayBuf = await file.arrayBuffer();
        var buffer = await actx.decodeAudioData(arrayBuf);
        var track = {
          id: nextTrackId++,
          file: file,
          buffer: buffer,
          name: file.name,
          color: TRACK_COLORS[tracks.length % TRACK_COLORS.length],
          volume: 1.0,
          pan: 0,
          canvas: null,
          gainNode: null,
          panNode: null,
          sourceNode: null
        };
        tracks.push(track);
      } catch (err) {
        showError(errorBox, 'Failed to decode ' + file.name + ': ' + err.message);
      }
    }

    actx.close();
    recalcDuration();

    if (tracks.length > 0) {
      workspace.classList.add('active');
      uploadArea.classList.add('has-file');
      trackListEl.style.display = 'block';
    }

    fileNameEl.textContent = tracks.length + ' track' + (tracks.length !== 1 ? 's' : '') + ' loaded';
    trackCountEl.textContent = tracks.length;

    buildTrackListUI();
    buildWaveformLanes();
    drawAllWaveforms();
    updateTrimUI();
    updatePlayheadUI();
    resultDiv.classList.remove('active');
    dispatchSeparatorEvent();
  }

  function removeTrack(trackId) {
    tracks = tracks.filter(function(t) { return t.id !== trackId; });
    recalcDuration();

    if (tracks.length === 0) {
      workspace.classList.remove('active');
      uploadArea.classList.remove('has-file');
      trackListEl.style.display = 'none';
      fileNameEl.textContent = '';
      stopPlayback();
    } else {
      fileNameEl.textContent = tracks.length + ' track' + (tracks.length !== 1 ? 's' : '') + ' loaded';
    }

    trackCountEl.textContent = tracks.length;
    buildTrackListUI();
    buildWaveformLanes();
    drawAllWaveforms();
    updateTrimUI();
    updatePlayheadUI();
    dispatchSeparatorEvent();
  }

  function recalcDuration() {
    totalDuration = 0;
    for (var i = 0; i < tracks.length; i++) {
      if (tracks[i].buffer.duration > totalDuration) {
        totalDuration = tracks[i].buffer.duration;
      }
    }
  }

  /* ═══════════════════════════════════════════════
     Track list UI
     ═══════════════════════════════════════════════ */

  function buildTrackListUI() {
    trackListItems.innerHTML = '';

    for (var i = 0; i < tracks.length; i++) {
      (function(track) {
        var li = document.createElement('li');
        li.className = 'track-row';
        li.dataset.trackId = track.id;
        li.style.setProperty('--track-color', track.color);

        // Header row
        var header = document.createElement('div');
        header.className = 'track-header';

        var dot = document.createElement('span');
        dot.className = 'track-color-dot';
        header.appendChild(dot);

        var name = document.createElement('span');
        name.className = 'track-name';
        name.textContent = track.name.replace(/\.mp3$/i, '');
        name.title = track.name;
        header.appendChild(name);

        var removeBtn = document.createElement('button');
        removeBtn.className = 'track-remove-btn';
        removeBtn.textContent = '\u00d7';
        removeBtn.title = 'Remove track';
        removeBtn.addEventListener('click', function() { removeTrack(track.id); });
        header.appendChild(removeBtn);

        li.appendChild(header);

        // Controls row
        var controls = document.createElement('div');
        controls.className = 'track-controls';

        // Volume
        var volLabel = document.createElement('label');
        volLabel.textContent = 'Vol';
        controls.appendChild(volLabel);

        var volSlider = document.createElement('input');
        volSlider.type = 'range';
        volSlider.className = 'track-vol';
        volSlider.min = '0';
        volSlider.max = '150';
        volSlider.value = String(Math.round(track.volume * 100));
        volSlider.step = '1';
        controls.appendChild(volSlider);

        var volVal = document.createElement('span');
        volVal.className = 'track-vol-val';
        volVal.textContent = Math.round(track.volume * 100) + '%';
        controls.appendChild(volVal);

        volSlider.addEventListener('input', function() {
          track.volume = parseInt(volSlider.value) / 100;
          volVal.textContent = volSlider.value + '%';
          if (track.gainNode) {
            track.gainNode.gain.value = track.volume;
          }
        });

        // Pan
        var panLabel = document.createElement('label');
        panLabel.textContent = 'Pan';
        controls.appendChild(panLabel);

        var panSlider = document.createElement('input');
        panSlider.type = 'range';
        panSlider.className = 'track-pan';
        panSlider.min = '-100';
        panSlider.max = '100';
        panSlider.value = String(Math.round(track.pan * 100));
        panSlider.step = '1';
        controls.appendChild(panSlider);

        var panVal = document.createElement('span');
        panVal.className = 'track-pan-val';
        panVal.textContent = formatPan(track.pan);
        controls.appendChild(panVal);

        panSlider.addEventListener('input', function() {
          track.pan = parseInt(panSlider.value) / 100;
          panVal.textContent = formatPan(track.pan);
          if (track.panNode) {
            track.panNode.pan.value = track.pan;
          }
        });

        li.appendChild(controls);
        trackListItems.appendChild(li);
      })(tracks[i]);
    }
  }

  function formatPan(pan) {
    var pct = Math.round(pan * 100);
    if (pct === 0) return 'C';
    if (pct < 0) return Math.abs(pct) + 'L';
    return pct + 'R';
  }

  /* ═══════════════════════════════════════════════
     Waveform lanes
     ═══════════════════════════════════════════════ */

  function buildWaveformLanes() {
    waveformLanes.innerHTML = '';
    for (var i = 0; i < tracks.length; i++) {
      var lane = document.createElement('div');
      lane.className = 'waveform-lane';
      lane.dataset.trackId = tracks[i].id;

      var canvas = document.createElement('canvas');
      canvas.className = 'lane-canvas';
      lane.appendChild(canvas);

      waveformLanes.appendChild(lane);
      tracks[i].canvas = canvas;
    }
  }

  function drawAllWaveforms() {
    for (var i = 0; i < tracks.length; i++) {
      drawTrackWaveform(tracks[i]);
    }
  }

  function drawTrackWaveform(track) {
    var canvas = track.canvas;
    if (!canvas) return;
    var tCtx = canvas.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    tCtx.scale(dpr, dpr);

    var w = rect.width;
    var h = rect.height;
    var mid = h / 2;
    var data = track.buffer.getChannelData(0);

    // This track occupies (track.buffer.duration / totalDuration) of the canvas width
    var trackWidthPx = totalDuration > 0 ? (track.buffer.duration / totalDuration) * w : w;
    var step = Math.max(1, Math.floor(data.length / trackWidthPx));

    tCtx.clearRect(0, 0, w, h);

    // Center line
    tCtx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    tCtx.lineWidth = 1;
    tCtx.beginPath();
    tCtx.moveTo(0, mid);
    tCtx.lineTo(w, mid);
    tCtx.stroke();

    // Waveform bars
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
      tCtx.fillStyle = track.color;
      tCtx.fillRect(x, top, 1, bottom - top || 1);
    }

    // Time markers
    tCtx.fillStyle = '#4a4a5e';
    tCtx.font = '10px Inter, sans-serif';
    var numMarkers = Math.min(10, Math.floor(totalDuration));
    if (numMarkers > 0) {
      var interval = totalDuration / numMarkers;
      for (var i = 0; i <= numMarkers; i++) {
        var t = i * interval;
        var xm = (t / totalDuration) * w;
        tCtx.fillRect(xm, h - 12, 1, 4);
        tCtx.fillText(fmtTime(t), xm + 2, h - 2);
      }
    }
  }

  /* ── Time formatting ── */
  function fmtTime(sec) {
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ':' + s.toFixed(1).padStart(4, '0');
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

  // Click on waveform container = seek
  waveformContainer.addEventListener('click', function(e) {
    if (tracks.length === 0) return;
    var rect = waveformContainer.getBoundingClientRect();
    var ratio = (e.clientX - rect.left) / rect.width;
    seekTo(ratio);
  });

  // Draggable playhead
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
      // If playing, restart from new position
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
     Playback — Web Audio mixing graph
     ═══════════════════════════════════════════════ */

  function stopPlayback() {
    for (var i = 0; i < tracks.length; i++) {
      if (tracks[i].sourceNode) {
        try { tracks[i].sourceNode.stop(); } catch (_) {}
        tracks[i].sourceNode = null;
      }
      tracks[i].gainNode = null;
      tracks[i].panNode = null;
    }
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
    if (tracks.length === 0) return;
    stopPlayback();

    playCtx = new (window.AudioContext || window.webkitAudioContext)();

    var startTimeSec = playheadRatio * totalDuration;
    var endTimeSec = trimEndRatio * totalDuration;
    var playDuration = endTimeSec - startTimeSec;
    if (playDuration <= 0) return;

    for (var i = 0; i < tracks.length; i++) {
      var track = tracks[i];

      var source = playCtx.createBufferSource();
      source.buffer = track.buffer;

      var gain = playCtx.createGain();
      gain.gain.value = track.volume;

      var panner = playCtx.createStereoPanner();
      panner.pan.value = track.pan;

      source.connect(gain);
      gain.connect(panner);
      panner.connect(playCtx.destination);

      track.sourceNode = source;
      track.gainNode = gain;
      track.panNode = panner;

      if (startTimeSec < track.buffer.duration) {
        var trackPlayDuration = Math.min(playDuration, track.buffer.duration - startTimeSec);
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
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  }

  playToggle.addEventListener('click', togglePlayback);

  // Spacebar to toggle play/stop
  document.addEventListener('keydown', function(e) {
    if (e.code === 'Space' && !e.repeat) {
      var tag = document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return;
      if (!document.getElementById('tab-editor').classList.contains('active')) return;
      if (tracks.length === 0) return;
      e.preventDefault();
      togglePlayback();
    }
  });

  /* ═══════════════════════════════════════════════
     Export — mix all tracks to stereo MP3
     ═══════════════════════════════════════════════ */

  exportBtn.addEventListener('click', async function() {
    if (tracks.length === 0) return;

    hideError(errorBox);
    exportBtn.disabled = true;
    exportBtn.textContent = 'Exporting...';
    resultDiv.classList.remove('active');
    progressWrap.classList.add('active');
    sp(5, 'Preparing mix...');

    try {
      var sampleRate = tracks[0].buffer.sampleRate;
      var numChannels = 2; // Always stereo for pan support
      var totalSamples = Math.floor(totalDuration * sampleRate);

      var trimStartSample = Math.floor(trimStartRatio * totalSamples);
      var trimEndSample = Math.floor(trimEndRatio * totalSamples);
      var outputLength = trimEndSample - trimStartSample;
      if (outputLength <= 0) {
        showError(errorBox, 'Trim selection is empty.');
        exportBtn.disabled = false;
        exportBtn.textContent = 'Export Mixed MP3';
        progressWrap.classList.remove('active');
        return;
      }

      sp(10, 'Mixing ' + tracks.length + ' track' + (tracks.length !== 1 ? 's' : '') + '...');

      var outLeft = new Float32Array(outputLength);
      var outRight = new Float32Array(outputLength);

      for (var t = 0; t < tracks.length; t++) {
        var track = tracks[t];
        var vol = track.volume;
        var pan = track.pan;

        // Equal-power pan law to match Web Audio StereoPannerNode
        var theta = (pan + 1) * Math.PI / 4;
        var leftGain = vol * Math.cos(theta);
        var rightGain = vol * Math.sin(theta);

        var buf = track.buffer;
        var srcLeft = buf.getChannelData(0);
        var srcRight = buf.numberOfChannels >= 2 ? buf.getChannelData(1) : srcLeft;
        var trackSamples = buf.length;

        for (var i = 0; i < outputLength; i++) {
          var globalIdx = trimStartSample + i;
          if (globalIdx < trackSamples) {
            outLeft[i] += srcLeft[globalIdx] * leftGain;
            outRight[i] += srcRight[globalIdx] * rightGain;
          }
        }

        sp(10 + Math.floor(((t + 1) / tracks.length) * 20),
          'Mixed track ' + (t + 1) + '/' + tracks.length);
      }

      // Apply fade in/out
      sp(30, 'Applying fades...');
      var fadeInSec = parseFloat(fadeInRange.value) || 0;
      var fadeOutSec = parseFloat(fadeOutRange.value) || 0;
      var fadeInSamples = Math.floor(fadeInSec * sampleRate);
      var fadeOutSamples = Math.floor(fadeOutSec * sampleRate);

      for (var i = 0; i < outputLength; i++) {
        var mult = 1;
        if (i < fadeInSamples) mult = i / fadeInSamples;
        if (i >= outputLength - fadeOutSamples) {
          mult = Math.min(mult, (outputLength - i) / fadeOutSamples);
        }
        if (mult < 1) {
          outLeft[i] *= mult;
          outRight[i] *= mult;
        }
      }

      // Clamp to prevent clipping
      for (var i = 0; i < outputLength; i++) {
        if (outLeft[i] > 1) outLeft[i] = 1;
        else if (outLeft[i] < -1) outLeft[i] = -1;
        if (outRight[i] > 1) outRight[i] = 1;
        else if (outRight[i] < -1) outRight[i] = -1;
      }

      sp(35, 'Encoding to MP3...');

      var channels = [outLeft, outRight];
      var mp3Data = await encodeMP3(channels, sampleRate, numChannels, outputLength, function(ratio) {
        sp(35 + Math.floor(ratio * 60), 'Encoding to MP3... ' + Math.floor(ratio * 100) + '%');
      });

      sp(96, 'Finalizing...');

      var blob = new Blob(mp3Data, { type: 'audio/mpeg' });
      var url = URL.createObjectURL(blob);
      var outName = tracks.length === 1
        ? tracks[0].name.replace(/\.mp3$/i, '') + '_edited.mp3'
        : 'mix_' + tracks.length + '_tracks.mp3';

      dlLink.href = url;
      dlLink.download = outName;
      audioPreview.src = url;

      var durationSec = outputLength / sampleRate;
      var mins = Math.floor(durationSec / 60);
      var secs = Math.floor(durationSec % 60);
      resultInfo.textContent = outName + ' \u2014 ' + formatSize(blob.size) +
        ' \u2014 ' + mins + 'm ' + secs + 's' +
        ' \u2014 ' + tracks.length + ' track' + (tracks.length !== 1 ? 's' : '');

      sp(100, 'Done!');
      resultDiv.classList.add('active');
    } catch (err) {
      console.error(err);
      showError(errorBox, 'Export failed: ' + err.message);
    } finally {
      exportBtn.disabled = false;
      exportBtn.textContent = 'Export Mixed MP3';
      setTimeout(function() { progressWrap.classList.remove('active'); }, 1500);
    }
  });

  /* ═══════════════════════════════════════════════
     Separator integration
     ═══════════════════════════════════════════════ */

  function dispatchSeparatorEvent() {
    if (tracks.length === 1) {
      window.dispatchEvent(new CustomEvent('editor-file-loaded', {
        detail: { file: tracks[0].file, audioBuffer: tracks[0].buffer, fileName: tracks[0].name }
      }));
    } else {
      window.dispatchEvent(new CustomEvent('editor-file-loaded', {
        detail: { file: null, audioBuffer: null, fileName: '', multiTrack: true }
      }));
    }
  }

  /* ═══════════════════════════════════════════════
     Redraw on resize
     ═══════════════════════════════════════════════ */

  var resizeTimer;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {
      if (tracks.length > 0) {
        drawAllWaveforms();
        updateTrimUI();
        updatePlayheadUI();
      }
    }, 150);
  });
})();
