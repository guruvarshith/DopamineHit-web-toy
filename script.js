/* =========================================================
   DopamineHit — script.js
   Vanilla JS, no external libraries or audio files.
   ========================================================= */

/* ---------- Tab switching ---------- */
const tabBtns = document.querySelectorAll('.tab-btn');
const toyViews = document.querySelectorAll('.toy-view');

tabBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabBtns.forEach((b) => b.classList.remove('active'));
    toyViews.forEach((v) => v.classList.remove('active'));

    btn.classList.add('active');
    const view = document.getElementById(btn.dataset.tab);
    view.classList.add('active');

    // The clean canvas needs real pixel dimensions, which it only
    // has once its section is visible, so size it on first reveal.
    if (btn.dataset.tab === 'clean') {
      initCleanCanvasIfNeeded();
    }
  });
});

/* ---------- Shared Web Audio setup ---------- */
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Short synthesized "pop" — quick descending sine burst.
function playPopSound() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(500 + Math.random() * 250, now);
  osc.frequency.exponentialRampToValueAtTime(70, now + 0.09);

  gain.gain.setValueAtTime(0.5, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.11);
}

// Low thud + a wobbling hinge "creak" + filtered noise, for opening a door.
function playDoorSound() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  // Thud — the frame shifting as the door swings open
  const thudOsc = ctx.createOscillator();
  const thudGain = ctx.createGain();
  thudOsc.type = 'sine';
  thudOsc.frequency.setValueAtTime(100, now);
  thudOsc.frequency.exponentialRampToValueAtTime(35, now + 0.3);
  thudGain.gain.setValueAtTime(0.55, now);
  thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
  thudOsc.connect(thudGain).connect(ctx.destination);
  thudOsc.start(now);
  thudOsc.stop(now + 0.35);

  // Hinge creak — a wobbling triangle tone, the part your ear actually
  // recognizes as "door", layered on top of the thud and noise below.
  const creakOsc = ctx.createOscillator();
  const creakGain = ctx.createGain();
  creakOsc.type = 'triangle';
  creakOsc.frequency.setValueAtTime(320, now + 0.02);
  creakOsc.frequency.linearRampToValueAtTime(480, now + 0.15);
  creakOsc.frequency.linearRampToValueAtTime(260, now + 0.32);
  creakOsc.frequency.linearRampToValueAtTime(400, now + 0.5);
  creakGain.gain.setValueAtTime(0.0001, now);
  creakGain.gain.linearRampToValueAtTime(0.14, now + 0.05);
  creakGain.gain.linearRampToValueAtTime(0.1, now + 0.3);
  creakGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
  creakOsc.connect(creakGain).connect(ctx.destination);
  creakOsc.start(now);
  creakOsc.stop(now + 0.55);

  // Filtered noise burst for texture under the creak
  const duration = 0.4;
  const bufferSize = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(900, now);
  filter.frequency.exponentialRampToValueAtTime(280, now + duration);
  filter.Q.value = 7;

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.16, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  noise.connect(filter).connect(noiseGain).connect(ctx.destination);
  noise.start(now);
}

// Short low thud for closing/resetting all the doors at once.
function playDoorCloseSound() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(160, now);
  osc.frequency.exponentialRampToValueAtTime(55, now + 0.15);
  gain.gain.setValueAtTime(0.4, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.2);
}

// Sharp square-wave click for the light switch.
function playClickSound() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(1400, now);
  gain.gain.setValueAtTime(0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.05);
}

/* =========================================================
   TOY 1: Bubble wrap
   ========================================================= */
const BUBBLE_ROWS = 6;
const BUBBLE_COLS = 14;
const TOTAL_BUBBLES = BUBBLE_ROWS * BUBBLE_COLS;

const bubbleGrid = document.getElementById('bubbleGrid');
const poppedCountEl = document.getElementById('poppedCount');
const remainingCountEl = document.getElementById('remainingCount');
const resetBubblesBtn = document.getElementById('resetBubbles');

let poppedCount = 0;
let isPointerDown = false;

function buildBubbleSheet() {
  bubbleGrid.innerHTML = '';
  poppedCount = 0;
  updateBubbleCounts();

  for (let i = 0; i < TOTAL_BUBBLES; i++) {
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubbleGrid.appendChild(bubble);
  }
}

function updateBubbleCounts() {
  poppedCountEl.textContent = poppedCount;
  remainingCountEl.textContent = TOTAL_BUBBLES - poppedCount;
}

function popBubbleAtPoint(x, y) {
  const el = document.elementFromPoint(x, y);
  if (el && el.classList.contains('bubble') && !el.classList.contains('popped')) {
    el.classList.add('popped');
    poppedCount++;
    updateBubbleCounts();
    playPopSound();
  }
}

bubbleGrid.addEventListener('pointerdown', (e) => {
  isPointerDown = true;
  popBubbleAtPoint(e.clientX, e.clientY);
});

bubbleGrid.addEventListener('pointermove', (e) => {
  if (isPointerDown) popBubbleAtPoint(e.clientX, e.clientY);
});

window.addEventListener('pointerup', () => {
  isPointerDown = false;
});

resetBubblesBtn.addEventListener('click', buildBubbleSheet);

buildBubbleSheet();

/* =========================================================
   TOY 2: Doors
   ========================================================= */
const DOOR_COUNT = 12; // 3 rows x 4 columns
const doorColors = ['#3f6b4a', '#345a8c', '#5a3a70']; // green, blue, purple
const doorsGrid = document.getElementById('doorsGrid');
const resetDoorsBtn = document.getElementById('resetDoors');

function buildDoors() {
  doorsGrid.innerHTML = '';

  for (let i = 0; i < DOOR_COUNT; i++) {
    const frame = document.createElement('div');
    frame.className = 'door-frame';

    const inner = document.createElement('div');
    inner.className = 'door-inner';

    const door = document.createElement('div');
    door.className = 'door';

    const handle = document.createElement('div');
    handle.className = 'handle';
    door.appendChild(handle);

    frame.appendChild(inner);
    frame.appendChild(door);

    door.addEventListener('click', () => openDoor(door, inner));

    doorsGrid.appendChild(frame);
  }
}

function openDoor(door, inner) {
  if (door.classList.contains('open')) return;

  const color = doorColors[Math.floor(Math.random() * doorColors.length)];
  inner.style.background = color;
  door.classList.add('open');
  playDoorSound();
}

buildDoors();

resetDoorsBtn.addEventListener('click', () => {
  buildDoors();
  playDoorCloseSound();
});

/* =========================================================
   TOY 3: Switch
   ========================================================= */
const wall = document.getElementById('wall');
const toggleSwitch = document.getElementById('toggleSwitch');
let lightsOn = true;

toggleSwitch.addEventListener('click', () => {
  lightsOn = !lightsOn;
  wall.classList.toggle('dark', !lightsOn);
  toggleSwitch.classList.toggle('down', !lightsOn);
  playClickSound();
});

/* =========================================================
   TOY 4: Clean
   ========================================================= */
const cleanCanvas = document.getElementById('cleanCanvas');
const cleanCtx = cleanCanvas.getContext('2d');
const cleanPercentEl = document.getElementById('cleanPercent');
const resetCleanBtn = document.getElementById('resetClean');

let isCleaning = false;
let cleanCalcPending = false;
let cleanCanvasReady = false;

function initCleanCanvasIfNeeded() {
  if (!cleanCanvasReady) {
    resizeCleanCanvas();
    cleanCanvasReady = true;
  }
}

function resizeCleanCanvas() {
  const rect = cleanCanvas.parentElement.getBoundingClientRect();
  cleanCanvas.width = rect.width;
  cleanCanvas.height = rect.height;
  drawGrime();
}

function drawGrime() {
  const w = cleanCanvas.width;
  const h = cleanCanvas.height;

  cleanCtx.globalCompositeOperation = 'source-over';
  cleanCtx.fillStyle = '#2b2b28';
  cleanCtx.fillRect(0, 0, w, h);

  // Layer soft dark blobs so the grime looks uneven, not a flat fill.
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = 35 + Math.random() * 90;

    const grad = cleanCtx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    cleanCtx.fillStyle = grad;
    cleanCtx.beginPath();
    cleanCtx.arc(x, y, r, 0, Math.PI * 2);
    cleanCtx.fill();
  }

  cleanPercentEl.textContent = '0%';
}

function eraseAt(x, y) {
  const radius = 28;

  cleanCtx.globalCompositeOperation = 'destination-out';
  const grad = cleanCtx.createRadialGradient(x, y, 0, x, y, radius);
  grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
  grad.addColorStop(0.7, 'rgba(0, 0, 0, 0.85)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  cleanCtx.fillStyle = grad;
  cleanCtx.beginPath();
  cleanCtx.arc(x, y, radius, 0, Math.PI * 2);
  cleanCtx.fill();
}

function getCanvasPos(e) {
  const rect = cleanCanvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function scheduleCleanPercentUpdate() {
  if (cleanCalcPending) return;
  cleanCalcPending = true;
  requestAnimationFrame(() => {
    updateCleanPercent();
    cleanCalcPending = false;
  });
}

function updateCleanPercent() {
  const w = cleanCanvas.width;
  const h = cleanCanvas.height;
  const data = cleanCtx.getImageData(0, 0, w, h).data;

  // Sample every 10th pixel's alpha channel for performance.
  let transparent = 0;
  let sampled = 0;
  for (let i = 3; i < data.length; i += 40) {
    sampled++;
    if (data[i] < 20) transparent++;
  }

  const percent = sampled === 0 ? 0 : Math.round((transparent / sampled) * 100);
  cleanPercentEl.textContent = percent + '%';
}

cleanCanvas.addEventListener('pointerdown', (e) => {
  isCleaning = true;
  const pos = getCanvasPos(e);
  eraseAt(pos.x, pos.y);
  scheduleCleanPercentUpdate();
});

cleanCanvas.addEventListener('pointermove', (e) => {
  if (!isCleaning) return;
  const pos = getCanvasPos(e);
  eraseAt(pos.x, pos.y);
  scheduleCleanPercentUpdate();
});

window.addEventListener('pointerup', () => {
  isCleaning = false;
});

resetCleanBtn.addEventListener('click', () => {
  resizeCleanCanvas();
});
