/* ═══════════════════════════════════════════════
   Backing Track Generator
   ─────────────────────────────────────────────
   Synthesises drum, bass, and chord-pad backing
   tracks in pure JavaScript. Generated audio is
   injected into the editor's File Library via
   window.addSyntheticToLibrary().
   ═══════════════════════════════════════════════ */
(function backingTracksModule() {
  var SAMPLE_RATE = 44100;

  /* ═══════════════════════════════════════════════
     Music Theory Helpers
     ═══════════════════════════════════════════════ */

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  var NOTE_TO_MIDI = {
    'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
    'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11
  };

  var SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10]
  };

  var MAJOR_CHORD_TYPES = ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim'];
  var MINOR_CHORD_TYPES = ['min', 'dim', 'maj', 'min', 'min', 'maj', 'maj'];

  var CHORD_INTERVALS = {
    'maj': [0, 4, 7],
    'min': [0, 3, 7],
    'dim': [0, 3, 6]
  };

  var PROGRESSIONS = {
    'I-V-vi-IV':  [1, 5, 6, 4],
    'I-IV-V-I':   [1, 4, 5, 1],
    'I-vi-IV-V':  [1, 6, 4, 5],
    'I-IV-vi-V':  [1, 4, 6, 5],
    'vi-IV-I-V':  [6, 4, 1, 5],
    'ii-V-I':     [2, 5, 1, 1]
  };

  function getChordMidi(rootNote, scale, scaleDegree, octave) {
    var intervals = SCALES[scale];
    var rootMidi = NOTE_TO_MIDI[rootNote] + (octave + 1) * 12; // C1 = MIDI 24
    var degreeIdx = (scaleDegree - 1) % intervals.length;
    var chordRoot = rootMidi + intervals[degreeIdx];

    var chordTypes = scale === 'major' ? MAJOR_CHORD_TYPES : MINOR_CHORD_TYPES;
    var chordType = chordTypes[degreeIdx];
    var ci = CHORD_INTERVALS[chordType];

    return [chordRoot + ci[0], chordRoot + ci[1], chordRoot + ci[2]];
  }

  /* ═══════════════════════════════════════════════
     Buffer Helpers
     ═══════════════════════════════════════════════ */

  function mixInto(output, sample, startPos, velocity) {
    var vel = typeof velocity === 'number' ? velocity : 1.0;
    for (var i = 0; i < sample.length; i++) {
      var pos = startPos + i;
      if (pos >= output.length) break;
      output[pos] += sample[i] * vel;
    }
  }

  function createStereoBuffer(monoData) {
    var ctx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(2, monoData.length, SAMPLE_RATE);
    var buffer = ctx.createBuffer(2, monoData.length, SAMPLE_RATE);
    buffer.getChannelData(0).set(monoData);
    buffer.getChannelData(1).set(monoData);
    return buffer;
  }

  function clampBuffer(data) {
    for (var i = 0; i < data.length; i++) {
      if (data[i] > 1) data[i] = 1;
      else if (data[i] < -1) data[i] = -1;
    }
  }

  /* ═══════════════════════════════════════════════
     Drum Synthesis
     ═══════════════════════════════════════════════ */

  function synthKick() {
    var dur = 0.5;
    var len = Math.floor(SAMPLE_RATE * dur);
    var out = new Float32Array(len);
    for (var i = 0; i < len; i++) {
      var t = i / SAMPLE_RATE;
      var freq = 60 + 90 * Math.exp(-t * 25);
      var phase = 2 * Math.PI * (60 * t + (90 / 25) * (1 - Math.exp(-t * 25)));
      out[i] = Math.sin(phase) * Math.exp(-t * 7) * 0.9;
    }
    return out;
  }

  function synthSnare() {
    var dur = 0.3;
    var len = Math.floor(SAMPLE_RATE * dur);
    var out = new Float32Array(len);
    for (var i = 0; i < len; i++) {
      var t = i / SAMPLE_RATE;
      var tone = Math.sin(2 * Math.PI * 200 * t) * Math.exp(-t * 30) * 0.5;
      var noise = (Math.random() * 2 - 1) * Math.exp(-t * 15) * 0.6;
      out[i] = tone + noise;
    }
    return out;
  }

  function synthHiHat() {
    var dur = 0.08;
    var len = Math.floor(SAMPLE_RATE * dur);
    var out = new Float32Array(len);
    var prev = 0;
    for (var i = 0; i < len; i++) {
      var t = i / SAMPLE_RATE;
      var noise = (Math.random() * 2 - 1);
      var hp = noise - prev;
      prev = noise * 0.3;
      out[i] = hp * Math.exp(-t * 60) * 0.3;
    }
    return out;
  }

  function synthOpenHat() {
    var dur = 0.25;
    var len = Math.floor(SAMPLE_RATE * dur);
    var out = new Float32Array(len);
    var prev = 0;
    for (var i = 0; i < len; i++) {
      var t = i / SAMPLE_RATE;
      var noise = (Math.random() * 2 - 1);
      var hp = noise - prev;
      prev = noise * 0.3;
      out[i] = hp * Math.exp(-t * 12) * 0.3;
    }
    return out;
  }

  /* ── Drum Patterns (16-step grid = one bar of 16th notes) ── */

  var DRUM_PATTERNS = {
    'Basic Rock': {
      kick:   [1,0,0,0, 0,0,0,0, 1,0,1,0, 0,0,0,0],
      snare:  [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      hihat:  [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0]
    },
    'Four on the Floor': {
      kick:   [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
      snare:  [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      hihat:  [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0]
    },
    'Hip Hop': {
      kick:   [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0],
      snare:  [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1],
      hihat:  [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1]
    },
    'Shuffle': {
      kick:   [1,0,0,1, 0,0,1,0, 0,1,0,0, 1,0,0,0],
      snare:  [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      hihat:  [1,0,1,1, 0,1,1,0, 1,1,0,1, 1,0,1,0]
    },
    'Reggaeton': {
      kick:   [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,0,1,0],
      snare:  [0,0,0,1, 0,0,0,0, 0,0,0,1, 0,0,0,0],
      hihat:  [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1]
    },
    'Halftime': {
      kick:   [1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      snare:  [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
      hihat:  [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0]
    }
  };

  function renderDrumTrack(bpm, patternName, durationSec) {
    var pattern = DRUM_PATTERNS[patternName] || DRUM_PATTERNS['Basic Rock'];
    var totalSamples = Math.floor(SAMPLE_RATE * durationSec);
    var output = new Float32Array(totalSamples);

    var kickSample = synthKick();
    var snareSample = synthSnare();
    var hihatSample = synthHiHat();

    var sixteenthDur = 60 / (bpm * 4);
    var samplesPerStep = Math.floor(sixteenthDur * SAMPLE_RATE);
    var totalSteps = Math.floor(durationSec / sixteenthDur);

    for (var step = 0; step < totalSteps; step++) {
      var idx = step % 16;
      var pos = step * samplesPerStep;
      if (pattern.kick[idx])  mixInto(output, kickSample, pos, pattern.kick[idx]);
      if (pattern.snare[idx]) mixInto(output, snareSample, pos, pattern.snare[idx]);
      if (pattern.hihat[idx]) mixInto(output, hihatSample, pos, pattern.hihat[idx]);
    }

    clampBuffer(output);
    return createStereoBuffer(output);
  }

  /* ═══════════════════════════════════════════════
     Bass Synthesis
     ═══════════════════════════════════════════════ */

  function synthBassNote(midi, duration) {
    var freq = midiToFreq(midi);
    var len = Math.floor(SAMPLE_RATE * duration);
    var out = new Float32Array(len);
    var phase = 0;
    var phaseInc = freq / SAMPLE_RATE;

    for (var i = 0; i < len; i++) {
      var t = i / SAMPLE_RATE;
      // Band-limited sawtooth (first 6 harmonics)
      var sample = 0;
      for (var h = 1; h <= 6; h++) {
        if (freq * h > SAMPLE_RATE * 0.45) break;
        sample += Math.sin(2 * Math.PI * phase * h) / h;
      }
      sample *= (2 / Math.PI);

      // Envelope
      var attack = 0.01, release = 0.05;
      var env;
      if (t < attack) env = t / attack;
      else if (t > duration - release) env = Math.max(0, (duration - t) / release);
      else env = 1.0;

      out[i] = sample * env * 0.7;
      phase += phaseInc;
      if (phase >= 1) phase -= 1;
    }

    // One-pole low-pass
    var cutoff = Math.min(freq * 4, 2000);
    var rc = 1.0 / (2 * Math.PI * cutoff);
    var dt = 1.0 / SAMPLE_RATE;
    var alpha = dt / (rc + dt);
    var prev = 0;
    for (var i = 0; i < len; i++) {
      out[i] = prev + alpha * (out[i] - prev);
      prev = out[i];
    }

    return out;
  }

  var BASS_PATTERNS = {
    'Root Notes': function(beats, roots) {
      var notes = [];
      for (var i = 0; i < beats.length; i++) {
        notes.push({ time: beats[i], midi: roots[i], dur: 0.4 });
      }
      return notes;
    },
    'Root + Fifth': function(beats, roots) {
      var notes = [];
      for (var i = 0; i < beats.length; i++) {
        notes.push({ time: beats[i], midi: roots[i], dur: 0.25 });
        var half = (i + 1 < beats.length) ? (beats[i + 1] - beats[i]) / 2 : 0.25;
        notes.push({ time: beats[i] + half, midi: roots[i] + 7, dur: 0.2 });
      }
      return notes;
    },
    'Walking': function(beats, roots) {
      var notes = [];
      for (var i = 0; i < beats.length; i++) {
        notes.push({ time: beats[i], midi: roots[i], dur: 0.22 });
        if (i + 1 < beats.length) {
          var beatDur = beats[i + 1] - beats[i];
          var approach = roots[i + 1] + (Math.random() > 0.5 ? -1 : 1);
          notes.push({ time: beats[i] + beatDur * 0.75, midi: approach, dur: 0.15 });
        }
      }
      return notes;
    },
    'Eighth Notes': function(beats, roots) {
      var notes = [];
      for (var i = 0; i < beats.length; i++) {
        var beatDur = (i + 1 < beats.length) ? beats[i + 1] - beats[i] : 0.5;
        notes.push({ time: beats[i], midi: roots[i], dur: beatDur * 0.45 });
        notes.push({ time: beats[i] + beatDur * 0.5, midi: roots[i], dur: beatDur * 0.4 });
      }
      return notes;
    }
  };

  function renderBassTrack(bpm, rootNote, scale, patternName, progression, durationSec) {
    var totalSamples = Math.floor(SAMPLE_RATE * durationSec);
    var output = new Float32Array(totalSamples);

    var beatDur = 60 / bpm;
    var barDur = 4 * beatDur;
    var totalBars = Math.ceil(durationSec / barDur);

    var beats = [];
    var roots = [];

    for (var bar = 0; bar < totalBars; bar++) {
      var degree = progression[bar % progression.length];
      var chord = getChordMidi(rootNote, scale, degree, 2);
      for (var beat = 0; beat < 4; beat++) {
        var time = bar * barDur + beat * beatDur;
        if (time >= durationSec) break;
        beats.push(time);
        roots.push(chord[0]);
      }
    }

    var patternFn = BASS_PATTERNS[patternName] || BASS_PATTERNS['Root Notes'];
    var notes = patternFn(beats, roots);

    for (var n = 0; n < notes.length; n++) {
      if (notes[n].time >= durationSec) continue;
      var noteSample = synthBassNote(notes[n].midi, notes[n].dur);
      mixInto(output, noteSample, Math.floor(notes[n].time * SAMPLE_RATE), 1.0);
    }

    clampBuffer(output);
    return createStereoBuffer(output);
  }

  /* ═══════════════════════════════════════════════
     Chord Pad Synthesis
     ═══════════════════════════════════════════════ */

  function synthPadChord(midiNotes, duration) {
    var len = Math.floor(SAMPLE_RATE * duration);
    var out = new Float32Array(len);

    for (var v = 0; v < midiNotes.length; v++) {
      var freq = midiToFreq(midiNotes[v]);

      // Two detuned oscillators per voice for warmth
      for (var detune = -1; detune <= 1; detune += 2) {
        var f = freq * Math.pow(2, detune * 5 / 1200);
        var startPhase = Math.random() * 2 * Math.PI;

        for (var i = 0; i < len; i++) {
          var t = i / SAMPLE_RATE;

          // Band-limited sawtooth (8 harmonics)
          var sample = 0;
          for (var h = 1; h <= 8; h++) {
            if (f * h > SAMPLE_RATE * 0.45) break;
            sample += Math.sin(2 * Math.PI * f * h * t + startPhase * h) / h;
          }
          sample *= (2 / Math.PI);

          // ADSR envelope
          var attack = 0.15, decay = 0.1, sustain = 0.7, release = 0.2;
          var env;
          if (t < attack) env = t / attack;
          else if (t < attack + decay) env = 1.0 - (1.0 - sustain) * ((t - attack) / decay);
          else if (t > duration - release) env = sustain * Math.max(0, (duration - t) / release);
          else env = sustain;

          out[i] += sample * env * 0.12;
        }
      }
    }

    // Low-pass for warmth
    var rc = 1.0 / (2 * Math.PI * 3000);
    var dt = 1.0 / SAMPLE_RATE;
    var alpha = dt / (rc + dt);
    var prev = 0;
    for (var i = 0; i < len; i++) {
      out[i] = prev + alpha * (out[i] - prev);
      prev = out[i];
    }

    return out;
  }

  function renderPadTrack(bpm, rootNote, scale, progressionName, durationSec) {
    var totalSamples = Math.floor(SAMPLE_RATE * durationSec);
    var output = new Float32Array(totalSamples);

    var barDur = 4 * (60 / bpm);
    var totalBars = Math.ceil(durationSec / barDur);
    var progression = PROGRESSIONS[progressionName] || PROGRESSIONS['I-V-vi-IV'];

    for (var bar = 0; bar < totalBars; bar++) {
      var degree = progression[bar % progression.length];
      var chord = getChordMidi(rootNote, scale, degree, 4);
      var barStart = bar * barDur;
      var chordDur = Math.min(barDur, durationSec - barStart);
      if (chordDur <= 0) break;

      var chordSample = synthPadChord(chord, chordDur);
      mixInto(output, chordSample, Math.floor(barStart * SAMPLE_RATE), 1.0);
    }

    clampBuffer(output);
    return createStereoBuffer(output);
  }

  /* ═══════════════════════════════════════════════
     UI: Collapsible Generator Panel
     ═══════════════════════════════════════════════ */

  function buildUI() {
    var panelHeader = document.querySelector('.file-panel-header');
    if (!panelHeader) return;

    var section = document.createElement('div');
    section.className = 'bt-section';
    section.innerHTML = [
      '<div class="bt-header" id="bt-toggle">',
      '  <span class="bt-header-icon">\u2699</span>',
      '  <span class="bt-header-text">Generate Backing Track</span>',
      '  <span class="bt-header-arrow" id="bt-arrow">\u25BC</span>',
      '</div>',
      '<div class="bt-body" id="bt-body" style="display:none;">',
      '  <div class="bt-row">',
      '    <label>Instrument</label>',
      '    <select id="bt-instrument">',
      '      <option value="drums">Drums</option>',
      '      <option value="bass">Bass</option>',
      '      <option value="pad">Chord Pad</option>',
      '    </select>',
      '  </div>',
      '  <div class="bt-row">',
      '    <label>BPM</label>',
      '    <div class="bt-bpm-row">',
      '      <input type="number" id="bt-bpm" min="40" max="240" value="120">',
      '      <button id="bt-autoDetect" title="Auto-detect from library">Auto</button>',
      '    </div>',
      '  </div>',
      '  <div class="bt-row">',
      '    <label>Key</label>',
      '    <div class="bt-key-row">',
      '      <select id="bt-key">',
      '        <option>C</option><option>C#</option><option>D</option>',
      '        <option>D#</option><option>E</option><option>F</option>',
      '        <option>F#</option><option>G</option><option>G#</option>',
      '        <option>A</option><option>A#</option><option>B</option>',
      '      </select>',
      '      <select id="bt-scale">',
      '        <option value="major">Major</option>',
      '        <option value="minor">Minor</option>',
      '      </select>',
      '    </div>',
      '  </div>',
      '  <div class="bt-row" id="bt-patternRow">',
      '    <label>Pattern</label>',
      '    <select id="bt-pattern"></select>',
      '  </div>',
      '  <div class="bt-row" id="bt-progressionRow" style="display:none;">',
      '    <label>Progression</label>',
      '    <select id="bt-progression">',
      '      <option value="I-V-vi-IV">I - V - vi - IV</option>',
      '      <option value="I-IV-V-I">I - IV - V - I</option>',
      '      <option value="I-vi-IV-V">I - vi - IV - V</option>',
      '      <option value="I-IV-vi-V">I - IV - vi - V</option>',
      '      <option value="vi-IV-I-V">vi - IV - I - V</option>',
      '      <option value="ii-V-I">ii - V - I</option>',
      '    </select>',
      '  </div>',
      '  <div class="bt-row">',
      '    <label>Duration</label>',
      '    <div class="bt-dur-row">',
      '      <input type="range" id="bt-duration" min="4" max="120" step="4" value="16">',
      '      <span id="bt-durVal">16s</span>',
      '    </div>',
      '  </div>',
      '  <button class="bt-generate-btn" id="bt-generateBtn">Generate</button>',
      '  <div class="bt-status" id="bt-status"></div>',
      '</div>'
    ].join('\n');

    panelHeader.parentNode.insertBefore(section, panelHeader.nextSibling);

    /* ── References ── */
    var toggle = document.getElementById('bt-toggle');
    var body = document.getElementById('bt-body');
    var arrow = document.getElementById('bt-arrow');
    var instrumentSel = document.getElementById('bt-instrument');
    var bpmInput = document.getElementById('bt-bpm');
    var autoDetectBtn = document.getElementById('bt-autoDetect');
    var keySel = document.getElementById('bt-key');
    var scaleSel = document.getElementById('bt-scale');
    var patternSel = document.getElementById('bt-pattern');
    var patternRow = document.getElementById('bt-patternRow');
    var progressionSel = document.getElementById('bt-progression');
    var progressionRow = document.getElementById('bt-progressionRow');
    var durationRange = document.getElementById('bt-duration');
    var durVal = document.getElementById('bt-durVal');
    var generateBtn = document.getElementById('bt-generateBtn');
    var statusEl = document.getElementById('bt-status');

    var collapsed = true;

    /* ── Collapse toggle ── */
    toggle.addEventListener('click', function() {
      collapsed = !collapsed;
      body.style.display = collapsed ? 'none' : 'block';
      arrow.innerHTML = collapsed ? '\u25BC' : '\u25B2';
    });

    /* ── Populate pattern options based on instrument ── */
    function updatePatternOptions() {
      var inst = instrumentSel.value;
      patternSel.innerHTML = '';

      if (inst === 'drums') {
        patternRow.style.display = '';
        progressionRow.style.display = 'none';
        var names = Object.keys(DRUM_PATTERNS);
        for (var i = 0; i < names.length; i++) {
          var opt = document.createElement('option');
          opt.value = names[i];
          opt.textContent = names[i];
          patternSel.appendChild(opt);
        }
      } else if (inst === 'bass') {
        patternRow.style.display = '';
        progressionRow.style.display = '';
        var names = Object.keys(BASS_PATTERNS);
        for (var i = 0; i < names.length; i++) {
          var opt = document.createElement('option');
          opt.value = names[i];
          opt.textContent = names[i];
          patternSel.appendChild(opt);
        }
      } else if (inst === 'pad') {
        patternRow.style.display = 'none';
        progressionRow.style.display = '';
      }
    }

    instrumentSel.addEventListener('change', updatePatternOptions);
    updatePatternOptions();

    /* ── Duration slider feedback ── */
    durationRange.addEventListener('input', function() {
      durVal.textContent = durationRange.value + 's';
    });

    /* ── Auto-detect BPM/Key from library files ── */
    autoDetectBtn.addEventListener('click', function() {
      var meta = document.querySelector('.file-panel-meta');
      if (!meta) {
        showStatus('No files in library to detect from', 'var(--accent-primary)');
        return;
      }
      var text = meta.textContent;
      var bpmMatch = text.match(/(\d+)\s*BPM/);
      var keyMatch = text.match(/BPM\s*[\u2022\u00B7]\s*([A-G]#?)\s*(major|minor)/i);
      if (bpmMatch) bpmInput.value = bpmMatch[1];
      if (keyMatch) {
        keySel.value = keyMatch[1];
        scaleSel.value = keyMatch[2].toLowerCase();
      }
      if (bpmMatch || keyMatch) {
        showStatus('Detected from library', 'var(--accent-green)');
      } else {
        showStatus('No analysis data found', 'var(--accent-primary)');
      }
    });

    function showStatus(text, color) {
      statusEl.textContent = text;
      statusEl.style.color = color || 'var(--text-secondary)';
      setTimeout(function() { statusEl.textContent = ''; }, 4000);
    }

    /* ── Generate ── */
    generateBtn.addEventListener('click', function() {
      var inst = instrumentSel.value;
      var bpm = parseInt(bpmInput.value) || 120;
      var rootNote = keySel.value;
      var scale = scaleSel.value;
      var duration = parseInt(durationRange.value) || 16;

      if (bpm < 40 || bpm > 240) {
        showStatus('BPM must be between 40 and 240', 'var(--accent-primary)');
        return;
      }

      generateBtn.disabled = true;
      generateBtn.textContent = 'Generating...';
      statusEl.textContent = 'Synthesizing ' + inst + '...';
      statusEl.style.color = 'var(--text-secondary)';

      // Allow UI to update before synchronous synthesis
      setTimeout(function() {
        try {
          var buffer, name;

          if (inst === 'drums') {
            var pattern = patternSel.value;
            buffer = renderDrumTrack(bpm, pattern, duration);
            name = 'Drums_' + pattern.replace(/\s+/g, '') + '_' + bpm + 'bpm.wav';
          } else if (inst === 'bass') {
            var pattern = patternSel.value;
            var progName = progressionSel.value;
            var progression = PROGRESSIONS[progName] || PROGRESSIONS['I-V-vi-IV'];
            buffer = renderBassTrack(bpm, rootNote, scale, pattern, progression, duration);
            name = 'Bass_' + rootNote + scale + '_' + bpm + 'bpm.wav';
          } else if (inst === 'pad') {
            var progName = progressionSel.value;
            buffer = renderPadTrack(bpm, rootNote, scale, progName, duration);
            name = 'Pad_' + rootNote + scale + '_' + bpm + 'bpm.wav';
          }

          if (buffer && window.addSyntheticToLibrary) {
            window.addSyntheticToLibrary(name, buffer);
            showStatus('Added to library!', 'var(--accent-green)');
          } else {
            showStatus('Error: library bridge not available', 'var(--accent-primary)');
          }
        } catch (err) {
          console.error('Backing track generation failed:', err);
          showStatus('Error: ' + err.message, 'var(--accent-primary)');
        } finally {
          generateBtn.disabled = false;
          generateBtn.textContent = 'Generate';
        }
      }, 50);
    });
  }

  /* ── Init ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildUI);
  } else {
    buildUI();
  }
})();
