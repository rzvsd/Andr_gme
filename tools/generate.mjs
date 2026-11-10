// Builds the plates that ship with the game.
//   node tools/generate.mjs atlas          48 plates of the atlas  -> src/data/plates.json
//   node tools/generate.mjs daily          366 daily plates        -> src/data/daily.json
//   node tools/generate.mjs probe [n]      acceptance statistics for the first n slots of each chapter
// Every slot walks a fixed list of seeds, so the output is the same on every run and every machine.
// Seeds in SKIP were looked at and thrown out by hand.
import { Worker, isMainThread, parentPort } from "node:worker_threads";
import os from "node:os";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { makePlate, specFor, CHAPTERS } from "../src/gen/generate.js";
import { rng } from "../src/sim/rng.js";

const SKIP = [];
const ATLAS_TIERS = [0, 0, 1, 1, 1, 2, 2, 2];
const TOUR_TIERS = [1, 1, 1, 1, 2, 2, 2, 2];
const DAILY_TIERS = [1, 0, 1, 1, 2, 1, 2];

function findPlate(job) {
  let sims = 0;
  let tries = 0;
  const why = {};
  for (let k = 0; k < 6000; k++) {
    const seed = (job.base + k * 7919) >>> 0;
    if (SKIP.includes(seed)) continue;
    const spec = specFor(job.ch, job.tier, rng(seed ^ 0x9e3779b9));
    const out = makePlate(seed, spec);
    tries++;
    sims += out.sims;
    if (out.code) return { id: job.id, code: out.code, m: out.m, tries, sims, why };
    why[out.why] = (why[out.why] || 0) + 1;
  }
  return { id: job.id, code: null, tries, sims, why };
}

if (!isMainThread) {
  parentPort.on("message", (job) => parentPort.postMessage(findPlate(job)));
} else {
  const mode = process.argv[2] || "atlas";
  const jobs = [];
  if (mode === "atlas" || mode === "probe") {
    const per = mode === "probe" ? Number(process.argv[3] || 3) : 8;
    CHAPTERS.forEach((ch, c) => {
      const tiers = ch === "tour" ? TOUR_TIERS : ATLAS_TIERS;
      for (let i = 0; i < 8; i++) {
        if (mode === "probe" && ![0, 3, 6].slice(0, per).includes(i)) continue;
        jobs.push({ id: c * 8 + i, ch, tier: tiers[i], base: (c + 1) * 100003 + i * 1009 + 17 });
      }
    });
  } else if (mode === "daily") {
    for (let d = 0; d < 366; d++) {
      jobs.push({ id: d, ch: CHAPTERS[(d * 5 + 1) % 6], tier: DAILY_TIERS[d % 7], base: 7000003 + d * 104729 });
    }
  } else {
    console.error("usage: generate.mjs atlas | daily | probe [n]");
    process.exit(1);
  }

  const started = Date.now();
  const results = new Map();
  const queue = jobs.slice();
  const workers = Math.max(1, Math.min(6, os.availableParallelism() - 1, jobs.length));
  let live = workers;
  await new Promise((resolve) => {
    for (let n = 0; n < workers; n++) {
      const w = new Worker(fileURLToPath(import.meta.url));
      const next = () => {
        const job = queue.shift();
        if (job) w.postMessage(job);
        else {
          w.terminate();
          if (--live === 0) resolve();
        }
      };
      w.on("message", (r) => {
        results.set(r.id, r);
        const job = jobs.find((j) => j.id === r.id);
        const m = r.m ? `room ${r.m.room} turn ${r.m.turn} frac ${r.m.frac} bodies ${r.m.bodies}` : "FAILED";
        console.log(`${String(r.id).padStart(3)} ${job.ch.padEnd(10)} t${job.tier} tries ${String(r.tries).padStart(4)}  ${m}  ${JSON.stringify(r.why)}`);
        next();
      });
      next();
    }
  });

  const ordered = jobs.map((j) => results.get(j.id));
  const failed = ordered.filter((r) => !r.code).length;
  const shots = ordered.reduce((n, r) => n + r.sims, 0);
  console.log(`${jobs.length} slots, ${failed} failed, ${shots.toLocaleString("en")} lines fired, ${((Date.now() - started) / 1000).toFixed(0)} s`);
  if (mode === "probe") process.exit(0);
  if (failed) process.exit(1);
  const file = fileURLToPath(new URL(`../src/data/${mode === "atlas" ? "plates" : "daily"}.json`, import.meta.url));
  fs.mkdirSync(fileURLToPath(new URL("../src/data/", import.meta.url)), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ shots, plates: ordered.map((r) => r.code) }) + "\n");
  console.log("wrote", file);
}
