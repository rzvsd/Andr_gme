// The atlas: six chapters of eight plates, and one extra plate for each day of the year.
import raw from "./plates.json";
import { decode } from "../sim/codec.js";
import { rng } from "../sim/rng.js";
import { store } from "../game/store.js";

export const CHAPTERS = ["Fall", "Clockwork", "Opposition", "Passage", "The Unseen", "Grand Tour"];
export const PER_CHAPTER = 8;
export const NEED = 5; // solved plates in a chapter that open the next one
export const COUNT = raw.plates.length;
export const SHOTS = raw.shots;

const TITLES = [
  "First Stroke|A Gentle Bend|The Long Way Round|Between Two Lanterns|Vesper's Shoulder|Three Wells|The Narrow Sea|Kepler's Knot",
  "The Hour Hand|A Patient Moon|Meet Me There|The Turning Key|Carousel|Leading the Dance|Two Clocks|The Escapement",
  "A Cold Shoulder|The Unwelcome Star|Push and Pull|Against the Grain|The Reluctant Road|Mirror Weather|Two Refusals|The Contrary Crown",
  "A Door in the Sky|Short Cut|The Far Side|Needle and Thread|Through and Around|The Folded Chart|Back Door|The Seamstress",
  "Something Is There|The Quiet Weight|Blind Corner|Borrowed Light|The Empty Chair|Dead Reckoning|Two Silences|Chart the Dark",
  "All Together Now|The Crowded Sky|Six Sisters|Longitude|The Orrery|Perihelion|The Cartographer's Proof|Inkfall",
].flatMap((row) => row.split("|"));

const ADJ = "Patient Borrowed Quiet Wandering Silver Hollow Distant Restless Gilded Sleeping Lantern Winter Crooked Secret Wide Falling Northern Pale Steady Bright".split(" ");
const NOUN = "Lantern Harbour Compass Meridian Tide Garden Staircase Lighthouse Pendulum Crossing Orchard Bell Needle Mirror Crown River Window Anchor Feather Key".split(" ");

const cache = new Map();

/** Plate n of the atlas, 0-based. */
export function atlasPlate(n) {
  if (!cache.has(n)) cache.set(n, { ...decode(raw.plates[n]), id: `a${n}`, n, title: TITLES[n] });
  return cache.get(n);
}

const pad = (n) => String(n).padStart(2, "0");
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Today's plate. The same calendar day gives the same plate on every device. */
export async function dailyPlate(date = new Date()) {
  const { default: all } = await import("./daily.json");
  const days = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(2026, 0, 1)) / 864e5);
  const i = ((days % all.plates.length) + all.plates.length) % all.plates.length;
  const plate = decode(all.plates[i]);
  const R = rng(plate.seed);
  return { ...plate, id: `d${dayKey(date)}`, day: dayKey(date), title: `The ${R.pick(ADJ)} ${R.pick(NOUN)}` };
}

export const chapterOf = (n) => Math.floor(n / PER_CHAPTER);

export function solvedIn(ch) {
  let k = 0;
  for (let i = 0; i < PER_CHAPTER; i++) k += store.peek(`a${ch * PER_CHAPTER + i}`)?.s ? 1 : 0;
  return k;
}

export const chapterOpen = (ch) => ch === 0 || solvedIn(ch - 1) >= NEED;

/** The plate to continue with: the first open plate that is not solved, or -1 when all are. */
export function nextPlate(after = -1) {
  for (let step = 1; step <= COUNT; step++) {
    const n = (after + step + COUNT) % COUNT;
    if (chapterOpen(chapterOf(n)) && !store.peek(`a${n}`)?.s) return n;
  }
  return -1;
}

export function totals() {
  let solved = 0;
  let dust = 0;
  for (let n = 0; n < COUNT; n++) {
    const r = store.peek(`a${n}`);
    if (r?.s) {
      solved++;
      dust += r.d;
    }
  }
  return { solved, dust };
}
