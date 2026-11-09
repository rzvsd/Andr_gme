// Renders the character bible from the CharacterDef, so the document and the
// running hero can never disagree.

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function card(title) {
  const section = el("section", "bible-card");
  section.append(el("h3", null, title));
  return section;
}

function rows(pairs) {
  const list = el("dl");
  for (const [k, v] of pairs) {
    list.append(el("dt", null, k), el("dd", null, String(v)));
  }
  return list;
}

export function renderBible(container, def, playSound) {
  container.replaceChildren();
  const head = el("header", "bible-head");
  head.append(el("h2", null, def.name), el("p", null, def.tagline));
  container.append(head);

  const palette = card("Palette");
  const swatches = el("div", "swatches");
  for (const [name, hex] of Object.entries(def.palette)) {
    const swatch = el("div", "swatch");
    const chip = el("span", "chip");
    chip.style.background = hex;
    swatch.append(chip, el("span", "swatch-name", name), el("code", null, hex));
    swatches.append(swatch);
  }
  palette.append(swatches);

  const shape = card("Shape");
  const s = def.shape;
  const headHeight = s.head ? s.head.radius * 2 - s.head.overlap : 0;
  const totalHeight = s.legLength + s.legRadius + s.bodyLength + s.bodyRadius * 2 + headHeight + s.hat.crownHeight - 0.1;
  if (def.art === "vectorFighter") {
    shape.append(
      rows([
        ["Source", "redrawn from project overview/game pictures/expectation.png as flat vector shapes"],
        ["Parts", "hood, face, mask, 2 eyes with brows, headband + knot + 2-piece ribbon, torso, belt, 2 legs, 2 shoes, bead arms, gun"],
        ["Height", "1.82 units, sharp at any zoom"],
        ["Outline", "0.025 units around the big shapes, flashes as the hit tell"],
      ])
    );
  } else if (def.sprite) {
    shape.append(
      rows([
        ["Source", "project overview/game pictures/expectation.png"],
        ["Cutout", `${def.sprite.width} × ${def.sprite.height} px, sky and UI icons keyed out`],
        ["Height", `${def.sprite.heightUnits} units, flat sprite`],
        ["Arms", "none to animate, the whole sprite squashes and leans"],
      ])
    );
  } else shape.append(
    rows([
      ["Height", `${totalHeight.toFixed(2)} units, ${s.head ? "big head on a small torso" : "body is the head"}`],
      ["Body", `capsule r ${s.bodyRadius}${s.head ? `, head r ${s.head.radius}` : ", no neck"}`],
      ["Legs", `2 stubs, r ${s.legRadius}`],
      ["Arms", `${s.arm.segments}-bead noodle chains, physics driven`],
      ["Face", s.brows ? "2 white eyes with angry brows, mask, no mouth" : "2 dots (left one 1.5 cm higher), 1 flat line"],
      ["Silhouette", s.hat.crownHeight > 0 ? `hat brim r ${s.hat.brimRadius} — passes the black-fill test` : `headband r ${s.hat.brimRadius} with a ${s.hat.tail?.length ?? 0}-piece tail`],
    ])
  );

  const motion = card("Motion rules");
  const m = def.motion;
  motion.append(
    rows([
      ["Breathe", `${(m.breatheAmplitude * 100).toFixed(1)} % at ${m.breatheHz} Hz, sine + noise`],
      ["Land", `squash to ${m.squashOnLand}, spring k ${m.springStiffness}`],
      ["Jump apex", `stretch to ${m.stretchAtApex}`],
      ["Lean", `${m.leanPerVelocity} rad per unit of speed`],
      ["Hat", `lags the body, spring k ${m.hatSpring.stiffness}`],
      ["Blink", `every ${m.blinkEverySeconds[0]}–${m.blinkEverySeconds[1]} s`],
      ["Shot", `pre-scale ${m.anticipationScale} for ${m.anticipationMs} ms, then recoil`],
    ])
  );

  const tells = card("Tells in the dark");
  tells.append(rows(Object.entries(def.tells).map(([name, t]) => [name, `${t.parts.join(" + ")} · ${t.ms} ms`])));

  const sounds = card("Sounds");
  const soundRow = el("div", "sound-row");
  for (const [event, name] of Object.entries(def.sounds)) {
    const button = el("button", "sound-btn", `${event} · ${name}`);
    button.type = "button";
    button.addEventListener("click", () => playSound(name));
    soundRow.append(button);
  }
  sounds.append(soundRow);

  const moments = card("Moments");
  moments.append(rows(Object.entries(def.moments)));

  const bullet = card("Bullet signature");
  const chip = el("span", "chip");
  chip.style.background = def.bullet.color;
  const line = el("p");
  line.append(chip, document.createTextNode(` pellet, ${def.bullet.trail}-drop jelly trail, speed ${def.bullet.speed}`));
  bullet.append(line);

  const grid = el("div", "bible-grid");
  grid.append(palette, shape, motion, tells, sounds, bullet, moments);
  container.append(grid);
}
