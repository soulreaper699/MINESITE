// VOXEL — App Logic (Minecraft Edition)
gsap.registerPlugin(ScrollTrigger);

// =========================================================================
// 1. CROSSHAIR CURSOR
// =========================================================================
const crosshair = document.getElementById('cursor-crosshair');
document.addEventListener('mousemove', e => {
  crosshair.style.left = e.clientX + 'px';
  crosshair.style.top  = e.clientY + 'px';
});

// =========================================================================
// 2. HOTBAR — Click & Keyboard
// =========================================================================
const slots = document.querySelectorAll('.slot');

function setActiveSlot(index) {
  slots.forEach(s => s.classList.remove('active'));
  if (slots[index]) slots[index].classList.add('active');
}

slots.forEach((slot, i) => {
  slot.addEventListener('click', () => {
    const target = slot.getAttribute('data-target');
    const el = document.querySelector(target);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      setActiveSlot(i);
    }
  });
});

// Keyboard 1-9
document.addEventListener('keydown', e => {
  const n = parseInt(e.key);
  if (n >= 1 && n <= 9) {
    setActiveSlot(n - 1);
    const slot = slots[n - 1];
    if (slot) {
      const target = slot.getAttribute('data-target');
      const el = document.querySelector(target);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  }
});

// Update active slot based on scroll position
const sections = ['#home','#armory','#nether','#redstone','#end','#reserve'];
sections.forEach((id, i) => {
  const el = document.querySelector(id);
  if (!el) return;
  ScrollTrigger.create({
    trigger: el,
    start: 'top center',
    end: 'bottom center',
    onEnter:       () => setActiveSlot(i),
    onEnterBack:   () => setActiveSlot(i),
  });
});

// =========================================================================
// 3. EXP BAR — Fills with scroll progress
// =========================================================================
const expFill  = document.getElementById('exp-bar-fill');
const expLevel = document.getElementById('exp-level');

window.addEventListener('scroll', () => {
  const scrolled = window.scrollY;
  const maxScroll = document.body.scrollHeight - window.innerHeight;
  const progress = Math.min(scrolled / maxScroll, 1);
  const levelMax = 30;
  const currentLevel = Math.floor(progress * levelMax);

  expFill.style.width = (progress * 100) + '%';
  expLevel.textContent = 'LVL ' + currentLevel;

  // Coords display update
  const x = Math.floor(scrolled * 0.3);
  const y = Math.max(0, 64 - Math.floor(progress * 60));
  const z = Math.floor(scrolled * 0.15);
  document.getElementById('coords-display').textContent = `X:${x} Y:${y} Z:${z}`;
  const f3pos = document.getElementById('f3-pos');
  if (f3pos) f3pos.textContent = `XYZ: ${x}.000 / ${y}.000 / ${z}.000`;
});

// =========================================================================
// 4. TEXT REVEAL — ScrollTrigger
// =========================================================================
gsap.utils.toArray('.panel').forEach(panel => {
  const els = panel.querySelectorAll('.reveal-text');
  if (!els.length) return;
  gsap.fromTo(els,
    { opacity: 0, y: 40 },
    {
      opacity: 1, y: 0, duration: 0.8, stagger: 0.12, ease: 'power3.out',
      scrollTrigger: { trigger: panel, start: 'top 65%', toggleActions: 'play none none reverse' }
    }
  );
});

// =========================================================================
// 5. F3 DEBUG MODE
// =========================================================================
const btnBlueprint = document.getElementById('btn-blueprint');
let f3Active = false;
btnBlueprint.addEventListener('click', e => {
  e.preventDefault();
  f3Active = !f3Active;
  document.body.classList.toggle('f3-active', f3Active);
  document.getElementById('f3-overlay').style.display = f3Active ? 'block' : 'none';
});

// F3 FPS counter
let lastTime = performance.now(), frameCount = 0;
function updateFPS() {
  frameCount++;
  const now = performance.now();
  if (now - lastTime >= 1000) {
    const fps = document.getElementById('f3-fps');
    if (fps) fps.textContent = `FPS: ${frameCount}`;
    frameCount = 0;
    lastTime = now;
  }
  requestAnimationFrame(updateFPS);
}
updateFPS();

// Scene label in F3
function updateF3Scene(val) {
  const scenes = ['overworld','armory (pickaxe)','the_nether','redstone_core','the_end','reserve'];
  const idx = Math.min(Math.floor(val), 5);
  const el = document.getElementById('f3-scene');
  if (el) el.textContent = `Scene: ${scenes[idx]} (${val.toFixed(2)})`;
}
window.updateF3Scene = updateF3Scene;

// =========================================================================
// 6. CONFIGURATOR — Aero & Material
// =========================================================================
const sliderAero = document.getElementById('slider-aero');
window.aeroForce = 0.5;
sliderAero.addEventListener('input', e => { window.aeroForce = parseFloat(e.target.value); });

const btnMaterial = document.getElementById('btn-material');
window.materialState = 0;
btnMaterial.addEventListener('click', () => {
  window.materialState = window.materialState === 0 ? 1 : 0;
  btnMaterial.textContent = window.materialState === 0 ? 'OBSIDIAN' : 'DIAMOND';
  btnMaterial.style.color = window.materialState === 0 ? '#fff' : '#00e5ff';
});

// =========================================================================
// 7. SCULK SENSOR — MIC (Audio RPM)
// =========================================================================
let audioCtx, analyser, dataArray, micStream, micSource, isMicOn = false;
window.audioAvg = 0;

const btnIgnition = document.getElementById('btn-ignition');
btnIgnition.addEventListener('click', async () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    dataArray = new Uint8Array(analyser.frequencyBinCount);
  }
  if (!isMicOn) {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micSource = audioCtx.createMediaStreamSource(micStream);
      micSource.connect(analyser);
      btnIgnition.classList.add('active');
      btnIgnition.textContent = '🔊 SCULK ACTIVE';
      isMicOn = true;
      readMic();
    } catch { alert('Microphone denied.'); }
  } else {
    micStream.getTracks().forEach(t => t.stop());
    micSource.disconnect();
    btnIgnition.classList.remove('active');
    btnIgnition.textContent = 'SCULK SENSOR (MIC)';
    isMicOn = false;
    window.audioAvg = 0;
  }
});

function readMic() {
  if (!isMicOn) return;
  requestAnimationFrame(readMic);
  analyser.getByteFrequencyData(dataArray);
  let s = 0;
  dataArray.forEach(v => s += v);
  window.audioAvg = s / dataArray.length / 255;
}

// =========================================================================
// 8. AUDIO — Synthesized C418 Ambient (sounds.js)
// =========================================================================
const btnBgm   = document.getElementById('btn-bgm');
const btnNext  = document.getElementById('btn-next');

// Now-playing label (inject into nav)
const npLabel = document.createElement('span');
npLabel.id = 'np-label';
npLabel.style.cssText = `font-family:'VT323',monospace;font-size:1rem;color:rgba(255,255,255,0.5);max-width:200px;overflow:hidden;white-space:nowrap;`;
document.querySelector('.nav-links')?.prepend(npLabel);

if (npLabel) npLabel.textContent = `♪ Procedural Ambient`;

btnBgm?.addEventListener('click', function() {
  const isPlaying = window.AudioBGM.toggle();
  this.textContent = isPlaying ? 'BGM ■' : 'BGM ▶';
  if (isPlaying) {
    if (npLabel) npLabel.textContent = `♪ Generating Notes...`;
    SFX.click();
  }
});

btnNext?.addEventListener('click', () => {
  SFX.click();
  SFX.ambientNote(); // Force a note
});

// =========================================================================
// 9. NAV SMOOTH SCROLL
// =========================================================================
document.querySelectorAll('nav a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    const el = document.querySelector(a.getAttribute('href'));
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  });
});

// Form
document.getElementById('reserve-form')?.addEventListener('submit', e => {
  e.preventDefault();
  alert('WHITELIST APPLICATION SENT!\nWe will review your IGN within 24 hours.');
});
