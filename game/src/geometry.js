// Ray casting, vision cones and circle collision against the museum's solid shapes.
// A solid is either { shape:'rect', x, y, w, h } or { shape:'circle', x, y, r }.

import { clamp } from './util.js';

export function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

/** Distance along a unit ray to a rectangle, or Infinity when it misses. */
export function rayRectHit(ox, oy, dx, dy, r) {
  let tmin = 0;
  let tmax = Infinity;
  if (Math.abs(dx) < 1e-9) {
    if (ox < r.x || ox > r.x + r.w) return Infinity;
  } else {
    let t1 = (r.x - ox) / dx;
    let t2 = (r.x + r.w - ox) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
  }
  if (Math.abs(dy) < 1e-9) {
    if (oy < r.y || oy > r.y + r.h) return Infinity;
  } else {
    let t1 = (r.y - oy) / dy;
    let t2 = (r.y + r.h - oy) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
  }
  return tmin <= tmax ? tmin : Infinity;
}

/** Distance along a unit ray to a circle, or Infinity when it misses. */
export function rayCircleHit(ox, oy, dx, dy, cx, cy, cr) {
  const mx = ox - cx;
  const my = oy - cy;
  const b = mx * dx + my * dy;
  const c = mx * mx + my * my - cr * cr;
  const disc = b * b - c;
  if (disc < 0) return Infinity;
  const root = Math.sqrt(disc);
  const t1 = -b - root;
  if (t1 >= 0) return t1;
  const t2 = -b + root;
  return t2 >= 0 ? t2 : Infinity;
}

export function rayHit(ox, oy, dx, dy, s) {
  return s.shape === 'circle' ? rayCircleHit(ox, oy, dx, dy, s.x, s.y, s.r) : rayRectHit(ox, oy, dx, dy, s);
}

/** Cast a ray through the solids and stop at the first one, or at range. */
export function raycast(ox, oy, angle, range, solids) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let best = range;
  for (let i = 0; i < solids.length; i++) {
    const t = rayHit(ox, oy, dx, dy, solids[i]);
    if (t < best) best = t;
  }
  return { x: ox + dx * best, y: oy + dy * best, dist: best };
}

/** Whether the straight line between two points is cut by a solid. */
export function segmentBlocked(ax, ay, bx, by, solids) {
  const len = Math.hypot(bx - ax, by - ay);
  if (len < 1e-6) return false;
  const dx = (bx - ax) / len;
  const dy = (by - ay) / len;
  for (let i = 0; i < solids.length; i++) {
    const t = rayHit(ax, ay, dx, dy, solids[i]);
    if (t > 1.5 && t < len - 1.5) return true;
  }
  return false;
}

/** Whether a point sits inside a vision cone (origin, facing, half angle, range). */
export function inCone(ox, oy, angle, halfAngle, range, px, py) {
  const dx = px - ox;
  const dy = py - oy;
  const d2 = dx * dx + dy * dy;
  if (d2 > range * range) return false;
  const a = Math.atan2(dy, dx);
  let diff = a - angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.abs(diff) <= halfAngle;
}

/** Push a circle out of one solid; null when there is no overlap. */
export function pushOutCircle(px, py, radius, s) {
  if (s.shape === 'circle') {
    const dx = px - s.x;
    const dy = py - s.y;
    const d = Math.hypot(dx, dy);
    const min = radius + s.r;
    if (d >= min) return null;
    if (d < 1e-6) return { x: px + min, y: py };
    return { x: s.x + (dx / d) * min, y: s.y + (dy / d) * min };
  }
  const nx = clamp(px, s.x, s.x + s.w);
  const ny = clamp(py, s.y, s.y + s.h);
  const dx = px - nx;
  const dy = py - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 > radius * radius) return null;
  if (d2 > 1e-6) {
    const d = Math.sqrt(d2);
    return { x: px + (dx / d) * (radius - d), y: py + (dy / d) * (radius - d) };
  }
  const left = px - s.x;
  const right = s.x + s.w - px;
  const top = py - s.y;
  const bottom = s.y + s.h - py;
  const m = Math.min(left, right, top, bottom);
  if (m === left) return { x: s.x - radius, y: py };
  if (m === right) return { x: s.x + s.w + radius, y: py };
  if (m === top) return { x: px, y: s.y - radius };
  return { x: px, y: s.y + s.h + radius };
}

/** Shortest distance from a point to a segment. */
export function distToSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const len2 = vx * vx + vy * vy;
  if (len2 < 1e-9) return Math.hypot(px - ax, py - ay);
  const t = clamp(((px - ax) * vx + (py - ay) * vy) / len2, 0, 1);
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
}

/** Whether a smoke cloud sits across a line of sight. */
export function smokeBlocks(ax, ay, bx, by, clouds) {
  for (let i = 0; i < clouds.length; i++) {
    const c = clouds[i];
    if (c.life <= 0) continue;
    const grow = Math.min(1, c.age * 2.6);
    if (distToSegment(c.x, c.y, ax, ay, bx, by) < c.radius * grow * 0.9) return true;
  }
  return false;
}

/** The polygon a cone covers once walls cut it short: origin, then one point per ray. */
export function conePolygon(ox, oy, angle, halfAngle, range, solids, rays = 30) {
  const pts = [[ox, oy]];
  for (let i = 0; i <= rays; i++) {
    const a = angle - halfAngle + (2 * halfAngle * i) / rays;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    let best = range;
    for (let k = 0; k < solids.length; k++) {
      const t = rayHit(ox, oy, dx, dy, solids[k]);
      if (t < best) best = t;
    }
    pts.push([ox + dx * best, oy + dy * best]);
  }
  return pts;
}
