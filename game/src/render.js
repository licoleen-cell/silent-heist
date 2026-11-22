// Draws the museum and everything in it. World coordinates are the level's own (1600 x 900);
// the caller sets the transform so the same drawing works at any window size and in a screenshot.
// The order of the layers is the order of this file: floor, sight, walls, cover, loot, people.

import { ALARM, CAMERA, GUARD_TYPES, PALETTE, PLAYER } from './config.js';
import { BOUNDS, COVER, EXIT, PAINTINGS, ROOMS, WALLS, solidShapes } from './level.js';
import { conePolygon } from './geometry.js';
import { clamp, makeRng, TAU, withAlpha } from './util.js';

/** One seeded generator per room, so floor grain never crawls between frames. */
const floorRng = new Map();
function rngFor(key) {
  let r = floorRng.get(key);
  if (!r) {
    r = makeRng([...key].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 17));
    floorRng.set(key, r);
  }
  return r;
}

export function drawWorld(ctx, heist, view) {
  const t = view.time;
  drawVoid(ctx, t);
  drawFloor(ctx, t);
  drawPatrols(ctx, heist, t);
  drawSight(ctx, heist, t);
  drawWallShadows(ctx);
  drawWalls(ctx, t);
  drawCover(ctx);
  drawExit(ctx, heist, t);
  drawLoot(ctx, heist, t, view);
  drawCameras(ctx, heist, t);
  drawGuards(ctx, heist, t);
  drawThief(ctx, heist, t, view);
  drawSmoke(ctx, heist, t);
  drawCoins(ctx, heist, t);
  drawParticles(ctx, heist);
  drawAmbientLight(ctx, heist, t);
}

// ---------------------------------------------------------------- the frame

function drawVoid(ctx, t) {
  ctx.fillStyle = PALETTE.inkDeep;
  ctx.fillRect(-400, -400, BOUNDS.w + 800, BOUNDS.h + 800);
  // A faint grid outside the museum, like the display case's backdrop.
  ctx.save();
  ctx.strokeStyle = withAlpha(PALETTE.wallEdge, 0.05);
  ctx.lineWidth = 1;
  for (let x = -320; x < BOUNDS.w + 320; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, -320);
    ctx.lineTo(x, BOUNDS.h + 320);
    ctx.stroke();
  }
  for (let y = -320; y < BOUNDS.h + 320; y += 40) {
    ctx.beginPath();
    ctx.moveTo(-320, y);
    ctx.lineTo(BOUNDS.w + 320, y);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- floors

function drawFloor(ctx, t) {
  for (const room of ROOMS) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(room.x, room.y, room.w, room.h);
    ctx.clip();
    const base = {
      marble: PALETTE.floorStone,
      parquet: PALETTE.floorWood,
      stone: PALETTE.floorTile,
      steel: '#222b3c',
      concrete: '#282c37',
    }[room.floor];
    ctx.fillStyle = base;
    ctx.fillRect(room.x, room.y, room.w, room.h);

    if (room.floor === 'marble') drawMarble(ctx, room);
    else if (room.floor === 'parquet') drawParquet(ctx, room);
    else if (room.floor === 'stone') drawStone(ctx, room);
    else if (room.floor === 'steel') drawSteel(ctx, room);
    else drawConcrete(ctx, room);

    // A pool of warm light from the ceiling, and grime where the walls meet the floor.
    const g = ctx.createRadialGradient(
      room.x + room.w * 0.5,
      room.y + room.h * 0.42,
      20,
      room.x + room.w * 0.5,
      room.y + room.h * 0.5,
      Math.max(room.w, room.h) * 0.7,
    );
    g.addColorStop(0, 'rgba(255, 216, 158, 0.085)');
    g.addColorStop(0.55, 'rgba(255, 214, 150, 0.022)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0.26)');
    ctx.fillStyle = g;
    ctx.fillRect(room.x, room.y, room.w, room.h);
    ctx.restore();

    drawRoomLabel(ctx, room, t);
  }
}

function drawMarble(ctx, room) {
  const rng = rngFor('marble');
  const s = 84;
  for (let y = room.y; y < room.y + room.h; y += s) {
    for (let x = room.x; x < room.x + room.w; x += s) {
      const shift = ((y / s) | 0) % 2 === 0 ? 0 : s / 2;
      const px = x + shift;
      ctx.fillStyle = ((x / s + y / s) | 0) % 2 === 0 ? 'rgba(255,255,255,0.022)' : 'rgba(0,0,0,0.10)';
      ctx.fillRect(px, y, s - 2, s - 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.20)';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, y + 0.5, s - 2, s - 2);
      // A vein or two in each slab.
      if (rng() < 0.5) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(210,220,240,0.055)';
        ctx.lineWidth = 1.1;
        const sx = px + rng() * s;
        const sy = y + rng() * s;
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(sx + (rng() - 0.5) * 50, sy + rng() * 34, sx + (rng() - 0.5) * 26, sy + rng() * 62);
        ctx.stroke();
      }
    }
  }
}

function drawParquet(ctx, room) {
  const rng = rngFor('parquet');
  const h = 22;
  for (let y = room.y, row = 0; y < room.y + room.h; y += h, row++) {
    for (let x = room.x - (row % 2) * 40; x < room.x + room.w; x += 118) {
      ctx.fillStyle = `rgba(${120 + rng() * 26 | 0}, ${86 + rng() * 20 | 0}, ${78 + rng() * 16 | 0}, 0.13)`;
      ctx.fillRect(x, y, 116, h - 1);
      ctx.strokeStyle = 'rgba(0,0,0,0.26)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, 116, h - 1);
    }
  }
  ctx.strokeStyle = 'rgba(255,220,180,0.05)';
  ctx.lineWidth = 1;
  for (let x = room.x + 60; x < room.x + room.w; x += 240) {
    ctx.beginPath();
    ctx.moveTo(x, room.y);
    ctx.lineTo(x, room.y + room.h);
    ctx.stroke();
  }
}

function drawStone(ctx, room) {
  const rng = rngFor('stone');
  const s = 62;
  for (let y = room.y; y < room.y + room.h; y += s) {
    for (let x = room.x + ((y / s) | 0) % 2 * (s / 2); x < room.x + room.w; x += s) {
      const w = s - 3 + rng() * 2;
      const hh = s - 3 + rng() * 2;
      ctx.fillStyle = rng() < 0.5 ? 'rgba(255,255,255,0.026)' : 'rgba(0,0,0,0.13)';
      ctx.fillRect(x, y, w, hh);
      ctx.strokeStyle = 'rgba(0,0,0,0.28)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w, hh);
    }
  }
}

function drawSteel(ctx, room) {
  ctx.save();
  for (let y = room.y; y < room.y + room.h; y += 4) {
    ctx.fillStyle = y % 8 === 0 ? 'rgba(255,255,255,0.020)' : 'rgba(0,0,0,0.055)';
    ctx.fillRect(room.x, y, room.w, 2);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  for (let x = room.x + 96; x < room.x + room.w; x += 96) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, room.y);
    ctx.lineTo(x + 0.5, room.y + room.h);
    ctx.stroke();
  }
  // Rivets down the seams.
  for (let x = room.x + 96; x < room.x + room.w; x += 96) {
    for (let y = room.y + 24; y < room.y + room.h; y += 40) {
      ctx.beginPath();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.arc(x, y, 2.2, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.arc(x - 0.6, y - 0.6, 1.2, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawConcrete(ctx, room) {
  const rng = rngFor('concrete');
  for (let i = 0; i < 220; i++) {
    const x = room.x + rng() * room.w;
    const y = room.y + rng() * room.h;
    ctx.fillStyle = rng() < 0.5 ? 'rgba(255,255,255,0.020)' : 'rgba(0,0,0,0.14)';
    ctx.fillRect(x, y, 2 + rng() * 10, 2 + rng() * 6);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.30)';
  ctx.lineWidth = 1.4;
  for (let x = room.x + 210; x < room.x + room.w; x += 210) {
    ctx.beginPath();
    ctx.moveTo(x, room.y);
    ctx.lineTo(x, room.y + room.h);
    ctx.stroke();
  }
}

function drawRoomLabel(ctx, room, t) {
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '600 12px "Helvetica Neue", Arial, sans-serif';
  const label = room.name.toUpperCase();
  let x = room.x + 18;
  const y = room.y + 26;
  for (const ch of label) {
    ctx.fillText(ch, x, y);
    x += ctx.measureText(ch).width + 3.4;
  }
  ctx.strokeStyle = withAlpha(PALETTE.muted, 0.35);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(room.x + 18, y + 8);
  ctx.lineTo(room.x + 18 + Math.min(120, room.w * 0.3), y + 8);
  ctx.stroke();
  ctx.restore();
  void t;
}

// ---------------------------------------------------------------- sight

function drawSight(ctx, heist, t) {
  // Guard cones first, cameras over them: the camera's cool light reads as a second layer.
  for (const g of heist.guards) {
    if (!g.cone) continue;
    const alert = clamp(g.alert, 0, 1);
    const color = g.state === 'chase' ? PALETTE.coneAlert : alert > 0.45 ? PALETTE.coneWary : PALETTE.coneCalm;
    // A guard's cone is the game's "you are in trouble" signal, so it is painted stronger than
    // a camera's: at 0.30 the wedge averaged out to a grey wash on the gallery's pale parquet
    // (red only +1 over the floor), which read as fog rather than a beam of light.
    drawCone(ctx, g.cone, g.x, g.y, color, alert, 0.46, t);
  }
  for (const c of heist.cameras) {
    if (c.dark > 0) {
      const pts = conePolygon(c.x, c.y, c.angle, CAMERA.halfAngle, c.range, SOLIDS_FALLBACK, 20);
      ctx.save();
      ctx.globalAlpha = 0.10;
      ctx.fillStyle = '#5d6b80';
      fillPoly(ctx, pts);
      ctx.restore();
      continue;
    }
    const hot = c.state === 'track';
    const color = hot ? PALETTE.camAlert : PALETTE.camCalm;
    const pts = conePolygon(c.x, c.y, c.angle, CAMERA.halfAngle, c.range, SOLIDS_FALLBACK, 22);
    // A camera's wedge is the second hazard a player has to read. A sweeping camera keeps
    // enough body to be seen at a glance; only a dark one (EMP) falls back to the grey wash.
    drawCone(ctx, pts, c.x, c.y, color, hot ? 1 : c.sees ? 0.75 : 0.35, hot ? 0.28 : 0.24, t);
  }
}

/**
 * The guards' routes, drawn under the cones as a faint plan: a dashed loop through each route
 * node with a tick at the pauses. A player can read where a guard will walk before committing,
 * which is the difference between a stealth room and a guessing game.
 */
function drawPatrols(ctx, heist, t) {
  if (!heist.running) return;
  ctx.save();
  ctx.lineWidth = 1.2;
  for (const g of heist.guards) {
    if (!g.route || g.route.length < 2) continue;
    const spec = GUARD_TYPES[g.type];
    const hot = g.state === 'chase';
    const alpha = hot ? 0.30 : 0.17;
    ctx.strokeStyle = withAlpha(spec.color, alpha);
    ctx.setLineDash([3, 9]);
    ctx.lineDashOffset = -t * 14;
    ctx.beginPath();
    ctx.moveTo(g.route[0].x, g.route[0].y);
    for (let i = 1; i < g.route.length; i++) ctx.lineTo(g.route[i].x, g.route[i].y);
    if (g.route.length > 2) ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // A pause tick at each node: the beats where the cone sweeps instead of walking.
    for (const node of g.route) {
      ctx.fillStyle = withAlpha(spec.color, alpha + 0.10);
      ctx.beginPath();
      ctx.arc(node.x, node.y, 2.6, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

function fillPoly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

function drawCone(ctx, pts, ox, oy, color, alert, strength, t) {
  ctx.save();
  const reach = Math.max(...pts.map((p) => Math.hypot(p[0] - ox, p[1] - oy)), 40);
  // A lit wedge is the game's main readability cue, and it has to survive the brightest floor
  // in the museum as well as the darkest. The gallery's east end is lit to about 100 luminance,
  // so a cone fading to a light wash there vanished; the far rim now holds nearly full strength
  // and only the last sliver softens, which keeps the whole wedge above the floor it crosses.
  const g = ctx.createRadialGradient(ox, oy, 6, ox, oy, reach);
  g.addColorStop(0, withAlpha(color, Math.min(0.86, strength * (1.75 + alert * 0.6))));
  g.addColorStop(0.55, withAlpha(color, Math.min(0.78, strength * (1.5 + alert * 0.4))));
  g.addColorStop(0.88, withAlpha(color, strength * (1.15 + alert * 0.3)));
  g.addColorStop(1, withAlpha(color, strength * 0.66));
  ctx.fillStyle = g;
  fillPoly(ctx, pts);
  ctx.fill();

  // The cone's two edges, and a shimmering scan across its width.
  ctx.strokeStyle = withAlpha(color, 0.42 + alert * 0.35);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.stroke();

  ctx.save();
  fillPoly(ctx, pts);
  ctx.clip();
  const scan = ((t * 0.55 + ox * 0.01) % 1) * reach;
  const sg = ctx.createRadialGradient(ox, oy, Math.max(0, scan - 16), ox, oy, scan + 16);
  sg.addColorStop(0, withAlpha(color, 0));
  sg.addColorStop(0.5, withAlpha(color, 0.10 + alert * 0.08));
  sg.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = sg;
  ctx.fillRect(ox - reach, oy - reach, reach * 2, reach * 2);
  ctx.restore();
  ctx.restore();
}

const SOLIDS_FALLBACK = solidShapes();

// ---------------------------------------------------------------- walls

function drawWallShadows(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  for (const w of WALLS) {
    ctx.fillRect(w.x + 7, w.y + 9, w.w, w.h);
  }
  ctx.restore();
}

function drawWalls(ctx, t) {
  for (const w of WALLS) {
    const g = ctx.createLinearGradient(w.x, w.y, w.x, w.y + w.h);
    g.addColorStop(0, PALETTE.wall);
    g.addColorStop(1, PALETTE.wallFace);
    ctx.fillStyle = g;
    ctx.fillRect(w.x, w.y, w.w, w.h);
    // A lit cap along the top edge, the way a wall catches the ceiling light.
    ctx.fillStyle = withAlpha(PALETTE.wallEdge, 0.55);
    ctx.fillRect(w.x, w.y, w.w, 2.5);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(w.x, w.y + w.h - 2.5, w.w, 2.5);
    // Panel joints every 120 px on the long walls.
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1;
    if (w.w > w.h) {
      for (let x = w.x + 120; x < w.x + w.w; x += 120) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, w.y + 2);
        ctx.lineTo(x + 0.5, w.y + w.h - 2);
        ctx.stroke();
      }
    } else {
      for (let y = w.y + 120; y < w.y + w.h; y += 120) {
        ctx.beginPath();
        ctx.moveTo(w.x + 2, y + 0.5);
        ctx.lineTo(w.x + w.w - 2, y + 0.5);
        ctx.stroke();
      }
    }
  }
  drawPaintings(ctx);
  // Door frames: a brass threshold in each gap, so the routes read at a glance.
  for (const d of DOORS) {
    ctx.save();
    ctx.fillStyle = withAlpha(PALETTE.brass, 0.16);
    ctx.fillRect(d.x, d.y, d.w, d.h);
    ctx.strokeStyle = withAlpha(PALETTE.brass, 0.4);
    ctx.lineWidth = 1.5;
    if (d.w > d.h) {
      ctx.beginPath();
      ctx.moveTo(d.x, d.y + d.h / 2);
      ctx.lineTo(d.x + d.w, d.y + d.h / 2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(d.x + d.w / 2, d.y);
      ctx.lineTo(d.x + d.w / 2, d.y + d.h);
      ctx.stroke();
    }
    ctx.restore();
  }
  void t;
}

/**
 * The gaps between the wall rectangles: two wall runs sharing a face leave a doorway between
 * them, and the thresholds are derived rather than listed, so a moved wall cannot leave a
 * doorframe behind. Vertical runs are grouped by x, horizontal runs by y.
 */
const DOORS = (() => {
  const gaps = [];
  const byX = new Map();
  const byY = new Map();
  for (const w of WALLS) {
    if (w.h > w.w) {
      if (!byX.has(w.x)) byX.set(w.x, []);
      byX.get(w.x).push(w);
    } else if (w.w > w.h) {
      if (!byY.has(w.y)) byY.set(w.y, []);
      byY.get(w.y).push(w);
    }
  }
  for (const [x, runs] of byX) {
    runs.sort((a, b) => a.y - b.y);
    for (let i = 1; i < runs.length; i++) {
      const top = runs[i - 1].y + runs[i - 1].h;
      const gap = runs[i].y - top;
      if (gap > 30 && gap < 200) gaps.push({ x, y: top, w: runs[i].w, h: gap });
    }
  }
  for (const [y, runs] of byY) {
    runs.sort((a, b) => a.x - b.x);
    for (let i = 1; i < runs.length; i++) {
      const left = runs[i - 1].x + runs[i - 1].w;
      const gap = runs[i].x - left;
      if (gap > 30 && gap < 200) gaps.push({ x: left, y, w: gap, h: runs[i].h });
    }
  }
  return gaps;
})();

function drawPaintings(ctx) {
  const tones = {
    teal: ['#2f6f6b', '#5fb8ae', '#123033'],
    amber: ['#7a5220', '#d8a94e', '#2a1c0d'],
    rose: ['#6c2f3c', '#c98592', '#2a1118'],
  };
  for (const p of PAINTINGS) {
    const [dark, light, deep] = tones[p.tone] ?? tones.teal;
    ctx.save();
    if (p.vertical) {
      const w = 16;
      const h = p.h;
      ctx.fillStyle = '#0d1119';
      ctx.fillRect(p.x - 2, p.y - 2, w + 4, h + 4);
      const g = ctx.createLinearGradient(p.x, p.y, p.x + w, p.y + h);
      g.addColorStop(0, deep);
      g.addColorStop(0.5, light);
      g.addColorStop(1, dark);
      ctx.fillStyle = g;
      ctx.fillRect(p.x, p.y, w, h);
      ctx.strokeStyle = withAlpha(PALETTE.brass, 0.55);
      ctx.lineWidth = 1.6;
      ctx.strokeRect(p.x - 2, p.y - 2, w + 4, h + 4);
    } else if (p.w > 0) {
      ctx.fillStyle = '#0d1119';
      ctx.fillRect(p.x - 3, p.y - 3, p.w + 6, p.h + 6);
      const g = ctx.createLinearGradient(p.x, p.y, p.x + p.w, p.y + p.h);
      g.addColorStop(0, dark);
      g.addColorStop(0.45, light);
      g.addColorStop(1, deep);
      ctx.fillStyle = g;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      // A suggestion of a figure, not a picture.
      ctx.fillStyle = 'rgba(10,14,20,0.45)';
      ctx.beginPath();
      ctx.ellipse(p.x + p.w * 0.5, p.y + p.h * 0.62, p.w * 0.16, p.h * 0.3, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = withAlpha(PALETTE.brass, 0.55);
      ctx.lineWidth = 1.6;
      ctx.strokeRect(p.x - 3, p.y - 3, p.w + 6, p.h + 6);
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------- cover

function drawCover(ctx) {
  for (const c of COVER) {
    if (c.shape === 'circle') {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(c.x + 5, c.y + 7, c.r, c.r * 0.92, 0, 0, TAU);
      ctx.fill();
      // A column is a vertical mass, so it is lit from its north-west face: a bright core that
      // falls to a dark rim, with a hard shadow thrown south-east. Darker than the floor would
      // read as a hole, so the core is deliberately the brightest thing in the room.
      const g = ctx.createRadialGradient(c.x - c.r * 0.4, c.y - c.r * 0.45, 1, c.x, c.y, c.r);
      g.addColorStop(0, '#93a6c8');
      g.addColorStop(0.45, '#5f7092');
      g.addColorStop(1, '#2a3348');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = withAlpha('#d6e2f6', 0.55);
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.restore();
      continue;
    }
    drawCase(ctx, c);
  }
}

function drawCase(ctx, c) {
  // Furniture sits clearly above the floor in value and carries a lit top edge with a drop
  // shadow, because "is that a bench or a patch of floor?" is a question a stealth room must
  // never make the player ask. The floor runs at about 60-70; these tops run 95-125.
  const palette = {
    case: ['#38445e', '#5a6a8c'],
    bench: ['#3b3048', '#5e5075'],
    cabinet: ['#414e66', '#66768f'],
    desk: ['#3d4553', '#5d6a80'],
  }[c.kind] ?? ['#38445e', '#5a6a8c'];
  ctx.save();
  // A hard drop shadow to the south-east, so the object reads as standing up.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(c.x + 5, c.y + 7, c.w, c.h);
  const g = ctx.createLinearGradient(c.x, c.y, c.x, c.y + c.h);
  g.addColorStop(0, palette[1]);
  g.addColorStop(1, palette[0]);
  ctx.fillStyle = g;
  ctx.fillRect(c.x, c.y, c.w, c.h);
  ctx.strokeStyle = 'rgba(4,7,12,0.85)';
  ctx.lineWidth = 1.4;
  ctx.strokeRect(c.x + 0.5, c.y + 0.5, c.w - 1, c.h - 1);
  // The lit top edge, doubled: a bright line with a soft one under it.
  ctx.strokeStyle = withAlpha('#c8d8f2', 0.62);
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(c.x + 1, c.y + 1.5);
  ctx.lineTo(c.x + c.w - 1, c.y + 1.5);
  ctx.stroke();
  ctx.strokeStyle = withAlpha('#c8d8f2', 0.16);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(c.x + 1, c.y + 4);
  ctx.lineTo(c.x + c.w - 1, c.y + 4);
  ctx.stroke();
  if (c.kind === 'case') {
    // A vitrine: a glass top catching a highlight.
    ctx.fillStyle = 'rgba(160, 200, 230, 0.10)';
    ctx.fillRect(c.x + 4, c.y + 4, c.w - 8, c.h - 8);
    ctx.strokeStyle = withAlpha(PALETTE.brass, 0.3);
    ctx.strokeRect(c.x + 4.5, c.y + 4.5, c.w - 9, c.h - 9);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(c.x + 8, c.y + 7, c.w * 0.3, 2);
  }
  if (c.kind === 'bench') {
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    for (let x = c.x + 8; x < c.x + c.w - 4; x += 12) {
      ctx.beginPath();
      ctx.moveTo(x, c.y + 3);
      ctx.lineTo(x, c.y + c.h - 3);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- the way out

function drawExit(ctx, heist, t) {
  const has = heist.primary?.taken;
  const pulse = 0.5 + 0.5 * Math.sin(t * (has ? 5.5 : 2.2));
  ctx.save();
  ctx.beginPath();
  ctx.rect(EXIT.x - 2, EXIT.y - 2, EXIT.w + 4, EXIT.h + 4);
  ctx.clip();
  const g = ctx.createLinearGradient(EXIT.x, 0, EXIT.x + EXIT.w, 0);
  g.addColorStop(0, withAlpha(has ? PALETTE.teal : PALETTE.muted, 0.05));
  g.addColorStop(1, withAlpha(has ? PALETTE.teal : PALETTE.muted, 0.24 + pulse * 0.18));
  ctx.fillStyle = g;
  ctx.fillRect(EXIT.x - 2, EXIT.y - 2, EXIT.w + 4, EXIT.h + 4);
  ctx.strokeStyle = withAlpha(has ? PALETTE.teal : PALETTE.muted, 0.55 + pulse * 0.3);
  ctx.lineWidth = 1.6;
  ctx.setLineDash([7, 6]);
  ctx.strokeRect(EXIT.x + 3, EXIT.y + 3, EXIT.w - 6, EXIT.h - 6);
  ctx.setLineDash([]);
  ctx.restore();

  // A chevron pointing out of the bay, and the word under it.
  ctx.save();
  ctx.translate(EXIT.x + EXIT.w * 0.5, EXIT.y + EXIT.h * 0.5);
  ctx.strokeStyle = withAlpha(has ? PALETTE.teal : PALETTE.muted, 0.85);
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(4, -9);
  ctx.lineTo(-5, 0);
  ctx.lineTo(4, 9);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = withAlpha(has ? PALETTE.teal : PALETTE.muted, 0.9);
  ctx.font = '700 10px "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  const label = has ? 'VAN' : 'EXIT';
  let lx = EXIT.x + EXIT.w * 0.5 - (label.length * 7) / 2;
  for (const ch of label) {
    ctx.fillText(ch, lx, EXIT.y + EXIT.h + 14);
    lx += 7;
  }
  ctx.restore();
}

// ---------------------------------------------------------------- loot

const LOOT_TIERS = [
  { min: 50000, color: '#9fe8ff', glow: '#59c8f0' },
  { min: 12000, color: '#ffd86b', glow: '#d8a94e' },
  { min: 0, color: '#dfe7f5', glow: '#8b9cba' },
];

function tierOf(value) {
  return LOOT_TIERS.find((t) => value >= t.min) ?? LOOT_TIERS[2];
}

function drawLoot(ctx, heist, t, view) {
  for (const l of heist.loot) {
    if (l.taken) continue;
    const tier = tierOf(l.value);
    const bob = Math.sin(t * 1.7 + l.x * 0.01) * 2.6;
    const near = view.hoverLoot === l.id || view.promptLoot === l.id;

    // The ceiling spot on the floor around the plinth. Loot is the one warm-gold thing in a
    // room of blue-grey stone and steel, so the pool of light under it is the strongest
    // "this is worth money" cue on the floor.
    const spot = ctx.createRadialGradient(l.x, l.y, 4, l.x, l.y, l.plinth * 3.4);
    spot.addColorStop(0, withAlpha(tier.glow, 0.42));
    spot.addColorStop(0.5, withAlpha(tier.glow, 0.15));
    spot.addColorStop(1, withAlpha(tier.glow, 0));
    ctx.fillStyle = spot;
    ctx.beginPath();
    ctx.arc(l.x, l.y, l.plinth * 3.4, 0, TAU);
    ctx.fill();

    // Plinth.
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath();
    ctx.ellipse(l.x + 3, l.y + 8, l.plinth * 0.92, l.plinth * 0.5, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#252d3d';
    ctx.beginPath();
    ctx.ellipse(l.x, l.y + 4, l.plinth * 0.9, l.plinth * 0.5, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#42506c';
    ctx.beginPath();
    ctx.ellipse(l.x, l.y, l.plinth * 0.9, l.plinth * 0.5, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = withAlpha(PALETTE.brass, 1);
    ctx.lineWidth = 2.6;
    ctx.stroke();
    // An outer brass ring, so the plinth has the same silhouette at any zoom.
    ctx.strokeStyle = withAlpha(tier.color, 0.42);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.ellipse(l.x, l.y, l.plinth * 1.14, l.plinth * 0.63, 0, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = withAlpha(PALETTE.brass, 0.22);
    ctx.beginPath();
    ctx.ellipse(l.x, l.y - 1, l.plinth * 0.62, l.plinth * 0.34, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    // The piece itself.
    ctx.save();
    ctx.translate(l.x, l.y - 12 + bob);
    const halo = ctx.createRadialGradient(0, 0, 1, 0, 0, l.plinth * 1.15);
    halo.addColorStop(0, withAlpha(tier.color, 0.55 + l.glow * 0.4));
    halo.addColorStop(0.45, withAlpha(tier.glow, 0.18));
    halo.addColorStop(1, withAlpha(tier.glow, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, l.plinth * 1.15, 0, TAU);
    ctx.fill();
    drawGem(ctx, l.primary ? 15 : 11, tier, t + l.x * 0.02);
    ctx.restore();

    // Its name floats over the plinth, dim until the thief is close. While a briefing, pause
    // or result screen covers the room, the labels stay off: they would only be noise behind it.
    if (!heist.running) continue;
    const d = Math.hypot(heist.player.x - l.x, heist.player.y - l.y);
    const alpha = near ? 0.95 : clamp(1 - (d - 90) / 220, 0.16, 0.5);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.fillStyle = tier.color;
    ctx.font = '600 10px "Helvetica Neue", Arial, sans-serif';
    // The label hangs under the plinth unless that would leave the frame or cross a wall.
    let ly = l.y + l.plinth * 0.6 + 16;
    if (ly > BOUNDS.h - 30) ly = l.y - l.plinth * 0.6 - 16;
    const lw = ctx.measureText(l.name.toUpperCase()).width;
    const lx = clamp(l.x, lw / 2 + 8, BOUNDS.w - lw / 2 - 8);
    ctx.fillText(l.name.toUpperCase(), lx, ly);
    ctx.restore();

    if (l.primary) {
      // A ring that keeps sweeping the diamond, so the eye lands on it first.
      ctx.save();
      ctx.translate(l.x, l.y);
      const rr = 26 + Math.sin(t * 2.4) * 5;
      ctx.strokeStyle = withAlpha('#9fe8ff', 0.30 + 0.2 * Math.sin(t * 2.4));
      ctx.lineWidth = 1.3;
      ctx.setLineDash([4, 7]);
      ctx.beginPath();
      ctx.arc(0, 0, rr, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }
}

function drawGem(ctx, r, tier, phase) {
  const spin = Math.sin(phase) * 0.5 + 0.5;
  ctx.save();
  // Faceted diamond: a top point, two shoulders and a pointed bottom.
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(r * (0.6 + spin * 0.18), -r * 0.22);
  ctx.lineTo(r * 0.34, r * 0.86);
  ctx.lineTo(0, r * 1.02);
  ctx.lineTo(-r * 0.34, r * 0.86);
  ctx.lineTo(-r * (0.6 + spin * 0.18), -r * 0.22);
  ctx.closePath();
  const g = ctx.createLinearGradient(-r, -r, r, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.32, tier.color);
  g.addColorStop(1, tier.glow);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 0.9;
  ctx.stroke();
  // Interior facets.
  ctx.strokeStyle = withAlpha('#ffffff', 0.4);
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(0, r * 0.9);
  ctx.moveTo(-r * 0.55, -r * 0.2);
  ctx.lineTo(r * 0.55, -r * 0.2);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- cameras

function drawCameras(ctx, heist, t) {
  for (const c of heist.cameras) {
    const hot = c.state === 'track';
    const dead = c.dark > 0;
    const lamp = dead ? '#5a6373' : hot ? PALETTE.camAlert : PALETTE.camCalm;
    ctx.save();
    ctx.translate(c.x, c.y);

    // A pool of the camera's own light on the wall, so the mount is never lost in the dark.
    // The gallery's camera hangs on the far east wall, the darkest corner of the frame, so the
    // pool has to be strong enough to lift it off the wall at a glance.
    const halo = ctx.createRadialGradient(0, 0, 3, 0, 0, 52);
    halo.addColorStop(0, withAlpha(lamp, dead ? 0.14 : 0.44));
    halo.addColorStop(0.45, withAlpha(lamp, dead ? 0.06 : 0.18));
    halo.addColorStop(1, withAlpha(lamp, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, 52, 0, TAU);
    ctx.fill();

    // Wall plate with two bolts.
    ctx.fillStyle = dead ? '#39445c' : '#4a5876';
    ctx.beginPath();
    ctx.roundRect(-11, -9, 22, 18, 3);
    ctx.fill();
    ctx.strokeStyle = dead ? withAlpha(PALETTE.wallEdge, 0.9) : withAlpha(lamp, 0.75);
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.arc(-7, -5.5, 1.4, 0, TAU);
    ctx.arc(7, -5.5, 1.4, 0, TAU);
    ctx.arc(-7, 5.5, 1.4, 0, TAU);
    ctx.arc(7, 5.5, 1.4, 0, TAU);
    ctx.fill();

    ctx.save();
    ctx.rotate(c.angle);
    // Arm and housing, drawn larger than life so a camera reads even in a shrunk thumbnail.
    ctx.strokeStyle = '#9aa6c0';
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(15, 0);
    ctx.stroke();
    // Housing: brighter than the wall it sits on, with a cool rim so the shape reads as
    // hardware rather than a smudge even where the floor is at its darkest.
    ctx.fillStyle = dead ? '#4a5261' : '#6a7a99';
    ctx.beginPath();
    ctx.roundRect(13, -10, 22, 20, 4.5);
    ctx.fill();
    ctx.strokeStyle = dead ? 'rgba(170,180,198,0.8)' : withAlpha(lamp, 1);
    ctx.lineWidth = 1.9;
    ctx.stroke();
    // Lens, lit from inside.
    const lg = ctx.createRadialGradient(30, 0, 0.5, 31, 0, 9);
    lg.addColorStop(0, dead ? '#3d4450' : '#ffffff');
    lg.addColorStop(0.42, lamp);
    lg.addColorStop(1, withAlpha(lamp, 0.05));
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.arc(31, 0, 8.2, 0, TAU);
    ctx.fill();
    // A cool glint off the lens glass, so the eye catches it before it reads the label.
    ctx.fillStyle = withAlpha('#ffffff', dead ? 0.15 : 0.85);
    ctx.beginPath();
    ctx.arc(28.5, -2.6, 2.2, 0, TAU);
    ctx.fill();
    // Lens hood.
    ctx.fillStyle = 'rgba(8,11,17,0.85)';
    ctx.beginPath();
    ctx.moveTo(24, -10);
    ctx.lineTo(36, -10);
    ctx.lineTo(36, -5);
    ctx.lineTo(24, -5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // The camera's own name, small and cool, so the mount is unmistakable in a still.
    ctx.fillStyle = withAlpha(lamp, dead ? 0.45 : 0.95);
    ctx.font = '700 7.5px "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CAM', 0, 26);

    // Status light: a slow blink, a hard strobe when tracking, a cross when dark.
    if (!dead) {
      const blink = hot ? (Math.sin(t * 14) > 0 ? 1 : 0.15) : Math.sin(t * 2.4 + c.x) > 0.15 ? 0.95 : 0.3;
      ctx.fillStyle = withAlpha(hot ? PALETTE.danger : PALETTE.teal, blink);
      ctx.beginPath();
      ctx.arc(0, -13, 2.6, 0, TAU);
      ctx.fill();
      ctx.fillStyle = withAlpha(hot ? PALETTE.danger : PALETTE.teal, blink * 0.35);
      ctx.beginPath();
      ctx.arc(0, -13, 6.5, 0, TAU);
      ctx.fill();
    } else {
      ctx.strokeStyle = withAlpha('#c8d2e4', 0.9);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-3.5, -16.5);
      ctx.lineTo(3.5, -9.5);
      ctx.moveTo(3.5, -16.5);
      ctx.lineTo(-3.5, -9.5);
      ctx.stroke();
    }
    ctx.restore();

    // The camera's sweep arc, ticked like a gauge.
    if (!dead) {
      ctx.save();
      ctx.strokeStyle = withAlpha(hot ? PALETTE.camAlert : PALETTE.camCalm, 0.26);
      ctx.lineWidth = 1.1;
      ctx.setLineDash([5, 6]);
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.range * 0.6, c.angle - CAMERA.halfAngle, c.angle + CAMERA.halfAngle);
      ctx.stroke();
      ctx.restore();
    }
  }
}

// ---------------------------------------------------------------- people

function drawGuards(ctx, heist, t) {
  for (const g of heist.guards) {
    const spec = GUARD_TYPES[g.type];
    ctx.save();
    ctx.translate(g.x, g.y);

    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(2, 5, g.radius * 1.02, g.radius * 0.78, 0, 0, TAU);
    ctx.fill();

    // The body turns with the guard: a torso, a head, and a cap peak.
    ctx.save();
    ctx.rotate(g.facing + Math.PI / 2);
    const step = Math.sin(g.bob) * 1.6;
    // Coat.
    const body = ctx.createLinearGradient(0, -g.radius, 0, g.radius);
    body.addColorStop(0, spec.color);
    body.addColorStop(1, shade(spec.color, -0.42));
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 0, g.radius * 0.92, g.radius * 1.06, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(6,9,14,0.8)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // A rim light along the coat, so the figure separates from the floor.
    ctx.strokeStyle = withAlpha(spec.color, 0.55);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(0, 0, g.radius * 0.92, g.radius * 1.06, 0, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();

    // Shoulders.
    ctx.fillStyle = shade(spec.color, -0.18);
    ctx.beginPath();
    ctx.ellipse(-g.radius * 0.7, 2 + step, 4.2, 6.4, 0.3, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(g.radius * 0.7, 2 - step, 4.2, 6.4, -0.3, 0, TAU);
    ctx.fill();

    // Cap and peak.
    ctx.fillStyle = shade(spec.color, 0.22);
    ctx.beginPath();
    ctx.arc(0, -g.radius * 0.34, g.radius * 0.55, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(8,11,17,0.85)';
    ctx.beginPath();
    ctx.ellipse(0, -g.radius * 0.78, g.radius * 0.5, g.radius * 0.2, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    // A torch on the belt, and the state marker over the head.
    ctx.restore();

    if (g.state === 'chase' || g.suspicion > 0.55) {
      drawMarker(ctx, g.x, g.y - g.radius - 16, '!', PALETTE.danger, t);
    } else if (g.state === 'investigate' || g.state === 'search') {
      drawMarker(ctx, g.x, g.y - g.radius - 16, '?', PALETTE.amber, t);
    }
  }
}

function drawMarker(ctx, x, y, glyph, color, t) {
  const bob = Math.sin(t * 6) * 2;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.fillStyle = 'rgba(8,11,17,0.82)';
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = '800 12px "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyph, 0, 0.5);
  ctx.restore();
}

function drawThief(ctx, heist, t, view) {
  const p = heist.player;
  const crouch = p.stance === 'crouch';
  const sprint = p.stance === 'sprint';
  const r = crouch ? PLAYER.radius * 0.86 : PLAYER.radius;

  // The motion trail.
  for (const tr of heist.trail) {
    const a = (tr.life / 0.28) * 0.16;
    ctx.fillStyle = withAlpha(PALETTE.teal, a);
    ctx.beginPath();
    ctx.arc(tr.x, tr.y, r * 0.8, 0, TAU);
    ctx.fill();
  }

  // Footstep noise, drawn as a ring that fades with the step.
  if (p.noise > 0 && p.speed > 20) {
    const phase = 1 - p.stepTimer / (sprint ? 0.32 : 0.55);
    const ring = p.noise * (0.25 + phase * 0.55);
    ctx.save();
    ctx.strokeStyle = withAlpha(sprint ? PALETTE.amber : PALETTE.smoke, 0.16 * (1 - phase));
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, ring, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(p.x, p.y);

  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.ellipse(2, 5, r * 1.05, r * 0.8, 0, 0, TAU);
  ctx.fill();

  ctx.save();
  ctx.rotate(p.facing + Math.PI / 2);

  // Coat: dark, with a teal scarf so the thief reads at a glance.
  const coat = ctx.createLinearGradient(0, -r, 0, r);
  coat.addColorStop(0, '#3a4661');
  coat.addColorStop(1, '#141a26');
  ctx.fillStyle = coat;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * (crouch ? 1.02 : 0.9), r * (crouch ? 0.94 : 1.05), 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(4,7,11,0.9)';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // The pack, and whatever is in it.
  ctx.fillStyle = '#232c3d';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.62, r * 0.62, r * 0.42, 0, 0, TAU);
  ctx.fill();
  if (p.carry) {
    const tier = tierOf(p.carry.value);
    ctx.fillStyle = withAlpha(tier.color, 0.9);
    ctx.beginPath();
    ctx.arc(0, r * 0.62, r * 0.24, 0, TAU);
    ctx.fill();
  }

  // Hood.
  ctx.fillStyle = '#4a5876';
  ctx.beginPath();
  ctx.arc(0, -r * 0.36, r * 0.56, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(4,7,11,0.85)';
  ctx.stroke();
  // Scarf.
  ctx.strokeStyle = PALETTE.teal;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(0, -r * 0.16, r * 0.5, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  ctx.restore();

  // The alarm halo: a red rim that grows as the meter climbs.
  if (heist.alarm > ALARM.calmAt) {
    const a = clamp((heist.alarm - ALARM.calmAt) / (ALARM.max - ALARM.calmAt), 0, 1);
    ctx.strokeStyle = withAlpha(PALETTE.danger, 0.16 + a * 0.4 + Math.sin(t * 8) * 0.06);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, r + 5 + a * 3, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();

  // The mouse aim line, thin and short: where a tool would land.
  if (view.mouse?.active && heist.running) {
    const mx = view.mouse.x;
    const my = view.mouse.y;
    const d = Math.hypot(mx - p.x, my - p.y);
    if (d > 12) {
      ctx.save();
      ctx.strokeStyle = withAlpha(PALETTE.teal, 0.18);
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 8]);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(mx, my);
      ctx.stroke();
      ctx.restore();
    }
  }
}

// ---------------------------------------------------------------- effects

function drawSmoke(ctx, heist, t) {
  for (const c of heist.clouds) {
    const grow = Math.min(1, c.age * 2.6);
    const fade = clamp(c.life / 2.2, 0, 1);
    const r = c.radius * grow;
    ctx.save();
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + t * 0.25 + c.x * 0.01;
      const rr = r * (0.42 + ((i * 37) % 11) / 26);
      const px = c.x + Math.cos(a) * r * 0.42;
      const py = c.y + Math.sin(a) * r * 0.42;
      const g = ctx.createRadialGradient(px, py, 2, px, py, rr);
      g.addColorStop(0, `rgba(206, 216, 232, ${0.30 * fade})`);
      g.addColorStop(0.6, `rgba(160, 174, 196, ${0.17 * fade})`);
      g.addColorStop(1, 'rgba(140, 152, 176, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, rr, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawCoins(ctx, heist, t) {
  for (const c of heist.coins) {
    const k = Math.min(1, c.t / 0.45);
    const x = c.x + (c.tx - c.x) * k;
    const y = c.y + (c.ty - c.y) * k;
    ctx.save();
    ctx.fillStyle = PALETTE.brass;
    ctx.beginPath();
    ctx.arc(x, y, 3.4, 0, TAU);
    ctx.fill();
    if (c.ringed) {
      const p = clamp((c.life - 0.0) / 1.0, 0, 1);
      ctx.strokeStyle = withAlpha(PALETTE.brass, 0.5 * p);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(c.tx, c.ty, 18 + (1 - p) * 46, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawParticles(ctx, heist) {
  for (const p of heist.particles) {
    const a = clamp(p.life / p.max, 0, 1);
    ctx.fillStyle = withAlpha(p.color, a * 0.85);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.4 + a * 0.8), 0, TAU);
    ctx.fill();
  }
}

function drawAmbientLight(ctx, heist, t) {
  const p = heist.player;
  // The thief's own small light.
  const g = ctx.createRadialGradient(p.x, p.y, 8, p.x, p.y, 210);
  g.addColorStop(0, 'rgba(255, 226, 180, 0.075)');
  g.addColorStop(0.5, 'rgba(255, 210, 150, 0.028)');
  g.addColorStop(1, 'rgba(255, 200, 140, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 210, 0, TAU);
  ctx.fill();

  // Corners of the museum fall off, so the eye stays on the middle. Kept gentle: the east wall
  // carries a camera and two pieces of loot, and a heavy corner shadow drains their colour to
  // grey exactly where a still frame needs them to read.
  const v = ctx.createRadialGradient(BOUNDS.w * 0.5, BOUNDS.h * 0.5, BOUNDS.h * 0.55, BOUNDS.w * 0.5, BOUNDS.h * 0.5, BOUNDS.h * 1.02);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.14)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, BOUNDS.w, BOUNDS.h);
  void t;
}

/** Lighten (amount > 0) or darken a hex colour. */
export function shade(hex, amount) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const f = (v) => clamp(Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount), 0, 255);
  return `rgb(${f((n >> 16) & 255)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}
