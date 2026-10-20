// Builds js/data/world.js from the world-atlas TopoJSON files.
//   Sources: https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json
//            https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-10m.json
// Usage: node tools/build-data.js <countries-50m.json> <countries-10m.json>
// The 50m map is the base; Tuvalu only exists in the 10m map, so it is added as an extra feature.
const fs = require('fs');
const path = require('path');
const topojson = require('../js/vendor/topojson-client.min.js');

const [file50, file10] = process.argv.slice(2);
const t50 = JSON.parse(fs.readFileSync(file50, 'utf8'));
const t10 = JSON.parse(fs.readFileSync(file10, 'utf8'));

delete t50.objects.land; // land is merged at runtime from the countries (minus Antarctica)

const round = (v) => Math.round(v * 1e4) / 1e4;
const roundCoords = (c) => (typeof c[0] === 'number' ? c.map(round) : c.map(roundCoords));

const extras = topojson
  .feature(t10, t10.objects.countries)
  .features.filter((f) => f.properties.name === 'Tuvalu')
  .map((f) => ({ ...f, geometry: { ...f.geometry, coordinates: roundCoords(f.geometry.coordinates) } }));
if (extras.length !== 1) throw new Error('Tuvalu not found in 10m data');

const out = path.join(__dirname, '..', 'js', 'data', 'world.js');
fs.writeFileSync(out, 'window.GM_WORLD = ' + JSON.stringify({ topology: t50, extras }) + ';\n');
console.log('wrote', out, (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
