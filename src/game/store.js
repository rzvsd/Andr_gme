// Progress lives on the device only, under one key. Nothing is sent anywhere.
const KEY = "inkfall.v1";

const blank = () => ({ v: 1, plates: {}, streak: 0, lastDaily: "", sound: true, taught: false });

let data = blank();
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || "null");
  if (saved && saved.v === 1) data = { ...blank(), ...saved };
} catch {
  // Private mode or blocked storage: the game still runs, it just forgets.
}

export const store = {
  get data() {
    return data;
  },
  /**
   * The record of one plate.
   * s solved, d most stardust in a winning line, n fewest lines to solve,
   * sheet = aims of the best finished sheet (the last one is the winning line), sd its stardust,
   * cur = aims on the unfinished sheet, k = lines drawn on it, rev = unseen bodies found.
   */
  rec(id) {
    return (data.plates[id] ||= { s: 0, d: 0, n: 0, sheet: null, sd: 0, cur: [], k: 0, rev: 0 });
  },
  peek(id) {
    return data.plates[id] || null;
  },
  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      // See above.
    }
  },
  reset() {
    data = blank();
    this.save();
  },
};
