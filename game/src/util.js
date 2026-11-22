// Small numeric and formatting helpers shared by the simulation and the renderer.
// Nothing here touches the DOM, so the simulation can also run under Node for tests.

export const TAU = Math.PI * 2;

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
export const angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
export const easeOut = (t) => 1 - (1 - t) * (1 - t) * (1 - t);

/** Shortest signed difference from angle a to angle b, in (-PI, PI]. */
export function wrapAngle(a) {
  let x = a;
  while (x > Math.PI) x -= TAU;
  while (x <= -Math.PI) x += TAU;
  return x;
}

export const angleLerp = (a, b, t) => a + wrapAngle(b - a) * t;

/** Move v toward target by at most step. */
export function approach(v, target, step) {
  if (v < target) return Math.min(target, v + step);
  return Math.max(target, v - step);
}

/** Deterministic 32-bit PRNG (mulberry32), so staged screenshots and particles repeat. */
export function makeRng(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function formatMoney(n) {
  const sign = n < 0 ? '-' : '';
  const v = Math.abs(Math.round(n));
  return `${sign}$${v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

export function formatClock(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Rounded rectangle path, used by panels and tool cards. */
export function roundRect(ctx, x, y, w, h, r) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

/** A hex colour with an alpha channel, e.g. withAlpha('#ff5a52', 0.4). */
export function withAlpha(hex, alpha) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Letter-spaced text: canvas has no letterSpacing everywhere, so draw glyph by glyph. */
export function spacedText(ctx, text, x, y, spacing) {
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
  return cx - x;
}

export function spacedWidth(ctx, text, spacing) {
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width + spacing;
  return Math.max(0, w - spacing);
}
