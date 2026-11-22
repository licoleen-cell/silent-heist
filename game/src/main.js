// Wires the simulation to the page: the canvas and its pixel size, the keyboard and mouse,
// the fixed-step loop, and the screenshot stages the maker renders (the ?shot= query, read
// from shots.json). Everything it draws comes from sim.js and render.js; this file only
// decides when.

import { TOOL_BUDGET, TOOL_ORDER, TOOLS, WORLD } from './config.js';
import { EXIT } from './level.js';
import { Heist, PHASE } from './sim.js';
import { drawWorld } from './render.js';
import { VIEW, drawHud } from './hud.js';
import { clamp } from './util.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });

/** The camera: by default the whole floor plan scaled to fill the frame. A staged screenshot
 * may instead frame one room, which is how the cover gets its five elements big enough to read
 * at a glance; the game itself always uses the full-plan view. */
const CAMERA = {
  scale: Math.min(VIEW.w / WORLD.w, VIEW.h / WORLD.h),
  x: (VIEW.w - WORLD.w * Math.min(VIEW.w / WORLD.w, VIEW.h / WORLD.h)) / 2,
  y: (VIEW.h - WORLD.h * Math.min(VIEW.w / WORLD.w, VIEW.h / WORLD.h)) / 2,
};

/** Point the camera at a world rectangle, fitted into the frame and centred. */
function focusCamera(x, y, w, h) {
  CAMERA.scale = Math.min(VIEW.w / w, VIEW.h / h);
  CAMERA.x = (VIEW.w - w * CAMERA.scale) / 2 - x * CAMERA.scale;
  CAMERA.y = (VIEW.h - h * CAMERA.scale) / 2 - y * CAMERA.scale;
}

const view = {
  time: 0,
  mouse: { x: VIEW.w / 2, y: VIEW.h / 2, active: false },
  loadout: { smoke: 1, coin: 1, emp: 1, jammer: 0 },
  budget: TOOL_BUDGET,
  hoverLoot: null,
  promptLoot: null,
};

let heist = new Heist({ loadout: view.loadout, seed: 11 });
heist.input = blankInput();
let dpr = 1;
let scale = 1;
let offsetX = 0;
let offsetY = 0;

function blankInput() {
  return { up: false, down: false, left: false, right: false, sprint: false, crouch: false };
}

/** Fit the 16:9 design frame into the window, letterboxed, at the device's pixel ratio. */
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  const s = Math.min(w / VIEW.w, h / VIEW.h);
  scale = s;
  offsetX = (w - VIEW.w * s) / 2;
  offsetY = (h - VIEW.h * s) / 2;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
}

window.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- input

const KEYMAP = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
};

const held = new Set();

function syncInput() {
  const input = blankInput();
  for (const code of held) {
    const k = KEYMAP[code];
    if (k) input[k] = true;
  }
  input.sprint = held.has('ShiftLeft') || held.has('ShiftRight');
  input.crouch = held.has('ControlLeft') || held.has('ControlRight') || held.has('KeyC');
  heist.input = input;
}

window.addEventListener('keydown', (e) => {
  if (e.repeat) {
    if (KEYMAP[e.code] || e.code === 'Space') e.preventDefault();
    return;
  }
  const code = e.code;
  if (KEYMAP[code] || code === 'Tab') e.preventDefault();

  if (code === 'Enter' || code === 'NumpadEnter') {
    if (heist.phase === PHASE.briefing) heist.start();
    return;
  }
  if (code === 'KeyP' || code === 'Escape') {
    if (heist.phase === PHASE.play) heist.phase = PHASE.paused;
    else if (heist.phase === PHASE.paused) heist.phase = PHASE.play;
    return;
  }
  if (code === 'KeyR') {
    restart();
    return;
  }
  if (code === 'KeyE' && heist.running) {
    heist.grabHeld = true;
  }
  const toolKey = { Digit1: 'smoke', Digit2: 'coin', Digit3: 'emp', Digit4: 'jammer' }[code];
  if (toolKey && heist.running) {
    heist.useTool(toolKey, (view.mouse.x - CAMERA.x) / CAMERA.scale, (view.mouse.y - CAMERA.y) / CAMERA.scale);
  }
  held.add(code);
  syncInput();
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyE') heist.grabHeld = false;
  held.delete(e.code);
  syncInput();
});

window.addEventListener('blur', () => {
  held.clear();
  heist.grabHeld = false;
  syncInput();
});

/** Screen pixels to the 1280 x 720 design frame the simulation and HUD share. */
function toView(clientX, clientY) {
  return {
    x: (clientX - offsetX) / scale,
    y: (clientY - offsetY) / scale,
  };
}

canvas.addEventListener('mousemove', (e) => {
  const p = toView(e.clientX, e.clientY);
  view.mouse.x = p.x;
  view.mouse.y = p.y;
  view.mouse.active = true;
  const wx = (p.x - CAMERA.x) / CAMERA.scale;
  const wy = (p.y - CAMERA.y) / CAMERA.scale;
  heist.aim = Math.atan2(wy - heist.player.y, wx - heist.player.x);
  view.hoverLoot = null;
  for (const l of heist.loot) {
    if (!l.taken && Math.hypot(wx - l.x, wy - l.y) < 34) view.hoverLoot = l.id;
  }
});

canvas.addEventListener('mouseleave', () => {
  view.mouse.active = false;
});

canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  const p = toView(e.clientX, e.clientY);
  view.mouse.x = p.x;
  view.mouse.y = p.y;
  view.mouse.active = true;
  if (heist.phase === PHASE.briefing) {
    heist.start();
    return;
  }
  if (heist.phase === PHASE.busted || heist.phase === PHASE.escaped) {
    restart();
  }
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

function restart() {
  heist = new Heist({ loadout: view.loadout, seed: 11 });
  heist.input = blankInput();
  heist.start();
  held.clear();
}

// ---------------------------------------------------------------- the loop

let frameNo = 0;
let frozen = false;
let last = performance.now();
let acc = 0;
const STEP = 1 / 120;

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  acc += dt;
  // A staged screenshot is a frozen moment: the scene was stepped by stageShot, and the
  // simulation stops there so the frame the camera captures is exactly the one composed.
  let guard = 0;
  while (!frozen && acc >= STEP && guard++ < 12) {
    heist.update(STEP);
    acc -= STEP;
  }
  if (frozen) acc = 0;
  view.time += dt;
  if (heist.promptAge > 0) view.promptLoot = null;
  draw(now / 1000);
  frameNo++;
  window.__frameNo = frameNo;
  document.body.classList.add('ready');
  requestAnimationFrame(frame);
}

function draw(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#05070c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const shake = heist.shake;
  const sx = shake > 0 ? (Math.random() - 0.5) * 6 * shake : 0;
  const sy = shake > 0 ? (Math.random() - 0.5) * 6 * shake : 0;

  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, (offsetX + sx) * dpr, (offsetY + sy) * dpr);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, VIEW.w, VIEW.h);
  ctx.clip();
  ctx.translate(CAMERA.x, CAMERA.y);
  ctx.scale(CAMERA.scale, CAMERA.scale);
  // The mouse is tracked in frame pixels; the world needs it in its own units.
  const mouse = {
    x: (view.mouse.x - CAMERA.x) / CAMERA.scale,
    y: (view.mouse.y - CAMERA.y) / CAMERA.scale,
    active: view.mouse.active,
  };
  drawWorld(ctx, heist, { ...view, time: t, mouse });
  ctx.restore();

  // The camera's own vignette, over the world and under the HUD.
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, offsetX * dpr, offsetY * dpr);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, VIEW.w, VIEW.h);
  ctx.clip();
  const vig = ctx.createRadialGradient(VIEW.w * 0.5, VIEW.h * 0.5, VIEW.h * 0.72, VIEW.w * 0.5, VIEW.h * 0.5, VIEW.h * 1.15);
  vig.addColorStop(0, 'rgba(4, 6, 10, 0)');
  vig.addColorStop(1, 'rgba(4, 6, 10, 0.26)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  ctx.restore();

  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, offsetX * dpr, offsetY * dpr);
  drawHud(ctx, heist, { ...view, time: t });

  // The frame's own hairline, so the game reads as a lit display case on a dark page.
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, offsetX * dpr, offsetY * dpr);
  ctx.strokeStyle = 'rgba(120, 140, 175, 0.18)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, VIEW.w - 1, VIEW.h - 1);
}

requestAnimationFrame(frame);

// ---------------------------------------------------------------- staged screenshots

/**
 * ?shot=<name>&seed=<n> sets a scene from shots.json and freezes the clock, so a screenshot is
 * the game's own render of a chosen moment rather than a lucky frame. The stage steps the
 * simulation itself, so guards, cameras and the alarm are all in a real state when it stops.
 */
const params = new URLSearchParams(location.search);
const shot = params.get('shot');

if (shot) {
  const seed = Number(params.get('seed') ?? 1);
  heist = new Heist({ loadout: view.loadout, seed });
  heist.input = blankInput();
  heist.start();
  stageShot(shot);
  // ?cam=x,y,w,h overrides the staged window, so the cover can be composed without editing.
  const camParam = params.get('cam');
  if (camParam) {
    const [cx, cy, cw, ch] = camParam.split(',').map(Number);
    if ([cx, cy, cw, ch].every((n) => Number.isFinite(n)) && cw > 0 && ch > 0) {
      focusCamera(cx, cy, cw, ch);
    }
  }
  frozen = true;
  document.body.classList.add('staged');
}

function stageShot(name) {
  const p = heist.player;
  const loot = (id) => heist.loot.find((l) => l.id === id);
  const guard = (id) => heist.guards.find((g) => g.id === id);
  const cam = (id) => heist.cameras.find((c) => c.id === id);

  if (name === 'briefing' || name === 'start') {
    heist.phase = PHASE.briefing;
    heist.time = 0;
    heist.alarm = 0;
    // Let the patrol settle first, then pin it, so the room behind the briefing is composed.
    settle(3.0);
    pinGuards();
    heist.phase = PHASE.briefing;
    heist.alarm = 0;
    settleVision();
    return;
  }

  if (name === 'play') {
    // The Long Gallery mid-job: the thief crossing the room, the warden's cone sweeping his
    // way, the wall camera overhead, two pieces still on their plinths, and the alarm hunted.
    // One piece is already in the bag, so the take and the manifest both show progress.
    settle(2.5);
    pinGuards();

    p.x = 1006;
    p.y = 250;
    p.facing = 0.1;
    // Standing, not crouching: a crouching thief shrinks every guard's cone to 60% of its
    // reach, and the cover needs the warden's cone at full length to read as a cone.
    p.stance = 'walk';
    p.vx = 0;
    p.vy = 0;
    p.carry = loot('mask');
    p.carryValue = 15000;
    loot('mask').taken = true;
    heist.carryTotal = 15000;
    heist.trail.length = 0;
    for (let i = 0; i < 5; i++) heist.trail.push({ x: p.x - 8 - i * 7, y: p.y + 4 + i, life: 0.28 - i * 0.04, stance: 'walk' });

    // The warden walks the open lane north of the long display case, looking west down the
    // gallery. His cone runs its full reach from there instead of being cut to a stub by the
    // case, and the thief crouches just outside it, in the case's shadow.
    const w = guard('warden');
    w.x = 1150;
    w.y = 180;
    w.facing = Math.PI;
    w.state = 'pause';
    w.stateAge = 0;
    w.pauseLeft = 999;
    w.lookBase = w.facing;
    w.alert = 0.62;
    w.suspicion = 0.4;

    const c = cam('cam-gallery');
    c.angle = 2.94;
    c.detect = 0.62;
    c.state = 'watch';
    c.sees = true;

    heist.alarm = 57;
    heist.time = 104;
    heist.toast = 'Ivory Mask secured. The warden is sweeping the gallery.';
    heist.toastAge = 6;
    heist.prompt = '';
    heist.promptAge = 0;
    heist.phase = PHASE.play;

    // Frame the cover on the Long Gallery rather than the whole museum. At full-plan scale
    // every actor is about eight pixels and the east-wall camera sits in the vignette. This
    // window (880x440 world units at 1.45x) holds all five things the frame has to show: the
    // gallery floor the thief is crossing, the warden with the full length of his lit cone,
    // the wall camera on the east wall, two pieces on their plinths, and the alarm meter in
    // the HUD above them. Measured: all five inside the frame, clear of both HUD bands.
    focusCamera(740, 40, 880, 440);
    settleVision();
    return;
  }

  if (name === 'vault') {
    // The strongroom: the diamond on its plinth in reach, its camera locked on, the vault
    // keeper closing, and the alarm nearly at lockdown.
    settle(2.0);
    pinGuards();

    p.x = 1222;
    p.y = 468;
    p.facing = 0.02;
    p.stance = 'walk';
    p.vx = 0;
    p.vy = 0;
    heist.trail.length = 0;

    const k = guard('vaultkeeper');
    k.x = 1444;
    k.y = 520;
    k.facing = Math.PI * 0.86;
    k.state = 'chase';
    k.stateAge = 0;
    k.alert = 1;
    k.suspicion = 1;
    k.sees = true;
    k.lastKnown = { x: p.x, y: p.y };

    const c = cam('cam-vault');
    c.angle = 2.62;
    c.detect = 1;
    c.state = 'track';
    c.sees = true;

    heist.alarm = 76;
    heist.time = 171;
    heist.toast = 'The vault camera has you. Lift the diamond and go.';
    heist.toastAge = 6;
    heist.prompt = 'Hold E to lift the Moonfall Diamond · $60,000';
    heist.promptAge = 999;
    heist.phase = PHASE.play;

    // Framed on the strongroom, like the cover is framed on the gallery: the diamond on its
    // plinth, the camera that has locked on, and the vault keeper closing across the steel.
    focusCamera(1080, 300, 540, 304);
    settleVision();
    return;
  }

  if (name === 'end') {
    // The result screen, after a clean exit with the diamond and two other pieces.
    settle(1.0);
    pinGuards();
    for (const id of ['moonfall', 'diadem', 'clock']) loot(id).taken = true;
    heist.carryTotal = 60000 + 14000 + 18000;
    heist.alarm = 12;
    heist.time = 187;
    heist.phase = PHASE.escaped;
    heist.phaseAge = 0.4;
    settleVision();
    return;
  }
}

/** Hold every guard and camera exactly where the staging put them, so a frame is repeatable. */
function pinGuards() {
  for (const g of heist.guards) {
    g.stateAge = 0;
    g.pauseLeft = 999;
  }
  for (const c of heist.cameras) c.phase = 0;
}

/** After the staging has moved bodies, redraw their sight from where they now stand. */
function settleVision() {
  heist.refreshVision();
}

/** Run the simulation forward without input, so the scene is genuinely live. */
function settle(seconds) {
  const steps = Math.round(seconds * 60);
  const keepAlarm = heist.alarm;
  const keepPhase = heist.phase;
  for (let i = 0; i < steps; i++) heist.update(1 / 60);
  heist.alarm = keepAlarm;
  heist.phase = keepPhase;
}

/** Expose a little state for the maker's headless check. */
window.__heist = {
  get frame() {
    return frameNo;
  },
  get camera() {
    return CAMERA;
  },
  get phase() {
    return heist.phase;
  },
  get alarm() {
    return heist.alarm;
  },
  get loot() {
    return heist.loot.map((l) => ({ id: l.id, taken: l.taken }));
  },
  get guards() {
    return heist.guards.length;
  },
  get cameras() {
    return heist.cameras.length;
  },
  get cameraList() {
    return heist.cameras.map((c) => ({
      id: c.id,
      x: Math.round(c.x),
      y: Math.round(c.y),
      angle: Number(c.angle.toFixed(2)),
      state: c.state,
      sees: c.sees,
      dark: c.dark,
    }));
  },
  get take() {
    return heist.carryTotal;
  },
  get room() {
    return heist.roomName;
  },
  get pos() {
    return { x: Math.round(heist.player.x), y: Math.round(heist.player.y), stance: heist.player.stance };
  },
  get canGrab() {
    return heist.grabTarget ? heist.grabTarget.id : null;
  },
  start: () => heist.start(),
  move: (dx, dy, seconds) => {
    const old = heist.input;
    heist.input = { ...blankInput(), ...(dx > 0 ? { right: true } : dx < 0 ? { left: true } : {}), ...(dy > 0 ? { down: true } : dy < 0 ? { up: true } : {}) };
    for (let i = 0; i < Math.round(seconds * 60); i++) heist.update(1 / 60);
    heist.input = old;
  },
  tool: (id) => heist.useTool(id, heist.player.x + 100, heist.player.y),
  grab: () => {
    heist.grabHeld = true;
    for (let i = 0; i < 90; i++) heist.update(1 / 60);
    heist.grabHeld = false;
  },
  exitAt: () => ({ x: EXIT.x, y: EXIT.y }),
  budgetTools: () => TOOL_ORDER.map((id) => ({ id, name: TOOLS[id].name })),
  clamp,
};
