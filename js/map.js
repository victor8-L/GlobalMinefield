// The world map: land drawn with no borders, zoom/pan, and click judging.
//
// Click judging works on the projected shapes (Path2D hit tests plus distances in map
// units), so it doesn't depend on what's drawn. Countries that are tiny at the current zoom
// accept clicks within TINY_RADIUS_PX of their land, and a click in the water just off a
// coast counts for the country you were looking for.
(function () {
  'use strict';
  const GM = (window.GM = window.GM || {});

  const VB_W = 1000; // map width in viewBox units ("map units")
  const PAD = 6;
  const MAX_ZOOM = 60;
  const TINY_AREA_PX = 12; // countries smaller than this on screen (px², ~3.5px square) are "tiny"...
  const TINY_RADIUS_PX = 8; // ...and accept clicks within this many px of their land
  const COAST_RADIUS_PX = 4; // a click in the water this close to the target's coast counts
  const CLUSTER_GAP = 15; // parts of a country closer than this (map units) form one group
  const SPECK_MAX = 3.2; // islands smaller than this (√area, map units) are drawn as specks...
  const SPECK_MIN_PX = 2.5; // ...until zooming makes the island itself this big
  const DOT_MAX = 4; // revealed countries smaller than this (√area) also get a dot
  const BIG_RING_PX = 130; // countries bigger than this on screen flash instead of getting a ring

  const hitCtx = document.createElement('canvas').getContext('2d');

  // One fixed-size dot per point: tiny round-capped segments with a non-scaling stroke.
  const dotsPath = (pts) => pts.map(([x, y]) => `M${x.toFixed(2)},${y.toFixed(2)}h0.001`).join('');

  const polygonsOf = (geometry) =>
    geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];

  const unionBounds = (a, b) => [
    [Math.min(a[0][0], b[0][0]), Math.min(a[0][1], b[0][1])],
    [Math.max(a[1][0], b[1][0]), Math.max(a[1][1], b[1][1])],
  ];

  function boundsGap(a, b) {
    const dx = Math.max(0, a[0][0] - b[1][0], b[0][0] - a[1][0]);
    const dy = Math.max(0, a[0][1] - b[1][1], b[0][1] - a[1][1]);
    return Math.hypot(dx, dy);
  }

  // The point inside a shape closest to `near` (for shapes whose centroid falls outside them).
  function interiorNear(path2d, [[x0, y0], [x1, y1]], near) {
    let best = null;
    let bestD = Infinity;
    for (let n = 8; n <= 64 && !best; n *= 2) {
      for (let i = 0; i <= n; i++) {
        for (let j = 0; j <= n; j++) {
          const x = x0 + ((x1 - x0) * i) / n;
          const y = y0 + ((y1 - y0) * j) / n;
          const d = Math.hypot(x - near[0], y - near[1]);
          if (d < bestD && hitCtx.isPointInPath(path2d, x, y)) {
            best = [x, y];
            bestD = d;
          }
        }
      }
    }
    return best || near;
  }

  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  class WorldMap {
    constructor(container) {
      this.container = container;
      this.onClick = null; // (mapPoint, screenPoint)
      this.onHover = null; // (mapPoint | null, screenPoint | null)
      this.revealed = new Map(); // code -> svg group
      this.rings = [];
      this.home = null;
      this._buildGeometry();
      this._buildDom();
      this._buildZoom();
    }

    // ---------------------------------------------------------------- geometry

    _buildGeometry() {
      const { topology, extras } = window.GM_WORLD;
      const geoms = topology.objects.countries.geometries.filter((g) => g.properties.name !== 'Antarctica');
      const landFC = {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: {}, geometry: topojson.merge(topology, geoms) }, ...extras],
      };

      // Centered on 11°E so the map's edge runs through the Bering Strait, keeping Russia whole
      // and Fiji, Tonga and Samoa together on the right.
      const projection = d3.geoNaturalEarth1().rotate([-11, 0]);
      projection.fitWidth(VB_W - 2 * PAD, landFC);
      const [tx, ty] = projection.translate();
      projection.translate([tx + PAD, ty + PAD]);
      const path = d3.geoPath(projection);

      this.projection = projection;
      this.W = VB_W;
      this.H = Math.ceil(path.bounds(landFC)[1][1] + PAD);
      this.landD = path(landFC);

      const claimed = new Set();
      const regions = [];
      for (const c of GM.COUNTRIES) {
        const parts = [];
        let geometry = null;
        for (const token of c.m) {
          const hits = /^\d+$/.test(token)
            ? geoms.filter((g) => g.id === token)
            : geoms.filter((g) => g.properties.name === token);
          hits.forEach((g) => {
            parts.push(g);
            claimed.add(g);
          });
          if (!hits.length) {
            const extra = extras.find((f) => f.properties.name === token);
            if (extra) geometry = extra.geometry;
          }
        }
        if (parts.length) geometry = topojson.merge(topology, parts);
        if (!geometry) {
          console.warn('No map shape for', c.name);
          continue;
        }
        regions.push(this._makeRegion(path, geometry, { code: c.code, label: c.name, country: c }));
      }
      geoms
        .filter((g) => !claimed.has(g))
        .forEach((g, i) => {
          const name = g.properties.name;
          const geometry = topojson.feature(topology, g).geometry;
          regions.push(this._makeRegion(path, geometry, { code: 'T' + i, label: GM.TERRITORY_NAMES[name] || name, country: null }));
        });

      this.regions = regions;
      this.byCode = new Map(regions.map((r) => [r.code, r]));
      this.specks = this._makeSpecks(path, topology, geoms, extras);
    }

    _makeRegion(path, geometry, info) {
      const feature = { type: 'Feature', properties: {}, geometry };
      const d = path(feature) || '';
      const path2d = new Path2D(d);

      // Record the projected outline for distance checks.
      const raw = [];
      let ring = null;
      d3.geoPath(this.projection, {
        moveTo(x, y) {
          ring = [x, y];
          raw.push(ring);
        },
        lineTo(x, y) {
          ring.push(x, y);
        },
        closePath() {
          if (ring) ring.push(ring[0], ring[1]);
        },
        arc() {},
        beginPath() {},
      })(feature);
      const bbox = [Infinity, Infinity, -Infinity, -Infinity];
      const rings = raw.map((pts) => {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (let i = 0; i < pts.length; i += 2) {
          if (pts[i] < x0) x0 = pts[i];
          if (pts[i] > x1) x1 = pts[i];
          if (pts[i + 1] < y0) y0 = pts[i + 1];
          if (pts[i + 1] > y1) y1 = pts[i + 1];
        }
        bbox[0] = Math.min(bbox[0], x0);
        bbox[1] = Math.min(bbox[1], y0);
        bbox[2] = Math.max(bbox[2], x1);
        bbox[3] = Math.max(bbox[3], y1);
        return { pts: Float64Array.from(pts), x0, y0, x1, y1 };
      });

      // Group nearby parts (islands) so rings and zooming target the right places:
      // France's main group is the mainland, Kiribati has three far-apart groups.
      const parts = polygonsOf(geometry)
        .map((coordinates) => {
          const poly = { type: 'Polygon', coordinates };
          return { area: path.area(poly), bounds: path.bounds(poly), centroid: path.centroid(poly) };
        })
        .filter((p) => p.area > 0 && isFinite(p.bounds[0][0]))
        .sort((a, b) => b.area - a.area);
      const parent = parts.map((_, i) => i);
      const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
      for (let i = 0; i < parts.length; i++) {
        for (let j = i + 1; j < parts.length; j++) {
          if (boundsGap(parts[i].bounds, parts[j].bounds) <= CLUSTER_GAP) parent[find(j)] = find(i);
        }
      }
      const groups = new Map();
      parts.forEach((p, i) => {
        const root = find(i);
        const g = groups.get(root);
        if (g) {
          g.bounds = unionBounds(g.bounds, p.bounds);
          g.area += p.area;
        } else groups.set(root, { bounds: p.bounds, area: p.area, first: i });
      });
      // Each group is anchored on a point inside its largest piece of land (so a dot never
      // sits in open water); `half` is how far the group reaches from there.
      const clusters = [...groups.values()]
        .sort((a, b) => a.first - b.first) // the group holding the largest part comes first
        .map(({ bounds, area, first }) => {
          const part = parts[first];
          const [cx, cy] = hitCtx.isPointInPath(path2d, part.centroid[0], part.centroid[1])
            ? part.centroid
            : interiorNear(path2d, part.bounds, part.centroid);
          const half = Math.max(
            Math.hypot(cx - bounds[0][0], cy - bounds[0][1]),
            Math.hypot(cx - bounds[1][0], cy - bounds[1][1]),
            Math.hypot(cx - bounds[0][0], cy - bounds[1][1]),
            Math.hypot(cx - bounds[1][0], cy - bounds[0][1])
          );
          return { bounds, area, cx, cy, half };
        });

      const area = path.area(feature);
      return {
        ...info,
        d,
        path2d,
        rings,
        bbox,
        area,
        size: Math.sqrt(area),
        clusters,
        main: clusters[0],
      };
    }

    // Tiny islands are invisible at world zoom, so isolated ones get a land-colored speck.
    // Skipped: land that shares a border with another country (Vatican, Monaco... they sit
    // inside other land and would give themselves away) and islands hugging a much bigger
    // coast (they'd just make the coastline look beaded).
    _makeSpecks(path, topology, geoms, extras) {
      const idx = (a) => (a < 0 ? ~a : a);
      const arcsOf = (g) => (g.type === 'Polygon' ? [g.arcs] : g.type === 'MultiPolygon' ? g.arcs : []);
      const uses = new Map();
      for (const g of geoms) for (const poly of arcsOf(g)) for (const ring of poly) for (const a of ring) uses.set(idx(a), (uses.get(idx(a)) || 0) + 1);

      const pieces = [];
      const addPiece = (shape, bordered) => {
        const area = path.area(shape);
        if (area > 0) pieces.push({ shape, bordered, size: Math.sqrt(area), bounds: path.bounds(shape) });
      };
      for (const g of geoms) {
        for (const poly of arcsOf(g)) {
          const bordered = poly.some((ring) => ring.some((a) => uses.get(idx(a)) > 1));
          addPiece(topojson.feature(topology, { type: 'Polygon', arcs: poly }).geometry, bordered);
        }
      }
      for (const f of extras) for (const coordinates of polygonsOf(f.geometry)) addPiece({ type: 'Polygon', coordinates }, false);

      const HUG = 1.5; // map units (~60 km)
      const hugs = (piece, x, y) =>
        pieces.some((o) => {
          if (o === piece || o.size < piece.size * 3) return false;
          const b = o.bounds;
          if (x < b[0][0] - HUG || x > b[1][0] + HUG || y < b[0][1] - HUG || y > b[1][1] + HUG) return false;
          o.path2d = o.path2d || new Path2D(path(o.shape));
          hitCtx.lineWidth = HUG * 2;
          return hitCtx.isPointInPath(o.path2d, x, y) || hitCtx.isPointInStroke(o.path2d, x, y);
        });

      const specks = [];
      for (const piece of pieces) {
        if (piece.bordered || !(piece.size < SPECK_MAX)) continue;
        const [x, y] = path.centroid(piece.shape);
        if (isFinite(x) && !hugs(piece, x, y)) specks.push({ x, y, size: piece.size });
      }
      specks.sort((a, b) => b.size - a.size);
      const taken = new Set();
      return specks.filter((s) => {
        const key = Math.round(s.x / 1.2) + ',' + Math.round(s.y / 1.2);
        if (taken.has(key)) return false;
        taken.add(key);
        return true;
      });
    }

    // ---------------------------------------------------------------- DOM + zoom

    _buildDom() {
      const root = d3.select(this.container);
      this.svg = root
        .append('svg')
        .attr('viewBox', `0 0 ${this.W} ${this.H}`)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .attr('role', 'img')
        .attr('aria-label', 'World map without borders');
      this.g = this.svg.append('g');
      this.g.append('path').attr('class', 'land').attr('d', this.landD);

      const edges = [0, 0.025, 0.05, 0.1, 0.2, 0.4, 0.8, 1.6, SPECK_MAX];
      const specks = this.g.append('g').attr('class', 'specks');
      this.speckLayers = edges.slice(0, -1).map((lo, i) => {
        const d = dotsPath(this.specks.filter((s) => s.size >= lo && s.size < edges[i + 1]).map((s) => [s.x, s.y]));
        const el = specks.append('g');
        el.append('path').attr('class', 'speck-edge').attr('d', d);
        el.append('path').attr('class', 'speck').attr('d', d);
        return { lo, el };
      });

      this.gReveal = this.g.append('g').attr('class', 'reveals');
      this.gHover = this.g.append('g').attr('class', 'hover-shape');
      this.overlay = root.append('div').attr('class', 'map-overlay');
    }

    _buildZoom() {
      this.zoom = d3
        .zoom()
        .scaleExtent([1, MAX_ZOOM])
        .translateExtent([
          [0, 0],
          [this.W, this.H],
        ])
        .clickDistance(5)
        .on('start', (e) => {
          if (e.sourceEvent && e.sourceEvent.type === 'mousedown') this.container.classList.add('dragging');
        })
        .on('zoom', (e) => {
          this.g.attr('transform', e.transform);
          this._afterZoom();
        })
        .on('end', () => this.container.classList.remove('dragging'));
      this.svg.call(this.zoom).on('dblclick.zoom', null);

      this.svg.on('click', (e) => {
        if (this.onClick) this.onClick(this.pointer(e), this.screenPoint(e));
      });
      let raf = 0;
      let last = null;
      this.svg.on('pointermove', (e) => {
        if (!this.onHover) return;
        last = e;
        if (!raf) {
          raf = requestAnimationFrame(() => {
            raf = 0;
            if (this.onHover && last) this.onHover(this.pointer(last), this.screenPoint(last));
          });
        }
      });
      this.svg.on('pointerleave', () => {
        last = null;
        if (this.onHover) this.onHover(null, null);
      });
      window.addEventListener('resize', () => this._afterZoom());
      this._afterZoom();
    }

    _afterZoom() {
      const s = this.scale();
      if (!s) return;
      for (const layer of this.speckLayers) layer.el.style('display', layer.lo * s > SPECK_MIN_PX ? 'none' : null);
      for (const ring of this.rings) this._placeRing(ring, s);
    }

    pointer(e) {
      return d3.pointer(e, this.g.node());
    }
    screenPoint(e) {
      const r = this.container.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    }
    // Screen pixels per map unit at the current zoom.
    scale() {
      const m = this.g.node().getScreenCTM();
      return m ? m.a : 0;
    }
    toScreen(x, y) {
      const m = this.g.node().getScreenCTM();
      const r = this.container.getBoundingClientRect();
      return [m.a * x + m.e - r.left, m.d * y + m.f - r.top];
    }

    // Projected bounds of a [[west, south], [east, north]] lon/lat box.
    boundsForBox([[w, s], [e, n]]) {
      const pts = [];
      for (let i = 0; i <= 24; i++) {
        const lon = w + ((e - w) * i) / 24;
        const lat = s + ((n - s) * i) / 24;
        pts.push([lon, s], [lon, n], [w, lat], [e, lat]);
      }
      const xy = pts.map((p) => this.projection(p));
      return [
        [d3.min(xy, (p) => p[0]), d3.min(xy, (p) => p[1])],
        [d3.max(xy, (p) => p[0]), d3.max(xy, (p) => p[1])],
      ];
    }

    zoomToBounds([[x0, y0], [x1, y1]], duration = 750) {
      const k = Math.max(1, Math.min(MAX_ZOOM, 0.92 / Math.max((x1 - x0) / this.W, (y1 - y0) / this.H)));
      const t = d3.zoomIdentity
        .translate(this.W / 2, this.H / 2)
        .scale(k)
        .translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
      this.svg.interrupt().transition().duration(duration).call(this.zoom.transform, t);
    }

    setHome(bounds) {
      this.home = bounds;
    }
    goHome(duration = 750) {
      if (this.home) this.zoomToBounds(this.home, duration);
      else this.svg.interrupt().transition().duration(duration).call(this.zoom.transform, d3.zoomIdentity);
    }
    zoomBy(factor) {
      this.svg.interrupt().transition().duration(250).call(this.zoom.scaleBy, factor);
    }

    // Zoom to a country, keeping at least `context` map units of surroundings in view.
    focus(code, { context = 110, duration = 750 } = {}) {
      const r = this.byCode.get(code);
      if (!r) return;
      const [[x0, y0], [x1, y1]] = r.main.bounds;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const hw = Math.max((x1 - x0) / 2 + 4, context / 2);
      const hh = Math.max((y1 - y0) / 2 + 4, context / 4);
      this.zoomToBounds([[cx - hw, cy - hh], [cx + hw, cy + hh]], duration);
    }

    isVisible(code) {
      const r = this.byCode.get(code);
      if (!r) return false;
      const { width, height } = this.container.getBoundingClientRect();
      return r.clusters.some((c) => {
        const [x, y] = this.toScreen(c.cx, c.cy);
        return x >= 0 && y >= 0 && x <= width && y <= height;
      });
    }

    // ---------------------------------------------------------------- hit testing

    // The region whose land contains p (the smallest one, for enclaves).
    regionAt(p) {
      let best = null;
      for (const r of this.regions) {
        const b = r.bbox;
        if (p[0] < b[0] || p[0] > b[2] || p[1] < b[1] || p[1] > b[3]) continue;
        if (hitCtx.isPointInPath(r.path2d, p[0], p[1]) && (!best || r.area < best.area)) best = r;
      }
      return best;
    }

    // Distance (map units) from p to a region's land: 0 inside, Infinity if beyond max.
    distance(r, p, max) {
      const b = r.bbox;
      if (p[0] < b[0] - max || p[0] > b[2] + max || p[1] < b[1] - max || p[1] > b[3] + max) return Infinity;
      if (hitCtx.isPointInPath(r.path2d, p[0], p[1])) return 0;
      let best = Infinity;
      for (const ring of r.rings) {
        if (p[0] < ring.x0 - max || p[0] > ring.x1 + max || p[1] < ring.y0 - max || p[1] > ring.y1 + max) continue;
        const pts = ring.pts;
        for (let i = 2; i < pts.length; i += 2) {
          const d = segDist(p[0], p[1], pts[i - 2], pts[i - 1], pts[i], pts[i + 1]);
          if (d < best) best = d;
        }
      }
      return best <= max ? best : Infinity;
    }

    _tolerances() {
      const s = this.scale() || 1;
      const tinyArea = TINY_AREA_PX / (s * s);
      return {
        rTiny: TINY_RADIUS_PX / s,
        rCoast: COAST_RADIUS_PX / s,
        isTiny: (r) => r.area < tinyArea,
      };
    }

    _nearestTiny(p, radius, isTiny, exclude) {
      let best = null;
      let bestD = Infinity;
      for (const r of this.regions) {
        if (r === exclude || !isTiny(r)) continue;
        const d = this.distance(r, p, radius);
        if (d < bestD) {
          best = r;
          bestD = d;
        }
      }
      return best ? { r: best, d: bestD } : null;
    }

    // What a click at p counts as. `target` (optional) is the region being looked for.
    // On a normal country's land, that country wins unless you're hunting a tiny country and
    // clicked right next to another tiny one (Rome while looking for San Marino = Vatican City).
    _identify(p, inside, tol, target) {
      const huntingTiny = !!target && tol.isTiny(target);
      const near = this._nearestTiny(p, tol.rTiny, tol.isTiny, target);
      const veryNear = near && near.d <= tol.rTiny / 2;
      if (inside && !tol.isTiny(inside)) return huntingTiny && veryNear ? near.r : inside;
      if (near && (huntingTiny || veryNear)) return near.r;
      if (inside) return inside;
      let best = null;
      let bestD = tol.rCoast;
      for (const r of this.regions) {
        if (r === target) continue;
        const d = this.distance(r, p, tol.rCoast);
        if (d <= bestD) {
          best = r;
          bestD = d;
        }
      }
      return best;
    }

    // Judges a click at map point p while looking for `targetCode`.
    // Returns { correct, clicked } — clicked is a region, or null for open ocean.
    judge(p, targetCode) {
      const tol = this._tolerances();
      const target = this.byCode.get(targetCode);
      const inside = this.regionAt(p);
      if (target) {
        if (inside === target) return { correct: true, clicked: target };
        const dT = this.distance(target, p, Math.max(tol.rTiny, tol.rCoast));
        if (tol.isTiny(target) && dT <= tol.rTiny) {
          const other = this._nearestTiny(p, tol.rTiny, tol.isTiny, target);
          if (!other || other.d >= dT) return { correct: true, clicked: target };
        }
        if (!inside && dT <= tol.rCoast) return { correct: true, clicked: target };
      }
      return { correct: false, clicked: this._identify(p, inside, tol, target) };
    }

    // The region under the pointer (for hovering / identifying).
    pick(p) {
      return this._identify(p, this.regionAt(p), this._tolerances(), null);
    }

    // A point inside a country's land (for self-tests).
    interiorPoint(code) {
      const r = this.byCode.get(code);
      const [[x0, y0], [x1, y1]] = r.main.bounds;
      for (let n = 4; n <= 64; n *= 2) {
        for (let i = 1; i < n; i++) {
          for (let j = 1; j < n; j++) {
            const p = [x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * j) / n];
            if (this.regionAt(p) === r) return p;
          }
        }
      }
      return null;
    }

    // ---------------------------------------------------------------- drawing

    _shape(group, r) {
      group.append('path').attr('class', 'shape').attr('d', r.d);
      if (r.size < DOT_MAX) group.append('path').attr('class', 'dot').attr('d', dotsPath(r.clusters.map((c) => [c.cx, c.cy])));
    }

    // Fill a country in: cls is found | missed | gaveup | relearned | boom | mastered | learning | hot
    reveal(code, cls) {
      const r = this.byCode.get(code);
      if (!r) return;
      let el = this.revealed.get(code);
      if (!el) {
        el = this.gReveal.append('g');
        this._shape(el, r);
        this.revealed.set(code, el);
      }
      el.attr('class', 'rv ' + cls);
    }
    revealedAs(code) {
      const el = this.revealed.get(code);
      return el ? el.attr('class').replace(/^rv /, '').replace(/ flash$/, '') : null;
    }
    unreveal(code) {
      const el = this.revealed.get(code);
      if (el) {
        el.remove();
        this.revealed.delete(code);
      }
    }
    clearReveals() {
      this.gReveal.selectAll('*').remove();
      this.revealed.clear();
      this.clearRings();
      this.setHover(null);
    }

    setHover(code, cls = 'hover') {
      if (this._hover === code + cls) return;
      this._hover = code + cls;
      this.gHover.selectAll('*').remove();
      this.gHover.attr('class', 'hover-shape ' + cls);
      const r = code && this.byCode.get(code);
      if (r) this._shape(this.gHover, r);
    }

    // Draw attention to a country: rings around small ones, a flash on big ones.
    pulse(code, cls = 'miss', ms = 2600) {
      const r = this.byCode.get(code);
      if (!r) return;
      const s = this.scale();
      const el = this.revealed.get(code);
      if (el && r.main.half * s > BIG_RING_PX) {
        el.classed('flash', true);
        setTimeout(() => el.classed('flash', false), 1600);
        return;
      }
      const clusters = r.size < DOT_MAX ? r.clusters : [r.main];
      for (const c of clusters) {
        const ring = { el: this.overlay.append('div').attr('class', 'ring ' + cls), c };
        this.rings.push(ring);
        this._placeRing(ring, s);
        setTimeout(() => {
          ring.el.remove();
          this.rings = this.rings.filter((x) => x !== ring);
        }, ms);
      }
    }
    _placeRing(ring, s) {
      const [x, y] = this.toScreen(ring.c.cx, ring.c.cy);
      const size = Math.max(34, Math.min(2 * BIG_RING_PX, ring.c.half * 2 * s + 22));
      ring.el
        .style('left', x + 'px')
        .style('top', y + 'px')
        .style('width', size + 'px')
        .style('height', size + 'px');
    }
    clearRings() {
      this.rings.forEach((r) => r.el.remove());
      this.rings = [];
    }

    // A short message at a screen point (e.g. where you clicked).
    toast([x, y], text, cls) {
      const { width } = this.container.getBoundingClientRect();
      const mark = this.overlay.append('div').attr('class', 'click-mark ' + cls).style('left', x + 'px').style('top', y + 'px');
      const el = this.overlay
        .append('div')
        .attr('class', 'toast ' + cls)
        .text(text)
        .style('left', Math.max(90, Math.min(width - 90, x)) + 'px')
        .style('top', y + 'px');
      setTimeout(() => {
        el.remove();
        mark.remove();
      }, 1900);
    }
  }

  GM.WorldMap = WorldMap;
})();
