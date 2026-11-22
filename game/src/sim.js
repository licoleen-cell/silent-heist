// The heist itself: the thief, the guards' patrol and pursuit, the cameras' sweeps, the alarm
// meter, the loot, and the tools. Pure logic: no canvas, no DOM, no clock of its own, so the
// same code runs in the browser and under Node for the headless checks.

import {
  ALARM,
  CAMERA,
  GUARD_TYPES,
  PALETTE,
  PLAYER,
  RANK_BANDS,
  SCORING,
  TOOLS,
  WORLD,
} from './config.js';
import { EXIT, GUARDS, CAMERAS, LOOT, START, roomAt, solidShapes } from './level.js';
import { angleLerp, clamp, damp, dist, makeRng } from './util.js';
import { conePolygon, inCone, pushOutCircle, segmentBlocked, smokeBlocks } from './geometry.js';

const SOLIDS = solidShapes();

export const PHASE = {
  briefing: 'briefing',
  play: 'play',
  paused: 'paused',
  busted: 'busted',
  escaped: 'escaped',
};

/** What a guard is doing right now; the HUD and the renderer both read it. */
export const GUARD_STATE = {
  patrol: 'patrol',
  pause: 'pause',
  investigate: 'investigate',
  search: 'search',
  chase: 'chase',
  return: 'return',
};

/** Move a point toward a target at a speed, stopping when it arrives; returns the new point. */
function stepToward(x, y, tx, ty, speed, dt) {
  const dx = tx - x;
  const dy = ty - y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-6) return { x: tx, y: ty, arrived: true, moved: 0 };
  const stepLen = Math.min(d, speed * dt);
  return { x: x + (dx / d) * stepLen, y: y + (dy / d) * stepLen, arrived: stepLen >= d - 1e-6, moved: stepLen };
}

/** Keep a body out of walls and cover. */
function resolveSolids(x, y, radius) {
  let px = x;
  let py = y;
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (let i = 0; i < SOLIDS.length; i++) {
      const p = pushOutCircle(px, py, radius, SOLIDS[i]);
      if (p !== null) {
        px = p.x;
        py = p.y;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return { x: clamp(px, radius, WORLD.w - radius), y: clamp(py, radius, WORLD.h - radius) };
}

export class Heist {
  /**
   * @param {{loadout?: Record<string, number>, seed?: number, phase?: string}} opts
   *   loadout maps a tool id to how many charges were bought (absent means none).
   */
  constructor(opts = {}) {
    this.seed = opts.seed ?? 7;
    this.rng = makeRng(this.seed);
    this.time = 0;
    this.phase = opts.phase ?? PHASE.briefing;
    this.phaseAge = 0;
    this.alarm = 0;
    this.jam = 0;
    this.prompt = '';
    this.promptAge = 0;
    this.toast = '';
    this.toastAge = 0;
    this.noisePulse = 0;
    this.noiseRadius = 0;
    this.cameraFlash = 0;
    this.shake = 0;
    this.events = [];
    this.particles = [];
    this.trail = [];
    this.stats = { seenFrames: 0, cameraFrames: 0, closeCalls: 0, toolsUsed: 0 };

    this.tools = {};
    for (const id of Object.keys(TOOLS)) {
      this.tools[id] = { charges: Math.max(0, opts.loadout?.[id] ?? 0), cooldown: 0, lastAim: null };
    }

    this.player = {
      x: START.x,
      y: START.y,
      vx: 0,
      vy: 0,
      facing: START.facing,
      radius: PLAYER.radius,
      stance: 'walk',
      speed: 0,
      noise: 0,
      carry: null,
      carryValue: 0,
      grab: 0,
      grabTarget: null,
      stepTimer: 0,
      bob: 0,
      hurt: 0,
      hidden: false,
      /** Seconds of grace after a shove, so one guard cannot grab twice in a row. */
      stagger: 0,
    };

    this.loot = LOOT.map((l) => ({ ...l, taken: false, glow: 0 }));
    this.guards = GUARDS.map((g) => this.makeGuard(g));
    this.cameras = CAMERAS.map((c) => this.makeCamera(c));
    this.clouds = [];
    this.coins = [];
    this.carryTotal = 0;
    this.escaped = false;
    this.bustedBy = null;
  }

  makeGuard(def) {
    const type = GUARD_TYPES[def.type];
    const start = def.route[0];
    return {
      id: def.id,
      type: def.type,
      spec: type,
      name: type.name,
      x: start.x,
      y: start.y,
      facing: 0,
      route: def.route,
      routeIndex: def.route.length > 1 ? 1 : 0,
      state: GUARD_STATE.pause,
      stateAge: 0,
      pauseLeft: start.pause ?? 1,
      target: null,
      lastKnown: null,
      patienceLeft: 0,
      lookBase: 0,
      lookPhase: this.rng() * Math.PI * 2,
      lookAmount: def.look,
      lookPeriod: def.lookPeriod,
      speed: type.speed,
      radius: 13,
      alert: 0,
      sees: false,
      seesPlayer: false,
      cone: null,
      suspicion: 0,
      bob: this.rng() * 6,
      homeIndex: 0,
    };
  }

  makeCamera(def) {
    return {
      id: def.id,
      x: def.x,
      y: def.y,
      base: def.angle,
      angle: def.angle,
      sweep: def.sweep,
      period: def.period,
      range: def.range,
      room: def.room,
      phase: this.rng() * Math.PI * 2,
      state: 'sweep',
      detect: 0,
      dark: 0,
      sees: false,
      blink: 0,
    };
  }

  // ------------------------------------------------------------ lifecycle

  start() {
    this.phase = PHASE.play;
    this.phaseAge = 0;
    this.say('Get the Moonfall Diamond from the strongroom, then leave by the loading bay.', 6);
  }

  say(text, seconds = 3.2) {
    this.toast = text;
    this.toastAge = seconds;
  }

  get running() {
    return this.phase === PHASE.play;
  }

  get lootTotal() {
    return this.loot.reduce((sum, l) => sum + l.value, 0);
  }

  get primary() {
    return this.loot.find((l) => l.primary) ?? null;
  }

  get score() {
    const carried = this.carryTotal;
    if (this.phase === PHASE.busted) return Math.round(carried * SCORING.bustedKeepFraction);
    const timeLeft = Math.max(0, SCORING.timeWindow - this.time);
    const timeBonus = Math.round((timeLeft / SCORING.timeWindow) * SCORING.timeBonusMax);
    const ghost = this.stats.seenFrames === 0 && this.stats.cameraFrames === 0 ? SCORING.ghostBonus : 0;
    const penalty = Math.round(this.alarm * SCORING.alarmPenalty);
    return Math.max(0, carried + timeBonus + ghost - penalty);
  }

  get rank() {
    if (this.phase === PHASE.busted) return { name: 'Busted', note: 'The night staff got a good look at you.' };
    const total = this.lootTotal;
    const fraction = total > 0 ? this.carryTotal / total : 0;
    if (!this.primary?.taken) return { name: 'Empty-handed', note: 'You left the diamond in its case.' };
    for (const band of RANK_BANDS) {
      if (fraction >= band.at) return band;
    }
    return RANK_BANDS[RANK_BANDS.length - 1];
  }

  // ------------------------------------------------------------ the clock

  update(dtRaw) {
    const dt = Math.min(dtRaw, 1 / 30);
    this.phaseAge += dt;
    if (this.toastAge > 0) this.toastAge -= dt;
    if (this.promptAge > 0) this.promptAge -= dt;
    this.shake = Math.max(0, this.shake - dt * 3.4);
    this.noisePulse = Math.max(0, this.noisePulse - dt * 1.6);
    this.cameraFlash = Math.max(0, this.cameraFlash - dt * 2.2);
    this.updateParticles(dt);

    if (this.phase !== PHASE.play) {
      for (const c of this.cameras) c.blink = (c.blink + dt) % 2;
      return;
    }

    this.time += dt;
    if (this.jam > 0) this.jam = Math.max(0, this.jam - dt);

    this.updatePlayer(dt);
    this.updateLoot(dt);
    this.updateClouds(dt);
    this.updateCoins(dt);
    this.updateCameras(dt);
    this.updateGuards(dt);
    this.updateAlarm(dt);
    this.checkOutcome();
    this.events.length = 0;
  }

  // ------------------------------------------------------------ the thief

  updatePlayer(dt) {
    const p = this.player;
    const input = this.input ?? { up: false, down: false, left: false, right: false, sprint: false, crouch: false };

    let ax = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let ay = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const mag = Math.hypot(ax, ay);
    if (mag > 0) {
      ax /= mag;
      ay /= mag;
    }

    p.stance = input.crouch ? 'crouch' : input.sprint && mag > 0 ? 'sprint' : 'walk';
    const carrying = p.carry !== null;
    let base = p.stance === 'sprint' ? PLAYER.sprint : p.stance === 'crouch' ? PLAYER.crouch : PLAYER.walk;
    if (carrying) base *= PLAYER.carrySlowdown;
    if (p.grab > 0) base *= 0.25;

    const targetVx = ax * base;
    const targetVy = ay * base;
    p.vx = damp(p.vx, targetVx, PLAYER.accel, dt);
    p.vy = damp(p.vy, targetVy, PLAYER.accel, dt);
    if (mag === 0) {
      p.vx = damp(p.vx, 0, 14, dt);
      p.vy = damp(p.vy, 0, 14, dt);
    }

    const next = resolveSolids(p.x + p.vx * dt, p.y + p.vy * dt, p.radius);
    p.x = next.x;
    p.y = next.y;
    p.speed = Math.hypot(p.vx, p.vy);

    if (mag > 0) {
      const want = Math.atan2(ay, ax);
      p.facing = angleLerp(p.facing, want, Math.min(1, dt * 16));
    } else if (this.aim) {
      p.facing = angleLerp(p.facing, this.aim, Math.min(1, dt * 6));
    }
    p.bob += p.speed * dt * 0.16;

    // Footsteps make noise; crouching makes none.
    const noise = PLAYER.noise[p.stance] ?? 0;
    p.noise = noise;
    if (noise > 0 && p.speed > 20) {
      p.stepTimer -= dt;
      if (p.stepTimer <= 0) {
        p.stepTimer = p.stance === 'sprint' ? 0.32 : 0.55;
        this.emitNoise(p.x, p.y, noise);
      }
    } else {
      p.stepTimer = 0;
    }

    // Tools cool down.
    for (const id of Object.keys(this.tools)) {
      const t = this.tools[id];
      if (t.cooldown > 0) t.cooldown = Math.max(0, t.cooldown - dt);
    }

    // Trail for the motion smear.
    if (p.speed > 40) {
      this.trail.push({ x: p.x, y: p.y, life: 0.28, stance: p.stance });
      if (this.trail.length > 26) this.trail.shift();
    }
    for (const t of this.trail) t.life -= dt;
    this.trail = this.trail.filter((t) => t.life > 0);

    p.hurt = Math.max(0, p.hurt - dt * 2);
    p.stagger = Math.max(0, p.stagger - dt);
    p.hidden = this.isHidden();
  }

  isHidden() {
    const p = this.player;
    for (const c of this.clouds) {
      if (c.life > 0 && dist(p.x, p.y, c.x, c.y) < c.radius * 0.9) return true;
    }
    return false;
  }

  emitNoise(x, y, radius) {
    this.noisePulse = 1;
    this.noiseRadius = radius;
    this.events.push({ kind: 'noise', x, y, radius });
    for (const g of this.guards) {
      if (g.state === GUARD_STATE.chase) continue;
      if (dist(x, y, g.x, g.y) > radius) continue;
      if (g.state === GUARD_STATE.investigate || g.state === GUARD_STATE.search) continue;
      this.sendGuardTo(g, x, y, GUARD_STATE.investigate);
    }
  }

  // ------------------------------------------------------------ loot

  updateLoot(dt) {
    const p = this.player;
    let best = null;
    let bestD = Infinity;
    for (const l of this.loot) {
      if (l.taken) continue;
      const d = dist(p.x, p.y, l.x, l.y);
      if (d < PLAYER.reach + l.plinth * 0.35 && d < bestD) {
        bestD = d;
        best = l;
      }
      l.glow = Math.max(0, l.glow - dt);
    }

    if (this.grabHeld && best && p.grabTarget !== best) {
      p.grabTarget = best;
      p.grab = 0;
    }
    if (!this.grabHeld) {
      p.grabTarget = null;
      p.grab = Math.max(0, p.grab - dt * 3);
    }

    if (this.grabHeld && p.grabTarget) {
      p.grab += dt / PLAYER.grabTime;
      if (p.grab >= 1) {
        const target = p.grabTarget;
        target.taken = true;
        target.glow = 1;
        this.carryTotal += target.value;
        p.carry = target;
        p.carryValue = this.carryTotal;
        p.grab = 0;
        p.grabTarget = null;
        this.grabHeld = false;
        this.emitNoise(p.x, p.y, 150);
        this.burst(target.x, target.y, PALETTE.loot, 26, 130);
        this.say(`${target.name} secured. ${target.primary ? 'Now get to the loading bay.' : 'Keep moving.'}`, 3.4);
        this.shake = Math.min(1, this.shake + 0.18);
      }
    }

    if (best) {
      this.prompt = `Hold E to lift the ${best.name} · $${best.value.toLocaleString('en-US')}`;
      this.promptAge = 0.2;
    }
  }

  // ------------------------------------------------------------ tools

  useTool(id, aimX, aimY) {
    if (this.phase !== PHASE.play) return false;
    const def = TOOLS[id];
    const slot = this.tools[id];
    if (!def || !slot) return false;
    if (slot.charges <= 0) {
      this.say(`No ${def.name.toLowerCase()} left in the bag.`, 2.2);
      return false;
    }
    if (slot.cooldown > 0) return false;

    const p = this.player;
    const d = dist(p.x, p.y, aimX, aimY);
    const capped = d > def.range ? { x: p.x + ((aimX - p.x) / d) * def.range, y: p.y + ((aimY - p.y) / d) * def.range } : { x: aimX, y: aimY };

    slot.charges -= 1;
    slot.cooldown = 0.5;
    this.stats.toolsUsed += 1;

    if (id === 'smoke') {
      this.clouds.push({ x: capped.x, y: capped.y, radius: 92, age: 0, life: 7.2, kind: 'smoke' });
      this.burst(capped.x, capped.y, PALETTE.smoke, 22, 70);
      this.say('Smoke up. Every cone through it goes blind.', 2.6);
      this.emitNoise(capped.x, capped.y, 120);
    } else if (id === 'coin') {
      this.coins.push({ x: p.x, y: p.y, tx: capped.x, ty: capped.y, t: 0, life: 1.4, ringed: false });
      this.say('Coin away.', 1.6);
    } else if (id === 'emp') {
      for (const c of this.cameras) {
        if (dist(c.x, c.y, p.x, p.y) <= def.range) {
          c.dark = 9;
          c.state = 'dark';
          c.detect = 0;
        }
      }
      this.burst(p.x, p.y, PALETTE.camCalm, 34, 220);
      this.cameraFlash = 1;
      this.say('EMP. Cameras in range are dark for nine seconds.', 3);
      this.emitNoise(p.x, p.y, 210);
    } else if (id === 'jammer') {
      this.jam = 8;
      this.burst(p.x, p.y, PALETTE.teal, 24, 150);
      this.say('Jammer running: the alarm holds still for eight seconds.', 3);
    }
    return true;
  }

  updateClouds(dt) {
    for (const c of this.clouds) {
      c.age += dt;
      c.life -= dt;
    }
    this.clouds = this.clouds.filter((c) => c.life > 0);
  }

  updateCoins(dt) {
    for (const coin of this.coins) {
      coin.t += dt;
      const t = Math.min(1, coin.t / 0.45);
      if (!coin.ringed && t >= 1) {
        coin.ringed = true;
        this.emitNoise(coin.tx, coin.ty, 260);
        for (const g of this.guards) {
          if (g.state === GUARD_STATE.chase) continue;
          if (dist(coin.tx, coin.ty, g.x, g.y) <= 420) this.sendGuardTo(g, coin.tx, coin.ty, GUARD_STATE.investigate);
        }
        this.burst(coin.tx, coin.ty, PALETTE.brass, 12, 90);
      }
      coin.life -= dt;
    }
    this.coins = this.coins.filter((c) => c.life > 0);
  }

  sendGuardTo(g, x, y, state) {
    g.state = state;
    g.stateAge = 0;
    g.target = { x, y };
    g.patienceLeft = g.spec.patience;
  }

  // ------------------------------------------------------------ cameras

  updateCameras(dt) {
    const p = this.player;
    for (const c of this.cameras) {
      c.blink = (c.blink + dt) % 2;
      if (c.dark > 0) {
        c.dark = Math.max(0, c.dark - dt);
        c.state = c.dark > 0 ? 'dark' : 'sweep';
        c.sees = false;
        c.detect = Math.max(0, c.detect - dt * 2);
        continue;
      }
      c.phase += dt;
      const swept = c.base + Math.sin((c.phase / c.period) * Math.PI * 2) * c.sweep;

      const visible = this.cameraCanSee(c, p);
      if (visible) {
        c.detect = Math.min(1, c.detect + dt / CAMERA.detectTime);
        c.sees = true;
      } else {
        c.detect = Math.max(0, c.detect - dt * 0.8);
        c.sees = false;
      }
      c.state = c.detect >= 1 ? 'track' : c.sees ? 'watch' : 'sweep';

      if (c.state === 'track') {
        const want = Math.atan2(p.y - c.y, p.x - c.x);
        c.angle = angleLerp(c.angle, want, Math.min(1, dt * CAMERA.alertTurnRate));
        this.stats.cameraFrames += 1;
        if (this.events.length === 0) {
          this.events.push({ kind: 'camera', x: c.x, y: c.y });
          for (const g of this.guards) {
            if (g.state !== GUARD_STATE.chase && dist(c.x, c.y, g.x, g.y) < 700) {
              this.sendGuardTo(g, p.x, p.y, GUARD_STATE.investigate);
              g.alert = Math.max(g.alert, 0.6);
            }
          }
        }
      } else if (c.detect > 0.25) {
        const want = Math.atan2(p.y - c.y, p.x - c.x);
        c.angle = angleLerp(c.angle, want, Math.min(1, dt * CAMERA.turnRate));
      } else {
        c.angle = angleLerp(c.angle, swept, Math.min(1, dt * CAMERA.turnRate));
      }
    }
  }

  cameraCanSee(c, p) {
    if (p.hidden) return false;
    if (!inCone(c.x, c.y, c.angle, CAMERA.halfAngle, c.range, p.x, p.y)) return false;
    if (segmentBlocked(c.x, c.y, p.x, p.y, SOLIDS)) return false;
    if (smokeBlocks(c.x, c.y, p.x, p.y, this.clouds)) return false;
    return true;
  }

  // ------------------------------------------------------------ guards

  updateGuards(dt) {
    const p = this.player;
    const hot = this.alarm >= ALARM.hotAt;

    for (const g of this.guards) {
      g.stateAge += dt;
      g.lookPhase += dt;
      const type = g.spec;

      // Can this guard see the thief right now?
      const range = type.range * (p.stance === 'crouch' ? PLAYER.crouchSpotFactor : 1);
      const coneAngle = g.facing;
      const inSight =
        !p.hidden &&
        inCone(g.x, g.y, coneAngle, type.halfAngle, range, p.x, p.y) &&
        !segmentBlocked(g.x, g.y, p.x, p.y, SOLIDS) &&
        !smokeBlocks(g.x, g.y, p.x, p.y, this.clouds);
      g.sees = inSight;
      if (inSight) {
        g.suspicion = Math.min(1, g.suspicion + dt / 1.15);
      } else {
        g.suspicion = Math.max(0, g.suspicion - dt * 0.7);
      }

      if (inSight && g.suspicion >= 0.55) {
        this.stats.seenFrames += 1;
        g.seesPlayer = true;
        g.lastKnown = { x: p.x, y: p.y };
        if (g.state !== GUARD_STATE.chase) {
          g.state = GUARD_STATE.chase;
          g.stateAge = 0;
          g.patienceLeft = type.patience + 1.6;
          this.shake = Math.min(1, this.shake + 0.35);
          this.events.push({ kind: 'spotted', x: g.x, y: g.y });
        }
      } else {
        g.seesPlayer = false;
      }

      let speed = g.speed * (hot ? 1.12 : 1);

      switch (g.state) {
        case GUARD_STATE.pause: {
          g.pauseLeft -= dt;
          const sway = Math.sin(g.lookPhase * (Math.PI * 2) / g.lookPeriod) * g.lookAmount;
          const want = this.pauseFacing(g) + sway;
          g.facing = angleLerp(g.facing, want, Math.min(1, dt * 3.4));
          if (g.pauseLeft <= 0) {
            g.state = GUARD_STATE.patrol;
            g.stateAge = 0;
          }
          break;
        }
        case GUARD_STATE.patrol: {
          const node = g.route[g.routeIndex];
          if (!node) {
            g.state = GUARD_STATE.pause;
            g.pauseLeft = 1;
            break;
          }
          const step = stepToward(g.x, g.y, node.x, node.y, speed, dt);
          g.x = step.x;
          g.y = step.y;
          const want = Math.atan2(node.y - g.y, node.x - g.x);
          g.facing = angleLerp(g.facing, want, Math.min(1, dt * 6));
          g.lookBase = g.facing;
          if (step.arrived) {
            g.state = GUARD_STATE.pause;
            g.pauseLeft = node.pause ?? 1;
            g.stateAge = 0;
            g.routeIndex = (g.routeIndex + 1) % g.route.length;
          }
          break;
        }
        case GUARD_STATE.investigate: {
          if (!g.target) {
            g.state = GUARD_STATE.return;
            break;
          }
          const step = stepToward(g.x, g.y, g.target.x, g.target.y, speed * 1.12, dt);
          g.x = step.x;
          g.y = step.y;
          const want = Math.atan2(g.target.y - g.y, g.target.x - g.x);
          g.facing = angleLerp(g.facing, want, Math.min(1, dt * 7));
          if (step.arrived) {
            g.state = GUARD_STATE.search;
            g.stateAge = 0;
            g.patienceLeft = type.patience;
            g.lookBase = g.facing;
          }
          break;
        }
        case GUARD_STATE.search: {
          const sway = Math.sin(g.stateAge * 3.1) * 0.9;
          g.facing = angleLerp(g.facing, g.lookBase + sway, Math.min(1, dt * 3));
          g.patienceLeft -= dt;
          if (g.patienceLeft <= 0) {
            g.state = GUARD_STATE.return;
            g.stateAge = 0;
          }
          break;
        }
        case GUARD_STATE.chase: {
          const aim = g.lastKnown ?? g.target ?? { x: p.x, y: p.y };
          const step = stepToward(g.x, g.y, aim.x, aim.y, speed * type.chase, dt);
          g.x = step.x;
          g.y = step.y;
          const want = Math.atan2(aim.y - g.y, aim.x - g.x);
          g.facing = angleLerp(g.facing, want, Math.min(1, dt * 9));
          if (inSight) {
            g.patienceLeft = type.patience + 1.6;
          } else {
            g.patienceLeft -= dt;
          }
          if (step.arrived && !inSight) {
            g.state = GUARD_STATE.search;
            g.stateAge = 0;
            g.patienceLeft = type.patience + 1.2;
            g.lookBase = g.facing;
          }
          if (g.patienceLeft <= 0) {
            g.state = GUARD_STATE.search;
            g.stateAge = 0;
            g.patienceLeft = type.patience;
            g.lookBase = g.facing;
          }
          // A guard who gets a hand on the thief shoves them off and shouts: the alarm jumps
          // hard, and only a meter driven to the top ends the night. One catch is survivable.
          if (dist(g.x, g.y, p.x, p.y) < g.radius + p.radius + 4) {
            this.grabbedBy(g, dt);
          }
          break;
        }
        case GUARD_STATE.return: {
          const node = g.route[g.homeIndex] ?? g.route[0];
          const step = stepToward(g.x, g.y, node.x, node.y, speed, dt);
          g.x = step.x;
          g.y = step.y;
          const want = Math.atan2(node.y - g.y, node.x - g.x);
          g.facing = angleLerp(g.facing, want, Math.min(1, dt * 6));
          if (step.arrived) {
            let nearest = 0;
            let nd = Infinity;
            for (let i = 0; i < g.route.length; i++) {
              const d = dist(g.x, g.y, g.route[i].x, g.route[i].y);
              if (d < nd) {
                nd = d;
                nearest = i;
              }
            }
            g.homeIndex = nearest;
            g.routeIndex = (nearest + 1) % g.route.length;
            g.state = GUARD_STATE.pause;
            g.pauseLeft = 0.6;
            g.stateAge = 0;
          }
          break;
        }
        default:
          break;
      }

      const res = resolveSolids(g.x, g.y, g.radius);
      g.x = res.x;
      g.y = res.y;
      g.alert = damp(g.alert, inSight ? 1 : g.state === GUARD_STATE.chase ? 0.7 : 0, 4, dt);
      g.bob += dt * (g.state === GUARD_STATE.chase ? 9 : 4);

      const guardRange = type.range * (p.stance === 'crouch' ? PLAYER.crouchSpotFactor : 1);
      g.cone = conePolygon(g.x, g.y, g.facing, type.halfAngle, guardRange, SOLIDS, 26);
    }
  }

  pauseFacing(g) {
    const node = g.route[g.homeIndex] ?? g.route[0];
    const prev = g.route[(g.homeIndex - 1 + g.route.length) % g.route.length];
    const dx = node.x - prev.x;
    const dy = node.y - prev.y;
    if (Math.abs(dx) + Math.abs(dy) < 1) return g.facing;
    return Math.atan2(dy, dx);
  }

  /**
   * Rebuild every cone and camera sight test from the bodies' current positions, without
   * advancing the clock. The live loop does this every step; a staged, frozen screenshot needs
   * it after its bodies have been placed, or a cone would still point from where a guard used
   * to stand.
   */
  refreshVision() {
    const p = this.player;
    for (const g of this.guards) {
      const range = g.spec.range * (p.stance === 'crouch' ? PLAYER.crouchSpotFactor : 1);
      g.cone = conePolygon(g.x, g.y, g.facing, g.spec.halfAngle, range, SOLIDS, 26);
    }
    for (const c of this.cameras) {
      c.sees = c.dark <= 0 && this.cameraCanSee(c, p);
    }
  }

  // ------------------------------------------------------------ alarm

  updateAlarm(dt) {
    const p = this.player;
    let seen = false;
    let camera = false;
    let hunted = false;

    for (const g of this.guards) {
      if (g.sees) seen = true;
      if (g.state === GUARD_STATE.chase && dist(g.x, g.y, p.x, p.y) < 260) hunted = true;
    }
    for (const c of this.cameras) if (c.state === 'track') camera = true;

    this.seen = seen;
    this.cameraSeen = camera;

    let delta = 0;
    if (seen) delta += ALARM.riseSeen;
    if (camera) delta += ALARM.riseCamera;
    if (hunted && !seen) delta += ALARM.riseHunted;
    if (delta === 0) delta = -ALARM.decay;

    if (this.jam > 0) delta = 0;
    this.alarm = clamp(this.alarm + delta * dt, 0, ALARM.max);

    if (this.alarm >= ALARM.max) this.bust(null);

    if (this.alarm >= ALARM.hotAt && !this.hot) {
      this.hot = true;
      this.say('The alarm is screaming. Every guard is converging on you.', 3.2);
      this.shake = 1;
    }
    if (this.hot && this.alarm < ALARM.hotAt - 12) this.hot = false;

    if (this.alarm < ALARM.calmAt) {
      for (const g of this.guards) {
        if (g.state === GUARD_STATE.search && g.stateAge > 3) {
          g.state = GUARD_STATE.return;
          g.stateAge = 0;
        }
      }
    }
  }

  /**
   * A guard's hand on the thief: the alarm takes a heavy jump, the thief is thrown clear and
   * briefly untouchable, and the guard recoils. Busted only when the meter is already full.
   */
  grabbedBy(guard, dt) {
    const p = this.player;
    if (p.stagger > 0) return;
    p.stagger = 1.6;
    p.hurt = 1;
    this.alarm = clamp(this.alarm + 34, 0, ALARM.max);
    this.shake = 1;
    this.burst(p.x, p.y, PALETTE.danger, 26, 180);
    const dx = p.x - guard.x;
    const dy = p.y - guard.y;
    const d = Math.hypot(dx, dy) || 1;
    const shove = 46;
    const to = resolveSolids(p.x + (dx / d) * shove, p.y + (dy / d) * shove, p.radius);
    p.x = to.x;
    p.y = to.y;
    p.vx = (dx / d) * 180;
    p.vy = (dy / d) * 180;
    guard.state = GUARD_STATE.search;
    guard.stateAge = 0;
    guard.patienceLeft = guard.spec.patience;
    guard.lookBase = guard.facing;
    this.say(`${guard.name} grabbed you. Run, and keep the alarm under control.`, 3.4);
    if (this.alarm >= ALARM.max) this.bust(guard);
    void dt;
  }

  bust(guard) {
    if (this.phase !== PHASE.play) return;
    this.phase = PHASE.busted;
    this.phaseAge = 0;
    this.bustedBy = guard ? `${guard.name}'s alarm` : 'The alarm';
    this.shake = 1;
    this.burst(this.player.x, this.player.y, PALETTE.danger, 40, 200);
  }

  checkOutcome() {
    const p = this.player;
    if (this.phase !== PHASE.play) return;
    const atExit = p.x <= EXIT.x + EXIT.w + 6 && p.y >= EXIT.y - 12 && p.y <= EXIT.y + EXIT.h + 12;
    if (atExit) {
      if (this.primary?.taken) {
        this.phase = PHASE.escaped;
        this.phaseAge = 0;
        this.escaped = true;
      } else {
        this.prompt = 'The diamond is still in the strongroom. You are not leaving without it.';
        this.promptAge = 0.25;
      }
    }
    if (this.time > 900) {
      this.phase = PHASE.busted;
      this.bustedBy = 'Dawn';
    }
  }

  // ------------------------------------------------------------ effects

  burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i++) {
      const a = this.rng() * Math.PI * 2;
      const s = speed * (0.3 + this.rng() * 0.7);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.5 + this.rng() * 0.8,
        max: 1.3,
        color,
        size: 1.6 + this.rng() * 2.6,
      });
    }
    if (this.particles.length > 320) this.particles.splice(0, this.particles.length - 320);
  }

  updateParticles(dt) {
    for (const pt of this.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 1 - dt * 3.2;
      pt.vy *= 1 - dt * 3.2;
      pt.life -= dt;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
  }

  // ------------------------------------------------------------ readouts for the HUD

  get roomName() {
    return roomAt(this.player.x, this.player.y)?.name ?? 'Loading bay';
  }

  get nearestLootDistance() {
    let best = Infinity;
    for (const l of this.loot) if (!l.taken) best = Math.min(best, dist(this.player.x, this.player.y, l.x, l.y));
    return best;
  }

  /** The alarm's own words, for the meter's caption. */
  get alarmLabel() {
    if (this.jam > 0) return 'Jammed';
    if (this.alarm >= ALARM.max) return 'Busted';
    if (this.alarm >= ALARM.hotAt) return 'Lockdown';
    if (this.alarm >= 55) return 'Hunted';
    if (this.alarm >= ALARM.calmAt) return 'Suspicious';
    return 'Quiet';
  }
}
