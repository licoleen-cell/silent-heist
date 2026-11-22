// Tuning constants, the palette and the tool catalogue. Every number a designer would
// want to nudge lives here so the simulation and the renderer read as behaviour.

export const WORLD = { w: 1600, h: 900 };

/** The museum at night: ink-blue floors, brass, and one loud signal colour for danger. */
export const PALETTE = {
  ink: '#0a0d14',
  inkDeep: '#06080d',
  inkSoft: '#111726',
  panel: '#141b2a',
  panelEdge: '#2b364d',
  floorStone: '#232c40',
  floorStoneAlt: '#202839',
  floorWood: '#342a3f',
  floorCarpet: '#3a1f2a',
  floorTile: '#1f2837',
  wall: '#2f3950',
  wallFace: '#1d2434',
  wallEdge: '#5b6a88',
  brass: '#d8a94e',
  brassDeep: '#8d6820',
  cream: '#f2e9d6',
  smoke: '#b9c4d8',
  muted: '#8a97b0',
  teal: '#49d3bd',
  danger: '#ff5a52',
  dangerDeep: '#8e1f26',
  amber: '#ffb44f',
  loot: '#ffd86b',
  // Four sight families, four hues, so a still frame reads without its labels: cover is
  // blue-grey, a guard's cone is red whatever its mood, a camera's sweep is cyan, loot is
  // gold. Amber cones used to sit in the same hue family as gold loot, and at a glance the
  // two looked like the same thing.
  coneCalm: '#ff9d80',
  coneWary: '#ff7a5c',
  coneAlert: '#ff4a44',
  camCalm: '#8fdcff',
  camAlert: '#ff5fb0',
};

export const PLAYER = {
  radius: 11,
  walk: 168,
  sprint: 252,
  crouch: 84,
  accel: 16,
  /** How far a footstep carries, by stance: crouching is silent. */
  noise: { crouch: 0, walk: 96, sprint: 224 },
  /** Crouching makes the thief harder to spot: vision range is scaled by this. */
  crouchSpotFactor: 0.6,
  carrySlowdown: 0.86,
  grabTime: 1.15,
  reach: 46,
};

export const ALARM = {
  max: 100,
  /** Per second while a guard's cone holds the thief. */
  riseSeen: 22,
  /** Per second while a camera holds the thief. */
  riseCamera: 13,
  /** Per second when a guard is close and hunting, cone or not. */
  riseHunted: 8,
  /** Per second of quiet recovery once the thief is out of sight. */
  decay: 8,
  /** Below this the alarm reads calm again and guards stand down. */
  calmAt: 22,
  /** At this the whole floor goes loud: guards sprint and cameras snap to the thief. */
  hotAt: 78,
};

export const CAMERA = {
  sweep: 0.62,
  range: 260,
  halfAngle: 0.30,
  turnRate: 2.4,
  alertTurnRate: 6.5,
  detectTime: 1.1,
};

export const GUARD_TYPES = {
  warden: { name: 'Warden', speed: 62, range: 252, halfAngle: 0.38, patience: 2.2, chase: 1.62, color: '#f0a75e' },
  curator: { name: 'Curator', speed: 54, range: 232, halfAngle: 0.44, patience: 2.9, chase: 1.5, color: '#c58cf0' },
  nightwatch: { name: 'Nightwatch', speed: 72, range: 270, halfAngle: 0.34, patience: 1.8, chase: 1.7, color: '#ef7f7f' },
  runner: { name: 'Runner', speed: 88, range: 238, halfAngle: 0.4, patience: 1.5, chase: 1.42, color: '#7fb4f2' },
};

/** Tools cost budget: the thief picks a loadout that adds up to at most this. */
export const TOOL_BUDGET = 12000;

export const TOOLS = {
  smoke: {
    id: 'smoke',
    name: 'Smoke Canister',
    slot: 1,
    cost: 3000,
    charges: 2,
    range: 320,
    blurb: 'Arcs to the cursor and bursts into a cloud that cuts every line of sight through it for 7 seconds.',
  },
  coin: {
    id: 'coin',
    name: 'Decoy Coin',
    slot: 2,
    cost: 2500,
    charges: 3,
    range: 380,
    blurb: 'Skitters across the floor and rings. The nearest guard walks over to look, leaving his route open.',
  },
  emp: {
    id: 'emp',
    name: 'EMP Spike',
    slot: 3,
    cost: 5000,
    charges: 1,
    range: 300,
    blurb: 'A pulse that darkens every camera inside its ring for 9 seconds. Guards are unaffected.',
  },
  jammer: {
    id: 'jammer',
    name: 'Signal Jammer',
    slot: 4,
    cost: 3500,
    charges: 1,
    range: 0,
    blurb: 'Holds the alarm meter still for 8 seconds: it can neither climb nor fall while the jam runs.',
  },
};

export const TOOL_ORDER = ['smoke', 'coin', 'emp', 'jammer'];

export const SCORING = {
  /** Each loot piece is worth its own value; these are the extras. */
  ghostBonus: 60000,
  /** Seconds under this earn a time bonus, tapering to zero at the window. */
  timeWindow: 240,
  timeBonusMax: 45000,
  alarmPenalty: 320,
  bustedKeepFraction: 0.35,
};

export const RANK_BANDS = [
  { at: 0.9, name: 'Ghost', note: 'Nobody ever saw you.' },
  { at: 0.7, name: 'Master Thief', note: 'The night porter is still explaining himself.' },
  { at: 0.45, name: 'Professional', note: 'Clean work, one or two close calls.' },
  { at: 0.2, name: 'Burglar', note: 'You got out. That is what counts.' },
  { at: -1, name: 'Lucky Amateur', note: 'The alarm did most of the work tonight.' },
];
