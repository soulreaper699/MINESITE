/**
 * VOXEL Audio Engine — Web Audio API
 * All sounds synthesized in-browser. Zero external files. Zero CORS issues.
 */
(function() {
  'use strict';

  let _ctx = null;
  const getCtx = () => {
    if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (_ctx.state === 'suspended') _ctx.resume();
    return _ctx;
  };

  // =========================================================
  // Core Helpers
  // =========================================================
  function tone(freq, type, dur, vol = 0.25, delay = 0, freqEnd = null) {
    const ac = getCtx();
    const osc  = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain); gain.connect(ac.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime + delay);
    if (freqEnd) osc.frequency.linearRampToValueAtTime(freqEnd, ac.currentTime + delay + dur);
    gain.gain.setValueAtTime(0, ac.currentTime + delay);
    gain.gain.linearRampToValueAtTime(vol, ac.currentTime + delay + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + delay + dur);
    osc.start(ac.currentTime + delay);
    osc.stop(ac.currentTime + delay + dur + 0.05);
  }

  function noise(dur, vol = 0.2, filterFreq = 800, filterQ = 1) {
    const ac  = getCtx();
    const buf = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ac.createBufferSource();
    const flt = ac.createBiquadFilter();
    const gain= ac.createGain();
    src.buffer = buf;
    flt.type   = 'bandpass'; flt.frequency.value = filterFreq; flt.Q.value = filterQ;
    gain.gain.value = vol;
    src.connect(flt); flt.connect(gain); gain.connect(ac.destination);
    src.start();
  }

  // =========================================================
  // Sound Library
  // =========================================================
  const SFX = {

    // UI Sounds
    click()      { tone(800, 'square', 0.04, 0.12); },
    hover()      { tone(700, 'sine',   0.03, 0.06); },
    error()      { tone(180, 'sawtooth', 0.25, 0.2); tone(140, 'sawtooth', 0.2, 0.15, 0.1); },
    toggle()     { tone(500, 'square', 0.05, 0.1); tone(700, 'square', 0.05, 0.08, 0.06); },

    // Minecraft Interactions
    craft() {
      // Success chord — C-E-G arpeggio
      [[523, 0], [659, 0.09], [784, 0.18]].forEach(([f, d]) => tone(f, 'triangle', 0.35, 0.18, d));
    },
    craftFail()  { tone(200, 'sawtooth', 0.15, 0.25); },

    chestOpen() {
      // Wooden creak
      noise(0.25, 0.25, 350, 0.8);
      tone(200, 'sine', 0.2, 0.1, 0.05, 150);
    },

    enchant() {
      // Magical shimmer — ascending harmonics
      [400, 600, 900, 1400].forEach((f, i) => tone(f, 'sine', 0.6, 0.08, i * 0.07));
    },

    achievement() {
      // Classic achievement jingle — C-E-G-C
      [[523,0],[659,0.12],[784,0.22],[1047,0.32]].forEach(([f,d]) => tone(f,'triangle',0.5,0.25,d));
    },

    levelUp() {
      // Ascending flourish
      [[523,0],[659,0.08],[784,0.14],[1047,0.2],[1319,0.28]].forEach(([f,d])=>tone(f,'sine',0.6,0.3,d));
    },

    portal() {
      // Whoosh + harmonic rise
      tone(150, 'sawtooth', 0.7, 0.2, 0, 600);
      tone(300, 'sine',     0.7, 0.1, 0, 1200);
      noise(0.4, 0.1, 600, 2);
    },

    itemPickup() {
      tone(880, 'sine', 0.08, 0.15);
      tone(1320,'sine', 0.08, 0.1, 0.08);
    },

    damage() {
      noise(0.15, 0.3, 1200, 0.5);
      tone(100, 'sawtooth', 0.1, 0.2);
    },

    bookTurn() {
      noise(0.1, 0.15, 2000, 3);
      tone(600, 'sine', 0.08, 0.06, 0.02, 700);
    },

    lootRare() {
      // Epic fanfare
      [[392,0],[523,0.1],[659,0.2],[784,0.28],[1047,0.36]].forEach(([f,d])=>tone(f,'triangle',0.7,0.35,d));
    },
    lootLegendary() {
      // LEGENDARY — big chord stab
      [523,659,784,1047].forEach((f,i) => tone(f,'triangle',1.0,0.4,0));
      noise(0.3, 0.2, 800, 1);
    },

    discInsert() {
      tone(300, 'square', 0.06, 0.2);
      tone(500, 'square', 0.06, 0.15, 0.07);
    },

    // Ambient procedural note (for background ambience)
    ambientNote() {
      const scale = [261.6, 293.7, 329.6, 349.2, 392.0, 440.0, 493.9, 523.2];
      const f = scale[Math.floor(Math.random() * scale.length)];
      const vol = 0.04 + Math.random() * 0.04;
      tone(f, 'sine', 2.5 + Math.random() * 2, vol);
      // Add subtle harmony
      if (Math.random() > 0.5) tone(f * 1.5, 'sine', 2.0, vol * 0.4, 0.4);
    }
  };

  window.SFX = SFX;

  // =========================================================
  // Ambient Background Music Generator
  // =========================================================
  let ambientTimer = null;
  let ambientOn    = false;

  function scheduleNote() {
    if (!ambientOn) return;
    SFX.ambientNote();
    const next = 3000 + Math.random() * 6000; // 3-9 seconds between notes
    ambientTimer = setTimeout(scheduleNote, next);
  }

  window.AudioBGM = {
    start() {
      if (ambientOn) return;
      ambientOn = true;
      getCtx(); // Unlock audio context
      scheduleNote();
    },
    stop() {
      ambientOn = false;
      clearTimeout(ambientTimer);
    },
    toggle() {
      ambientOn ? this.stop() : this.start();
      return ambientOn;
    },
    isPlaying() { return ambientOn; }
  };

  // =========================================================
  // Auto-wire common interactions once DOM is ready
  // =========================================================
  document.addEventListener('DOMContentLoaded', () => {

    // All mc-btn clicks → click sound
    document.querySelectorAll('.mc-btn, .slot, .portal-card, .mc-btn, .ench-option, .recipe-card, .track-item').forEach(el => {
      el.addEventListener('mouseenter', () => SFX.hover());
      el.addEventListener('click',      () => SFX.click());
    });

    // Achievement unlock → achievement jingle
    window.addEventListener('achievementUnlocked', () => SFX.achievement());

    // Portal cards → portal sound
    document.querySelectorAll('.portal-card').forEach(el => {
      el.addEventListener('click', () => SFX.portal());
    });

    // Chest containers → chest sound
    document.querySelectorAll('#chest-container').forEach(el => {
      el.addEventListener('click', () => SFX.chestOpen());
    });

    // Loot rarity sounds
    window.addEventListener('lootDrop', e => {
      if (e.detail === 'LEGENDARY') SFX.lootLegendary();
      else if (e.detail === 'EPIC' || e.detail === 'RARE') SFX.lootRare();
      else SFX.itemPickup();
    });

    // Book page turns
    document.querySelectorAll('#btn-prev, #btn-next').forEach(el => {
      const isCraft = el.id === 'btn-next' && document.getElementById('track-list');
      if (!isCraft) el.addEventListener('click', () => SFX.bookTurn());
    });

    // Enchanting option clicks
    document.querySelectorAll('.ench-option').forEach(el => {
      el.addEventListener('click', () => SFX.enchant());
    });

    // Craft button
    document.getElementById('btn-craft')?.addEventListener('click', () => {
      // Sound is fired from crafting.html logic (craft success vs fail)
    });
  });

})();
