import { versusLevelOf } from "../scenes/versusArena.js";

// Arena v3 route finding for the bot. Its side of the arena is a small graph. Nodes are the free
// stretches of the ground and the ledges between blocks ("segments"). Edges are a hop over a
// block on the same surface, a jump up to an overlapping ledge one level higher, a running jump
// (leap) off a ledge end to a ledge one level higher, and a drop through a ledge to the surface
// below.

const STAND_TOLERANCE = 1;
// Widest gap (world px) a running jump crosses while climbing one level.
const LEAP_GAP = 60;

const overlapOf = (a, b) => [Math.max(a.minX, b.minX), Math.min(a.maxX, b.maxX)];

// All pieces of one side, by collision category.
export function buildCourse(platforms, category) {
  const own = (Array.isArray(platforms) ? platforms : []).filter(
    (p) => p && p.active !== false && (Number(p.collisionCategory) & category) !== 0
  );
  const blocks = own.filter((p) => p.kind === "block");
  const supports = own.filter((p) => p.kind !== "block");
  const nodes = [];
  for (const support of supports) {
    const level = versusLevelOf(support);
    const right = support.x + support.width;
    const standing = blocks
      .filter((b) => Math.abs(b.y + b.height - support.y) <= STAND_TOLERANCE && b.x < right && b.x + b.width > support.x)
      .sort((a, b) => a.x - b.x);
    let start = support.x;
    for (const block of standing) {
      if (block.x > start) {
        nodes.push({ support, level, minX: start, maxX: block.x, coverLeft: start > support.x, coverRight: true });
      }
      start = Math.max(start, block.x + block.width);
    }
    if (start < right) {
      nodes.push({ support, level, minX: start, maxX: right, coverLeft: start > support.x, coverRight: false });
    }
  }
  return { nodes, blocks, supports };
}

// The segment a grounded fighter stands on, or null (airborne, or on top of a block).
export function nodeAt(course, player) {
  const support = player?.supportingPlatform;
  if (!course || !support || support.kind === "block") {
    return null;
  }
  const centerX = Number(player.x) + Number(player.width) * 0.5;
  let best = null;
  let bestDistance = Infinity;
  for (const node of course.nodes) {
    if (node.support !== support) {
      continue;
    }
    const distance = centerX < node.minX ? node.minX - centerX : centerX > node.maxX ? centerX - node.maxX : 0;
    if (distance < bestDistance) {
      best = node;
      bestDistance = distance;
    }
  }
  return best;
}

// Edges out of `node` for a fighter `bodyWidth` wide. `x` is the body centre to act from.
export function edgesFrom(course, node, bodyWidth) {
  const edges = [];
  for (const other of course.nodes) {
    if (other === node) {
      continue;
    }
    if (other.support === node.support) {
      if (other.minX >= node.maxX || other.maxX <= node.minX) {
        edges.push({ type: "hop", to: other, x: other.minX >= node.maxX ? other.minX + bodyWidth : other.maxX - bodyWidth });
      }
      continue;
    }
    const [lo, hi] = overlapOf(node, other);
    if (other.level === node.level + 1 && hi - lo >= 1) {
      // Stand with the body inside this segment and under the ledge above, then jump.
      const x = Math.min(Math.max((lo + hi) * 0.5, node.minX + bodyWidth * 0.5), node.maxX - bodyWidth * 0.5);
      edges.push({ type: "climb", to: other, x });
      continue;
    }
    if (other.level === node.level + 1 && lo - hi <= LEAP_GAP) {
      // Run off the end of this ledge toward the next one up and jump at the edge.
      const toRight = other.minX >= node.maxX;
      const endOfSupport = toRight
        ? node.maxX === node.support.x + node.support.width
        : node.minX === node.support.x;
      if (endOfSupport) {
        edges.push({ type: "leap", to: other, x: (other.minX + other.maxX) * 0.5, edgeX: toRight ? node.maxX : node.minX });
      }
      continue;
    }
    if (node.support.kind === "ledge" && other.level < node.level && hi - lo >= bodyWidth) {
      const x = (lo + hi) * 0.5;
      const blocked = course.supports.some((s) => {
        const level = versusLevelOf(s);
        return level > other.level && level < node.level && s.x < x + bodyWidth * 0.5 && x - bodyWidth * 0.5 < s.x + s.width;
      });
      if (!blocked) {
        edges.push({ type: "drop", to: other, x });
      }
    }
  }
  return edges;
}

// Every segment reachable from `start`, mapped to the first edge of a shortest route to it
// (null for `start` itself).
export function routesFrom(course, start, bodyWidth) {
  const firstEdge = new Map();
  if (!start) {
    return firstEdge;
  }
  firstEdge.set(start, null);
  const queue = [start];
  while (queue.length > 0) {
    const node = queue.shift();
    for (const edge of edgesFrom(course, node, bodyWidth)) {
      if (!firstEdge.has(edge.to)) {
        firstEdge.set(edge.to, firstEdge.get(node) ?? edge);
        queue.push(edge.to);
      }
    }
  }
  return firstEdge;
}

// Where to fight from: the reachable segment on `level` nearest the opponent.
export function attackGoal(course, reachable, level, opponentX) {
  let best = null;
  let bestDistance = Infinity;
  for (const node of course.nodes) {
    if (node.level !== level || !reachable.has(node)) {
      continue;
    }
    const distance = Math.abs((node.minX + node.maxX) * 0.5 - opponentX);
    if (distance < bestDistance) {
      best = node;
      bestDistance = distance;
    }
  }
  return best;
}

// Where to hide: a reachable segment with a block between it and the opponent, nearest in level.
export function hideGoal(course, reachable, level, opponentIsLeft) {
  let best = null;
  let bestScore = Infinity;
  for (const node of course.nodes) {
    const covered = opponentIsLeft ? node.coverLeft : node.coverRight;
    if (!covered || !reachable.has(node)) {
      continue;
    }
    const score = Math.abs(node.level - level) * 2 + (node.level > level ? 1 : 0);
    if (score < bestScore) {
      best = node;
      bestScore = score;
    }
  }
  return best;
}
