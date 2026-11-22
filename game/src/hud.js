// The heads-up display: the alarm meter, the clock, the take, the tool belt, the loot manifest
// and the briefing and result screens. Drawn in view pixels (1280 x 720) over the world, in
// translucent glass panels so the room stays readable behind them.

import { ALARM, PALETTE, TOOL_ORDER, TOOLS } from './config.js';
import { formatClock, formatMoney, roundRect, spacedText, spacedWidth, withAlpha, clamp } from './util.js';
import { PHASE } from './sim.js';

const FONT = '"Helvetica Neue", "Segoe UI", Arial, sans-serif';
const MONO = '"SF Mono", "Consolas", "DejaVu Sans Mono", monospace';

export const VIEW = { w: 1280, h: 720 };

/** A glass panel: a dark fill, a hairline edge and a soft inner light at the top. */
function panel(ctx, x, y, w, h, r = 10, alpha = 0.72) {
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, `rgba(20, 27, 42, ${alpha})`);
  g.addColorStop(1, `rgba(11, 15, 23, ${alpha + 0.1})`);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = withAlpha(PALETTE.panelEdge, 0.85);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + 10, y + 1.5);
  ctx.lineTo(x + w - 10, y + 1.5);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.stroke();
  ctx.restore();
}

export function drawHud(ctx, heist, view) {
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  drawTopBar(ctx, heist, view);
  drawToolBelt(ctx, heist);
  drawManifest(ctx, heist);
  drawFooter(ctx, heist);
  if (heist.phase === PHASE.briefing) drawBriefing(ctx, heist, view);
  else if (heist.phase === PHASE.busted) drawResult(ctx, heist, false);
  else if (heist.phase === PHASE.escaped) drawResult(ctx, heist, true);
  else if (heist.phase === PHASE.paused) drawPaused(ctx);
  ctx.restore();
}

// ---------------------------------------------------------------- top bar

function drawTopBar(ctx, heist, view) {
  const y = 16;
  const h = 74;

  // Left: the job's name and where the thief stands.
  panel(ctx, 22, y, 252, h);
  ctx.save();
  ctx.fillStyle = PALETTE.brass;
  ctx.font = `700 10px ${FONT}`;
  spacedText(ctx, 'SILENT HEIST', 38, y + 22, 2.4);
  ctx.fillStyle = PALETTE.cream;
  ctx.font = `600 19px ${FONT}`;
  ctx.fillText('Meridian Museum', 38, y + 45);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `500 11px ${FONT}`;
  ctx.fillText(`You are in the ${heist.roomName}`, 38, y + 62);
  ctx.restore();

  // Centre: the alarm meter, the one gauge the whole game turns on.
  const ax = 292;
  const aw = 470;
  panel(ctx, ax, y, aw, h);
  drawAlarmMeter(ctx, heist, ax + 16, y + 12, aw - 32, h - 24, view);

  // Right: the clock and the take.
  panel(ctx, 790, y, 468, h);
  drawClock(ctx, heist, 806, y + 16);
  drawTake(ctx, heist, 986, y + 16);
  drawStance(ctx, heist, 1170, y + 16);
}

function drawAlarmMeter(ctx, heist, x, y, w, h, view) {
  const level = heist.alarm / ALARM.max;
  const label = heist.alarmLabel;
  const hot = heist.alarm >= ALARM.hotAt;
  const color = hot ? PALETTE.danger : heist.alarm >= 55 ? PALETTE.amber : level > 0.2 ? PALETTE.coneWary : PALETTE.teal;

  ctx.save();
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `700 10px ${FONT}`;
  spacedText(ctx, 'ALARM', x, y + 10, 2.6);

  ctx.textAlign = 'right';
  ctx.fillStyle = color;
  ctx.font = `700 15px ${FONT}`;
  ctx.fillText(label.toUpperCase(), x + w, y + 11);
  ctx.textAlign = 'left';

  const barY = y + 20;
  const barH = 18;
  // Track.
  roundRect(ctx, x, barY, w, barH, 5);
  ctx.fillStyle = 'rgba(4, 7, 12, 0.85)';
  ctx.fill();
  ctx.strokeStyle = withAlpha(PALETTE.panelEdge, 0.9);
  ctx.lineWidth = 1;
  ctx.stroke();

  // Fill, with a hot core.
  const fillW = Math.max(0, w * clamp(level, 0, 1));
  if (fillW > 0) {
    ctx.save();
    roundRect(ctx, x, barY, w, barH, 5);
    ctx.clip();
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, withAlpha(PALETTE.teal, 0.95));
    g.addColorStop(0.45, withAlpha(PALETTE.amber, 0.95));
    g.addColorStop(0.78, withAlpha(PALETTE.danger, 0.95));
    g.addColorStop(1, withAlpha(PALETTE.dangerDeep, 0.98));
    ctx.fillStyle = g;
    ctx.fillRect(x, barY, fillW, barH);
    ctx.fillStyle = 'rgba(255,255,255,0.20)';
    ctx.fillRect(x, barY + 2, fillW, 4);
    if (hot) {
      ctx.fillStyle = withAlpha(PALETTE.danger, 0.16 + 0.16 * Math.sin(view.time * 10));
      ctx.fillRect(x, barY, w, barH);
    }
    ctx.restore();
  }

  // Tick marks: the calm line and the lockdown line.
  const ticks = [
    { at: ALARM.calmAt / ALARM.max, color: withAlpha(PALETTE.teal, 0.75) },
    { at: ALARM.hotAt / ALARM.max, color: withAlpha(PALETTE.danger, 0.75) },
  ];
  for (const t of ticks) {
    ctx.strokeStyle = t.color;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x + w * t.at, barY - 2);
    ctx.lineTo(x + w * t.at, barY + barH + 2);
    ctx.stroke();
  }

  ctx.fillStyle = withAlpha(PALETTE.muted, 0.95);
  ctx.font = `600 9px ${FONT}`;
  ctx.fillText('QUIET', x, barY + barH + 13);
  ctx.textAlign = 'center';
  ctx.fillText('SUSPICIOUS', x + w * 0.5, barY + barH + 13);
  ctx.textAlign = 'right';
  ctx.fillText('LOCKDOWN', x + w, barY + barH + 13);
  ctx.textAlign = 'left';

  if (heist.jam > 0) {
    ctx.save();
    ctx.fillStyle = withAlpha(PALETTE.teal, 0.9);
    ctx.font = `700 10px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(`JAMMED ${heist.jam.toFixed(1)}s`, x + w * 0.5, barY + barH + 13);
    ctx.restore();
  }
  ctx.restore();
}

function drawClock(ctx, heist, x, y) {
  ctx.save();
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `700 10px ${FONT}`;
  spacedText(ctx, 'TIME IN', x, y + 2, 2.2);
  ctx.fillStyle = PALETTE.cream;
  ctx.font = `600 26px ${MONO}`;
  ctx.fillText(formatClock(heist.time), x, y + 30);
  ctx.fillStyle = withAlpha(PALETTE.muted, 0.8);
  ctx.font = `500 10px ${FONT}`;
  ctx.fillText('dawn at 15:00', x, y + 44);
  ctx.restore();
}

function drawTake(ctx, heist, x, y) {
  ctx.save();
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `700 10px ${FONT}`;
  spacedText(ctx, 'THE TAKE', x, y + 2, 2.2);
  ctx.fillStyle = heist.carryTotal > 0 ? PALETTE.loot : PALETTE.cream;
  ctx.font = `600 26px ${MONO}`;
  ctx.fillText(formatMoney(heist.carryTotal), x, y + 30);
  const pieces = heist.loot.filter((l) => l.taken).length;
  ctx.fillStyle = withAlpha(PALETTE.muted, 0.85);
  ctx.font = `500 10px ${FONT}`;
  ctx.fillText(`${pieces} of ${heist.loot.length} pieces lifted`, x, y + 44);
  ctx.restore();
}

function drawStance(ctx, heist, x, y) {
  const p = heist.player;
  const stance = p.stance.toUpperCase();
  const carrying = p.carry !== null;
  ctx.save();
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `700 10px ${FONT}`;
  spacedText(ctx, 'STANCE', x, y + 2, 2.2);
  ctx.fillStyle = p.stance === 'sprint' ? PALETTE.amber : p.stance === 'crouch' ? PALETTE.teal : PALETTE.cream;
  ctx.font = `700 15px ${FONT}`;
  ctx.fillText(stance, x, y + 22);
  ctx.fillStyle = withAlpha(PALETTE.muted, 0.85);
  ctx.font = `500 10px ${FONT}`;
  ctx.fillText(carrying ? 'Carrying loot' : 'Hands free', x, y + 38);
  // A little noise meter under it: three bars, lit by stance.
  const bars = p.stance === 'crouch' ? 0 : p.stance === 'sprint' ? 3 : 1;
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i < bars ? (bars === 3 ? PALETTE.amber : PALETTE.teal) : 'rgba(255,255,255,0.10)';
    ctx.fillRect(x + i * 7, y + 46 - i * 0, 4, 4);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- tool belt

function drawToolBelt(ctx, heist) {
  const slots = TOOL_ORDER;
  const cardW = 118;
  const gap = 8;
  const totalW = slots.length * cardW + (slots.length - 1) * gap;
  const x0 = 22;
  const y = VIEW.h - 96;

  for (let i = 0; i < slots.length; i++) {
    const id = slots[i];
    const def = TOOLS[id];
    const slot = heist.tools[id];
    const x = x0 + i * (cardW + gap);
    const empty = slot.charges <= 0;
    const ready = !empty && slot.cooldown <= 0;

    ctx.save();
    panel(ctx, x, y, cardW, 80, 9, empty ? 0.55 : 0.8);
    if (ready) {
      roundRect(ctx, x, y, cardW, 80, 9);
      ctx.strokeStyle = withAlpha(PALETTE.teal, 0.5);
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // The key cap.
    ctx.fillStyle = empty ? 'rgba(255,255,255,0.06)' : withAlpha(PALETTE.brass, 0.18);
    roundRect(ctx, x + 10, y + 10, 18, 18, 4);
    ctx.fill();
    ctx.strokeStyle = empty ? 'rgba(255,255,255,0.12)' : withAlpha(PALETTE.brass, 0.55);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = empty ? 'rgba(255,255,255,0.3)' : PALETTE.brass;
    ctx.font = `700 11px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText(String(def.slot), x + 19, y + 23);
    ctx.textAlign = 'left';

    // Icon.
    drawToolIcon(ctx, id, x + 44, y + 22, empty);

    // Charges as pips.
    for (let c = 0; c < Math.max(slot.charges, 0); c++) {
      ctx.fillStyle = withAlpha(PALETTE.teal, 0.9);
      ctx.beginPath();
      ctx.arc(x + cardW - 14 - c * 9, y + 20, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    if (empty) {
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.font = `600 9px ${FONT}`;
      ctx.textAlign = 'right';
      ctx.fillText('EMPTY', x + cardW - 10, y + 23);
      ctx.textAlign = 'left';
    }

    ctx.fillStyle = empty ? 'rgba(242,233,214,0.35)' : PALETTE.cream;
    ctx.font = `600 11.5px ${FONT}`;
    const name = def.name;
    ctx.fillText(name.length > 15 ? `${name.slice(0, 14)}…` : name, x + 10, y + 40);

    // What the charge cost, and how many are left. The price belongs on the card: spending a
    // charge is the decision the budget is there to make interesting.
    ctx.fillStyle = empty ? withAlpha(PALETTE.muted, 0.5) : PALETTE.brass;
    ctx.font = `700 10px ${MONO}`;
    ctx.fillText(formatMoney(def.cost), x + 10, y + 55);
    ctx.textAlign = 'right';
    ctx.fillStyle = empty ? withAlpha(PALETTE.muted, 0.5) : PALETTE.teal;
    ctx.font = `700 10px ${MONO}`;
    ctx.fillText(`${Math.max(0, slot.charges)} left`, x + cardW - 10, y + 55);
    ctx.textAlign = 'left';

    ctx.fillStyle = withAlpha(PALETTE.muted, empty ? 0.5 : 0.9);
    ctx.font = `500 9.5px ${FONT}`;
    ctx.fillText(id === 'jammer' ? 'Holds the meter' : `Reach ${def.range}`, x + 10, y + 69);
    ctx.restore();
  }
}

function drawToolIcon(ctx, id, cx, cy, dim) {
  ctx.save();
  ctx.translate(cx, cy);
  const tint = dim ? 'rgba(200,210,230,0.28)' : PALETTE.cream;
  ctx.strokeStyle = tint;
  ctx.fillStyle = tint;
  ctx.lineWidth = 1.5;
  if (id === 'smoke') {
    ctx.beginPath();
    ctx.arc(-3, 1, 3.2, 0, Math.PI * 2);
    ctx.arc(2, -2, 2.6, 0, Math.PI * 2);
    ctx.arc(3, 3, 2.2, 0, Math.PI * 2);
    ctx.stroke();
  } else if (id === 'coin') {
    ctx.beginPath();
    ctx.arc(0, 0, 4.4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 1.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (id === 'emp') {
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(-3.4, 0.4);
    ctx.lineTo(0.4, 0.4);
    ctx.lineTo(-1, 6);
    ctx.lineTo(4, -1);
    ctx.lineTo(0.2, -1);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(0, 5);
    ctx.lineTo(0, -2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -4.6, 2.4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -4.6, 5.4, -0.9, 0.9);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- manifest

function drawManifest(ctx, heist) {
  // A strip along the bottom right, level with the tool belt: the belt is the kit you carry,
  // the manifest is the loot you came for. Keeping it out of the right-hand column leaves the
  // east wall (where two cameras hang) and the whole gallery unobstructed.
  const x = 560;
  const w = VIEW.w - x - 22;
  const h = 80;
  const y = VIEW.h - 96;

  panel(ctx, x, y, w, h, 9, 0.78);
  ctx.save();
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `700 10px ${FONT}`;
  spacedText(ctx, 'MANIFEST', x + 14, y + 21, 2.4);
  const taken = heist.loot.filter((l) => l.taken).length;
  ctx.fillStyle = withAlpha(PALETTE.muted, 0.85);
  ctx.font = `600 10px ${FONT}`;
  const mid = `${taken} of ${heist.loot.length} lifted`;
  ctx.fillText(mid, x + 96, y + 21);
  ctx.textAlign = 'right';
  ctx.fillStyle = taken > 0 ? PALETTE.loot : withAlpha(PALETTE.muted, 0.8);
  ctx.font = `600 10px ${MONO}`;
  ctx.fillText(formatMoney(heist.carryTotal), x + w - 14, y + 21);
  ctx.textAlign = 'left';

  const sorted = [...heist.loot].sort((a, b) => (b.primary ? 1 : 0) - (a.primary ? 1 : 0) || b.value - a.value);
  const gap = 6;
  const chipW = (w - 28 - gap * (sorted.length - 1)) / sorted.length;
  for (let i = 0; i < sorted.length; i++) {
    const l = sorted[i];
    const cx = x + 14 + i * (chipW + gap);
    const cy = y + 34;
    const ch = 34;
    const tier = tierOfValue(l.value);
    roundRect(ctx, cx, cy, chipW, ch, 6);
    ctx.fillStyle = l.taken ? withAlpha(PALETTE.teal, 0.13) : l.primary ? withAlpha(PALETTE.loot, 0.12) : 'rgba(255,255,255,0.035)';
    ctx.fill();
    ctx.strokeStyle = l.taken ? withAlpha(PALETTE.teal, 0.5) : l.primary ? withAlpha(PALETTE.loot, 0.55) : withAlpha(PALETTE.panelEdge, 0.85);
    ctx.lineWidth = 1;
    ctx.stroke();

    // A gem mark, filled when lifted.
    const gx = cx + 12;
    const gy = cy + ch / 2;
    ctx.beginPath();
    ctx.moveTo(gx, gy - 6);
    ctx.lineTo(gx + 5, gy - 1.4);
    ctx.lineTo(gx, gy + 6);
    ctx.lineTo(gx - 5, gy - 1.4);
    ctx.closePath();
    if (l.taken) {
      ctx.fillStyle = PALETTE.teal;
      ctx.fill();
    } else {
      ctx.strokeStyle = tier;
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }

    ctx.fillStyle = l.taken ? withAlpha(PALETTE.muted, 0.7) : l.primary ? PALETTE.loot : PALETTE.cream;
    ctx.font = `600 10px ${MONO}`;
    ctx.fillText(shortMoney(l.value), cx + 22, cy + 16);
    ctx.fillStyle = l.taken ? withAlpha(PALETTE.teal, 0.85) : withAlpha(PALETTE.muted, 0.8);
    ctx.font = `500 8px ${FONT}`;
    ctx.fillText(l.taken ? 'LIFTED' : shortName(l.name), cx + 22, cy + 27);
  }
  ctx.restore();
}

/** Money in the compact form the manifest chips need: $60k, $9k. */
function shortMoney(value) {
  return value >= 1000 ? `$${Math.round(value / 1000)}k` : `$${value}`;
}

/** The first word or two of a piece's name, cut to fit a chip. */
function shortName(name) {
  const first = name.split(' ').slice(-1)[0];
  return first.length > 9 ? `${first.slice(0, 8)}…` : first;
}

/** The manifest's own colour tiers, by value. */
function tierOfValue(value) {
  if (value >= 50000) return '#9fe8ff';
  if (value >= 12000) return PALETTE.loot;
  return '#dfe7f5';
}

// ---------------------------------------------------------------- footer

function drawFooter(ctx, heist) {
  // Above the tool belt, never through it: the belt owns the bottom-left corner.
  const y = VIEW.h - 118;
  ctx.save();
  const prompt = heist.promptAge > 0 ? heist.prompt : null;
  if (prompt) {
    ctx.font = `600 13px ${FONT}`;
    const tw = ctx.measureText(prompt).width;
    panel(ctx, VIEW.w / 2 - tw / 2 - 18, y - 22, tw + 36, 34, 8, 0.86);
    ctx.fillStyle = PALETTE.loot;
    ctx.textAlign = 'center';
    ctx.fillText(prompt, VIEW.w / 2, y - 1);
    ctx.textAlign = 'left';
  } else if (heist.toastAge > 0 && heist.toast) {
    ctx.font = `500 12.5px ${FONT}`;
    const tw = Math.min(ctx.measureText(heist.toast).width, 620);
    ctx.globalAlpha = clamp(heist.toastAge, 0, 1);
    panel(ctx, VIEW.w / 2 - tw / 2 - 18, y - 22, tw + 36, 34, 8, 0.8);
    ctx.fillStyle = PALETTE.cream;
    ctx.textAlign = 'center';
    ctx.fillText(heist.toast, VIEW.w / 2, y - 1);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }

  // Controls, in the corner where they never cover the room.
  ctx.fillStyle = withAlpha(PALETTE.muted, 0.75);
  ctx.font = `500 10.5px ${FONT}`;
  const keys = 'WASD move · Shift sprint · Ctrl crouch · E lift · 1-4 tools · click to aim · P pause';
  ctx.fillText(keys, 22, VIEW.h - 12);
  ctx.restore();
}

// ---------------------------------------------------------------- screens

function drawBriefing(ctx, heist, view) {
  ctx.save();
  ctx.fillStyle = 'rgba(6, 8, 13, 0.72)';
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);

  const w = 700;
  const h = 452;
  const x = (VIEW.w - w) / 2;
  const y = (VIEW.h - h) / 2;
  panel(ctx, x, y, w, h, 14, 0.92);

  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.brass;
  ctx.font = `700 11px ${FONT}`;
  const kicker = 'THE MERIDIAN MUSEUM · 02:40';
  const kw = spacedWidth(ctx, kicker, 3.2);
  spacedText(ctx, kicker, VIEW.w / 2 - kw / 2, y + 40, 3.2);

  ctx.fillStyle = PALETTE.cream;
  ctx.font = `600 42px ${FONT}`;
  ctx.fillText('Silent Heist', VIEW.w / 2, y + 88);

  ctx.fillStyle = withAlpha(PALETTE.muted, 0.95);
  ctx.font = `400 14px ${FONT}`;
  wrapText(
    ctx,
    'The Moonfall Diamond is in the strongroom at the east end of the museum. Take it, and as much else as you can carry, then slip out through the loading bay on the west wall.',
    VIEW.w / 2,
    y + 124,
    w - 120,
    21,
  );

  // Three rules, in a row.
  const rules = [
    { n: '01', t: 'Stay out of the light', d: 'Guards see in a cone. Cameras sweep. Walls and cases break a sightline; crouching halves how far you are seen.' },
    { n: '02', t: 'Keep the alarm low', d: 'A seen thief fills the alarm. At lockdown every guard hunts. Let it fall quiet before you move again.' },
    { n: '03', t: 'Spend your kit', d: 'Smoke, coins, EMP and a jammer. Each charge is one problem solved, so choose the moment.' },
  ];
  const cw = (w - 96) / 3;
  for (let i = 0; i < rules.length; i++) {
    const rx = x + 40 + i * (cw + 8);
    const ry = y + 196;
    roundRect(ctx, rx, ry, cw, 120, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    ctx.fill();
    ctx.strokeStyle = withAlpha(PALETTE.panelEdge, 0.8);
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = withAlpha(PALETTE.brass, 0.9);
    ctx.font = `700 10px ${MONO}`;
    ctx.fillText(rules[i].n, rx + 12, ry + 20);
    ctx.fillStyle = PALETTE.cream;
    ctx.font = `600 13px ${FONT}`;
    ctx.fillText(rules[i].t, rx + 12, ry + 40);
    ctx.fillStyle = withAlpha(PALETTE.muted, 0.92);
    ctx.font = `400 10.5px ${FONT}`;
    wrapText(ctx, rules[i].d, rx + 12, ry + 58, cw - 24, 14);
  }

  // The loadout, bought inside a budget.
  const spent = TOOL_ORDER.reduce((sum, id) => sum + (view.loadout?.[id] ?? 0) * TOOLS[id].cost, 0);
  ctx.textAlign = 'center';
  ctx.fillStyle = withAlpha(PALETTE.muted, 0.95);
  ctx.font = `600 11px ${FONT}`;
  ctx.fillText(
    `LOADOUT · ${formatMoney(spent)} of ${formatMoney(view.budget ?? 0)} spent · ${formatMoney(Math.max(0, (view.budget ?? 0) - spent))} spare`,
    VIEW.w / 2,
    y + 344,
  );

  let lx = VIEW.w / 2 - (TOOL_ORDER.length * 116) / 2;
  for (const id of TOOL_ORDER) {
    const def = TOOLS[id];
    const count = view.loadout?.[id] ?? 0;
    const owned = count > 0;
    roundRect(ctx, lx, y + 354, 108, 40, 7);
    ctx.fillStyle = owned ? withAlpha(PALETTE.teal, 0.12) : 'rgba(255,255,255,0.03)';
    ctx.fill();
    ctx.strokeStyle = owned ? withAlpha(PALETTE.teal, 0.55) : withAlpha(PALETTE.panelEdge, 0.8);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = owned ? PALETTE.cream : withAlpha(PALETTE.muted, 0.7);
    ctx.font = `600 10px ${FONT}`;
    ctx.fillText(def.name, lx + 54, y + 370);
    ctx.fillStyle = owned ? PALETTE.teal : withAlpha(PALETTE.muted, 0.6);
    ctx.font = `700 9.5px ${MONO}`;
    ctx.fillText(`${count} × ${formatMoney(def.cost)}`, lx + 54, y + 385);
    lx += 116;
  }

  // The call to action.
  const pulse = 0.6 + 0.4 * Math.sin(view.time * 3.2);
  ctx.fillStyle = withAlpha(PALETTE.cream, 0.55 + pulse * 0.4);
  ctx.font = `700 13px ${FONT}`;
  ctx.fillText('PRESS ENTER TO START THE JOB', VIEW.w / 2, y + h - 22);
  ctx.restore();
}

function drawPaused(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(6, 8, 13, 0.6)';
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.cream;
  ctx.font = `600 34px ${FONT}`;
  ctx.fillText('Paused', VIEW.w / 2, VIEW.h / 2 - 6);
  ctx.fillStyle = withAlpha(PALETTE.muted, 0.95);
  ctx.font = `500 13px ${FONT}`;
  ctx.fillText('P or Escape to go back in · R to restart the night', VIEW.w / 2, VIEW.h / 2 + 24);
  ctx.restore();
}

function drawResult(ctx, heist, won) {
  ctx.save();
  ctx.fillStyle = won ? 'rgba(5, 12, 14, 0.74)' : 'rgba(14, 6, 8, 0.78)';
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);

  const w = 620;
  const h = 400;
  const x = (VIEW.w - w) / 2;
  const y = (VIEW.h - h) / 2;
  panel(ctx, x, y, w, h, 14, 0.94);

  ctx.textAlign = 'center';
  ctx.fillStyle = won ? PALETTE.teal : PALETTE.danger;
  ctx.font = `700 11px ${FONT}`;
  const kicker = won ? 'CLEAN EXIT · 03:12' : 'THE NIGHT IS OVER';
  const kw = spacedWidth(ctx, kicker, 3.4);
  spacedText(ctx, kicker, VIEW.w / 2 - kw / 2, y + 42, 3.4);

  ctx.fillStyle = PALETTE.cream;
  ctx.font = `600 40px ${FONT}`;
  ctx.fillText(won ? 'You got away' : `Busted by ${heist.bustedBy ?? 'the alarm'}`, VIEW.w / 2, y + 90);

  const rank = heist.rank;
  ctx.fillStyle = withAlpha(PALETTE.brass, 0.95);
  ctx.font = `600 15px ${FONT}`;
  ctx.fillText(`${rank.name} · ${rank.note}`, VIEW.w / 2, y + 118);

  // The score, big.
  ctx.fillStyle = PALETTE.loot;
  ctx.font = `700 48px ${MONO}`;
  ctx.fillText(formatMoney(heist.score), VIEW.w / 2, y + 186);
  ctx.fillStyle = withAlpha(PALETTE.muted, 0.9);
  ctx.font = `600 10px ${FONT}`;
  spacedText(ctx, won ? 'TAKE PLUS TIME AND STEALTH BONUSES' : 'SALVAGE VALUE OF WHAT YOU CARRIED', VIEW.w / 2 - 140, y + 206, 2.2);

  // The night's numbers.
  const rows = [
    ['Loot lifted', `${heist.loot.filter((l) => l.taken).length} of ${heist.loot.length}`],
    ['Diamond', heist.primary?.taken ? 'taken' : 'left behind'],
    ['Alarm at the end', `${Math.round(heist.alarm)}%`],
    ['Time inside', formatClock(heist.time)],
  ];
  const rx = x + 70;
  for (let i = 0; i < rows.length; i++) {
    const ry = y + 240 + i * 26;
    ctx.textAlign = 'left';
    ctx.fillStyle = withAlpha(PALETTE.muted, 0.9);
    ctx.font = `500 12px ${FONT}`;
    ctx.fillText(rows[i][0], rx, ry);
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.cream;
    ctx.font = `600 12px ${MONO}`;
    ctx.fillText(rows[i][1], x + w - 70, ry);
  }

  const pulse = 0.55 + 0.45 * Math.sin(performanceSafeTime() * 3.4);
  ctx.textAlign = 'center';
  ctx.fillStyle = withAlpha(PALETTE.cream, 0.5 + pulse * 0.4);
  ctx.font = `700 12.5px ${FONT}`;
  ctx.fillText('PRESS R TO ROB IT AGAIN', VIEW.w / 2, y + h - 24);
  ctx.restore();
}

function performanceSafeTime() {
  return (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
}

/** Wrap a paragraph into lines no wider than maxW. */
export function wrapText(ctx, text, cx, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  let cy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, cx, cy);
      line = word;
      cy += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, cx, cy);
  return cy;
}
