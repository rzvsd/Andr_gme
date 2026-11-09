// Tower lab data: the arena layout and the weapons of direction B "Tower" (harness Phase 5).
// Dev-only, like the hero lab. World units are the hero rig's units (a fighter is about 1.9 tall).

export const TOWER = Object.freeze({
  half: 40, // the tower spans x = -40 .. 40
  floorGap: 4.5,
  levels: 6, // floor y = level * floorGap
  top: 27, // ceiling of the top room
});

const mirror = (items, flip) => items.flatMap((item) => (item.x === 0 ? [item] : [item, flip(item)]));
const mirrorPoints = (items) => mirror(items, (item) => ({ ...item, x: -item.x }));

// Floors per level as [x0, x1] on the left half; the right half is the mirror image.
const LEFT_FLOORS = [
  [[-40, 0]],
  [[-40, -27], [-22, -5]],
  [[-35, -13], [-8, 0]],
  [[-40, -24], [-19, -3]],
  [[-32, -11], [-6, 0]],
  [[-40, -16], [-10, 0]],
];

export const FLOORS = LEFT_FLOORS.flatMap((segments, level) => {
  const y = level * TOWER.floorGap;
  return segments.flatMap(([x0, x1]) =>
    x1 === 0 ? [{ y, x0, x1: -x0 }] : [{ y, x0, x1 }, { y, x0: -x1, x1: -x0 }]
  );
});

// A ladder joins the floor at y0 with the floor at y1 (floors are one-way: a climber passes up through).
// The gaps in the floors are drop holes.
export const LADDERS = mirrorPoints([
  { x: -35, level: 0 },
  { x: -13.5, level: 0 },
  { x: -29, level: 1 },
  { x: -7, level: 1 },
  { x: -33, level: 2 },
  { x: -5, level: 2 },
  { x: -27, level: 3 },
  { x: -4.5, level: 3 },
  { x: -19, level: 4 },
  { x: -3, level: 4 },
]).map(({ x, level }) => ({ x, y0: level * TOWER.floorGap, y1: (level + 1) * TOWER.floorGap }));

const onLevel = (items) => mirrorPoints(items).map(({ level, ...rest }) => ({ ...rest, y: level * TOWER.floorGap }));

export const LOCKERS = onLevel([{ x: -31, level: 1 }, { x: -16, level: 3 }, { x: -28, level: 5 }]);
export const CRATES = onLevel([
  { x: -17, level: 1, stack: 1 },
  { x: -27, level: 2, stack: 2 },
  { x: -22, level: 4, stack: 1 },
  { x: -6, level: 0, stack: 2 },
]);
// A lamp hangs from the underside of the floor above the given level.
export const LAMPS = onLevel([{ x: -14, level: 1 }, { x: -30, level: 2 }, { x: -25, level: 3 }, { x: 0, level: 4 }, { x: -33, level: 0 }]);
export const PICKUPS = onLevel([
  { x: -9, level: 1, weapon: "wide" },
  { x: -30, level: 3, weapon: "quiet" },
  { x: 0, level: 4, weapon: "flare" },
  { x: -33, level: 0, weapon: "trap" },
  { x: -18, level: 2, weapon: "quiet" },
  { x: -20, level: 5, weapon: "wide" },
]);

export const SPAWNS = Object.freeze([
  { x: -13, y: TOWER.floorGap, facing: 1 },
  { x: 4, y: TOWER.floorGap * 2, facing: -1 },
]);

// revealMs: how long a shot shows the shooter. uses: shots per pickup (the base gun refills).
export const WEAPONS = Object.freeze({
  base: { name: "BLASTER", uses: Infinity, revealMs: 300, speed: 22, range: 26, pellets: 1, spread: 0, color: "#c9d3e6" },
  wide: { name: "BOOMER", uses: 2, revealMs: 600, speed: 20, range: 9, pellets: 3, spread: 2.4, color: "#ff9d42" },
  quiet: { name: "WHISPER", uses: 3, revealMs: 90, speed: 36, range: 44, pellets: 1, spread: 0, color: "#6fd3c7" },
  flare: { name: "FLARE", uses: 1, revealMs: 200, speed: 13, range: 60, pellets: 1, spread: 0, color: "#ffd24a", lightSeconds: 4, lightRadius: 9 },
  trap: { name: "SNARE", uses: 1, revealMs: 0, color: "#b08cff", revealSeconds: 1.5 },
});

export const ARENA_COLORS = Object.freeze({
  wall: "#171d2a",
  floor: "#3b475e",
  crate: "#6b5636",
  locker: "#3d5560",
  gunMetal: "#262b36",
  lampGlow: "#fff2cf",
});
