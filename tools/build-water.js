// Builds js/data/water.js (shapes for the Water game) from Natural Earth v5.1.2 GeoJSON:
//   ne_10m_geography_marine_polys.geojson
//   ne_50m_lakes.geojson
//   ne_50m_rivers_lake_centerlines.geojson
// from https://github.com/nvkelso/natural-earth-vector/tree/v5.1.2/geojson
//
// Usage: node tools/build-water.js <folder with those three files>
//
// Each body of water in js/water.js gets its shapes, simplified to keep the file small and
// wound the way d3 expects. Named seas, gulfs and straits that aren't in the game are kept
// too ("context"), so a click on one can say what it is.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const d3 = require('../js/vendor/d3.min.js');

const root = path.join(__dirname, '..');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'js/water.js'), 'utf8'), sandbox);
const WATER = sandbox.window.GM.WATER;

const dir = process.argv[2];
if (!dir) throw new Error('Usage: node tools/build-water.js <natural earth folder>');
const load = (file) => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')).features;
const marine = load('ne_10m_geography_marine_polys.geojson');
const lakes = load('ne_50m_lakes.geojson');
const rivers = load('ne_50m_rivers_lake_centerlines.geojson');

const norm = (s) => String(s || '').normalize('NFC').replace(/\s+/g, ' ').trim();
const CONTEXT_CLASSES = new Set(['sea', 'bay', 'gulf', 'strait', 'channel', 'sound', 'fjord', 'lagoon', 'inlet']);
// Left out of the context areas: Natural Earth only has slivers for the first four (js/water.js
// draws them by hand), the Southern Ocean is built at runtime, and the channels in the Amazon's
// mouth would otherwise "steal" clicks meant for the river.
const REPLACED = new Set([
  'Strait of Gibraltar',
  'Bab el Mandeb',
  'Drake Passage',
  'Saint Lawrence River',
  'SOUTHERN OCEAN',
  'Canal do Norte',
  'Canal do Sul',
  'Canal Perigoso',
]);

// ------------------------------------------------------------------ geometry helpers

function perpDist([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Douglas–Peucker
function simplify(pts, tol) {
  if (pts.length <= 2) return pts.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let maxD = 0;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = perpDist(pts[i], pts[a], pts[b]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > tol) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

const round = (pts) => pts.map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]);

function ringArea(ring) {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return Math.abs(a / 2);
}

const polygonsOf = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []);
const linesOf = (g) => (g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : []);

// Simplify a set of polygons as one shape: tiny islands (holes) and specks are dropped,
// and rings are wound so d3 fills the inside rather than the rest of the globe.
function cleanPolygons(polys) {
  const total = polys.reduce((s, p) => s + ringArea(p[0]), 0);
  const tol = Math.max(0.002, Math.min(0.03, Math.sqrt(total) / 40));
  const minArea = (2 * tol) ** 2;
  const largest = Math.max(...polys.map((p) => ringArea(p[0])));
  const out = [];
  for (const poly of polys) {
    const outerArea = ringArea(poly[0]);
    if (outerArea < minArea && outerArea < largest) continue;
    const rings = [];
    poly.forEach((ring, i) => {
      const s = round(simplify(ring, tol));
      if (s.length < 4) return;
      if (i > 0 && ringArea(s) < minArea) return; // drop small islands
      rings.push(s);
    });
    if (!rings.length) continue;
    if (d3.geoArea({ type: 'Polygon', coordinates: rings }) > 2 * Math.PI) rings.forEach((r) => r.reverse());
    out.push(rings);
  }
  return out;
}

function cleanLines(lines) {
  return lines.map((l) => round(simplify(l, 0.01))).filter((l) => l.length >= 2);
}

// ------------------------------------------------------------------ build

function findFeatures(token) {
  const lake = token.startsWith('lake:');
  const river = token.startsWith('river:');
  const name = norm(token.replace(/^(lake|river):/, ''));
  const pool = lake ? lakes : river ? rivers : marine;
  const hits = pool.filter((f) => norm(f.properties.name) === name);
  if (!hits.length) throw new Error(`No Natural Earth feature named "${name}" (${token})`);
  return { river, hits };
}

const shapes = {};
const used = new Set(WATER.map((w) => norm(w.name)));
for (const w of WATER) {
  if (w.area) shapes[w.code] = { type: 'MultiPolygon', coordinates: cleanPolygons([[w.area]]) };
  if (!w.m.length) continue; // hand-drawn (line strait, the area above, or a band built by the map)
  const polys = [];
  const lines = [];
  for (const token of w.m) {
    const { river, hits } = findFeatures(token);
    if (!token.includes(':')) used.add(norm(token));
    for (const f of hits) (river ? lines.push(...linesOf(f.geometry)) : polys.push(...polygonsOf(f.geometry)));
  }
  shapes[w.code] = lines.length
    ? { type: 'MultiLineString', coordinates: cleanLines(lines) }
    : { type: 'MultiPolygon', coordinates: cleanPolygons(polys) };
}

const contextByName = new Map();
for (const f of marine) {
  const name = norm(f.properties.name);
  if (!name || used.has(name) || REPLACED.has(name) || !CONTEXT_CLASSES.has(f.properties.featurecla)) continue;
  const entry = contextByName.get(name) || { name, polys: [] };
  entry.polys.push(...polygonsOf(f.geometry));
  contextByName.set(name, entry);
}
const context = [...contextByName.values()]
  .map(({ name, polys }) => ({ name, geometry: { type: 'MultiPolygon', coordinates: cleanPolygons(polys) } }))
  .filter((c) => c.geometry.coordinates.length);

const out = path.join(root, 'js/data/water.js');
fs.writeFileSync(out, 'window.GM_WATER_DATA = ' + JSON.stringify({ shapes, context }) + ';\n');
const kb = (fs.statSync(out).size / 1024).toFixed(0);
console.log(`wrote ${out}: ${Object.keys(shapes).length} shapes, ${context.length} context areas, ${kb} KB`);
