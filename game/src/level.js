// The Meridian Museum after closing: one floor plan of five rooms, the walls and cover that
// block sight, the loot on display, the guards' patrol loops and the cameras that sweep them.
// Everything the simulation needs is data here; the renderer reads the same lists.

import { WORLD } from './config.js';

const T = 26; // wall thickness
const R = WORLD.w - T; // the inner face of the east wall
const B = WORLD.h - T; // the inner face of the south wall

/** Rooms are floor areas, used for floor patterns, labels and to name where the thief is. */
export const ROOMS = [
  { id: 'west', name: 'Sculpture Wing', x: T, y: T, w: 494, h: B - T, floor: 'marble' },
  { id: 'north', name: 'Long Gallery', x: 546, y: T, w: R - 546, h: 274, floor: 'parquet' },
  { id: 'clocks', name: 'Hall of Clocks', x: 546, y: 326, w: 534, h: 294, floor: 'stone' },
  { id: 'vault', name: 'Strongroom', x: 1106, y: 326, w: R - 1106, h: 294, floor: 'steel' },
  { id: 'south', name: 'Service Corridor', x: 546, y: 646, w: R - 546, h: B - 646, floor: 'concrete' },
];

/** Every wall is an axis-aligned rectangle; the gaps between them are doorways. */
export const WALLS = [
  // the shell, with the loading-bay gap in the west wall: that gap is the way out
  { x: 0, y: 0, w: WORLD.w, h: T },
  { x: 0, y: B, w: WORLD.w, h: T },
  { x: 0, y: 0, w: T, h: 566 },
  { x: 0, y: 686, w: T, h: B - 686 },
  { x: R, y: 0, w: T, h: WORLD.h },
  // the Sculpture Wing's east wall: a door north into the Long Gallery and one south into the
  // Hall of Clocks. Two ways out of the first room is what gives a run its opening choice.
  { x: 520, y: T, w: T, h: 120 },
  { x: 520, y: 266, w: T, h: 90 },
  { x: 520, y: 506, w: T, h: B - 506 },
  // the Long Gallery's south wall: a door down into the clocks, one down into the strongroom
  { x: 546, y: 300, w: 280, h: T },
  { x: 966, y: 300, w: 314, h: T },
  { x: 1420, y: 300, w: R - 1420, h: T },
  // the service corridor's north wall: a door from the clocks, one from the strongroom
  { x: 546, y: 620, w: 200, h: T },
  { x: 886, y: 620, w: 470, h: T },
  { x: 1466, y: 620, w: R - 1466, h: T },
  // the strongroom's west wall, one door from the clocks
  { x: 1080, y: 326, w: T, h: 110 },
  { x: 1080, y: 566, w: T, h: 54 },
];

/** Free-standing cover: display cases, benches, cabinets and pillars. All of it blocks sight. */
export const COVER = [
  // Sculpture Wing: two pillars, a bench and a low case to break the sightlines
  { shape: 'circle', x: 258, y: 196, r: 23, kind: 'pillar' },
  { shape: 'circle', x: 350, y: 430, r: 23, kind: 'pillar' },
  { shape: 'rect', x: 236, y: 496, w: 154, h: 26, kind: 'bench' },
  { shape: 'rect', x: 168, y: 618, w: 122, h: 42, kind: 'case' },
  { shape: 'rect', x: 44, y: 300, w: 44, h: 118, kind: 'cabinet' },
  // Long Gallery
  { shape: 'rect', x: 600, y: 236, w: 132, h: 26, kind: 'bench' },
  { shape: 'rect', x: 1076, y: 214, w: 172, h: 40, kind: 'case' },
  // The pillar sits in the room's lit middle band rather than up against the north wall: cover
  // in the darkest corner of a room is cover the player cannot see to use.
  { shape: 'circle', x: 902, y: 128, r: 23, kind: 'pillar' },
  { shape: 'rect', x: 1462, y: 96, w: 44, h: 104, kind: 'cabinet' },
  // Hall of Clocks
  { shape: 'rect', x: 676, y: 448, w: 176, h: 40, kind: 'case' },
  { shape: 'circle', x: 946, y: 400, r: 19, kind: 'pillar' },
  { shape: 'rect', x: 690, y: 512, w: 96, h: 22, kind: 'bench' },
  { shape: 'rect', x: 1026, y: 348, w: 42, h: 68, kind: 'cabinet' },
  // Strongroom
  { shape: 'rect', x: 1130, y: 338, w: 58, h: 44, kind: 'cabinet' },
  { shape: 'rect', x: 1444, y: 338, w: 58, h: 44, kind: 'cabinet' },
  { shape: 'rect', x: 1178, y: 588, w: 140, h: 24, kind: 'bench' },
  // Service Corridor
  { shape: 'rect', x: 604, y: 662, w: 132, h: 38, kind: 'desk' },
  { shape: 'rect', x: 1082, y: 664, w: 150, h: 38, kind: 'desk' },
  { shape: 'rect', x: 1520, y: 790, w: 42, h: 66, kind: 'cabinet' },
];

/** The loot on display. The diamond is the job; the rest is money. */
export const LOOT = [
  { id: 'mask', name: 'Ivory Mask', value: 15000, x: 92, y: 190, room: 'west', plinth: 30 },
  { id: 'urn', name: 'Cut-glass Urn', value: 9000, x: 302, y: 700, room: 'west', plinth: 30 },
  { id: 'songbird', name: 'Silver Songbird', value: 9000, x: 806, y: 168, room: 'north', plinth: 30 },
  { id: 'diadem', name: 'Ember Diadem', value: 14000, x: 1332, y: 168, room: 'north', plinth: 30 },
  { id: 'clock', name: "Astronomer's Clock", value: 18000, x: 872, y: 588, room: 'clocks', plinth: 30 },
  { id: 'ledger', name: 'Gilded Ledger', value: 12000, x: 1252, y: 686, room: 'south', plinth: 28 },
  { id: 'moonfall', name: 'Moonfall Diamond', value: 60000, x: 1308, y: 470, room: 'vault', plinth: 42, primary: true },
];

/** Guards walk their loop, pausing at each point to look around. */
export const GUARDS = [
  {
    id: 'curator',
    type: 'curator',
    route: [
      { x: 140, y: 118, pause: 1.0 },
      { x: 430, y: 118, pause: 0.9 },
      { x: 430, y: 322, pause: 1.1 },
      { x: 140, y: 322, pause: 1.0 },
    ],
    look: 0.55,
    lookPeriod: 5.0,
  },
  {
    id: 'warden',
    type: 'warden',
    route: [
      { x: 620, y: 248, pause: 1.4 },
      { x: 1502, y: 248, pause: 1.1 },
    ],
    look: 0.5,
    lookPeriod: 4.2,
  },
  {
    id: 'nightwatch',
    type: 'nightwatch',
    route: [
      { x: 620, y: 556, pause: 0.9 },
      { x: 1000, y: 556, pause: 0.7 },
      { x: 1000, y: 378, pause: 1.2 },
      { x: 620, y: 378, pause: 0.7 },
    ],
    look: 0.6,
    lookPeriod: 3.8,
  },
  {
    id: 'runner',
    type: 'runner',
    route: [
      { x: 604, y: 736, pause: 0.5 },
      { x: 1180, y: 736, pause: 0.8 },
    ],
    look: 0.42,
    lookPeriod: 3.2,
  },
  {
    id: 'vaultkeeper',
    type: 'warden',
    route: [
      { x: 1150, y: 556, pause: 1.0 },
      { x: 1472, y: 556, pause: 0.9 },
      { x: 1472, y: 414, pause: 1.3 },
      { x: 1150, y: 414, pause: 0.9 },
    ],
    look: 0.65,
    lookPeriod: 4.6,
  },
];

/** Cameras are mounted on walls and sweep a fixed arc around their base angle. */
export const CAMERAS = [
  { id: 'cam-west', x: 40, y: 452, angle: 0.06, sweep: 0.42, period: 8.6, range: 246, room: 'west' },
  { id: 'cam-gallery', x: 1538, y: 228, angle: Math.PI, sweep: 0.5, period: 9.0, range: 300, room: 'north' },
  { id: 'cam-clocks', x: 1062, y: 344, angle: 2.35, sweep: 0.5, period: 8.2, range: 240, room: 'clocks' },
  { id: 'cam-vault', x: 1538, y: 352, angle: 2.5, sweep: 0.34, period: 7.4, range: 250, room: 'vault' },
  { id: 'cam-service', x: 1545, y: 662, angle: 2.2, sweep: 0.46, period: 7.8, range: 250, room: 'south' },
];

/** Paintings hung flat on walls: purely decorative, drawn by the renderer. */
export const PAINTINGS = [
  { x: 610, y: 30, w: 96, h: 60, tone: 'teal' },
  { x: 762, y: 30, w: 70, h: 52, tone: 'amber' },
  { x: 950, y: 30, w: 110, h: 58, tone: 'rose' },
  { x: 1196, y: 30, w: 80, h: 54, tone: 'teal' },
  { x: 1368, y: 30, w: 96, h: 60, tone: 'amber' },
  { x: 560, y: 352, w: 0, h: 88, tone: 'rose', vertical: true },
  { x: 1088, y: 352, w: 0, h: 88, tone: 'amber', vertical: true },
];

/** Where the thief comes in, and where the van waits. */
export const START = { x: 96, y: 700, facing: -Math.PI / 2 };
export const EXIT = { x: 26, y: 566, w: 46, h: 120 };

/** The museum's outer frame, used to fade the floor into the dark. */
export const BOUNDS = { x: 0, y: 0, w: WORLD.w, h: WORLD.h };

/** Walls and cover in one list: what a ray stops at. */
export function solidShapes() {
  const solids = [];
  for (const w of WALLS) solids.push({ shape: 'rect', ...w, kind: 'wall' });
  for (const c of COVER) solids.push({ ...c });
  return solids;
}

/** The room a point stands in, by floor area; null outside the museum. */
export function roomAt(x, y) {
  for (const r of ROOMS) {
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r;
  }
  return null;
}

/** The loot the job is about. */
export const PRIMARY_LOOT = LOOT.find((l) => l.primary);
