// Progress saved in the browser (localStorage): per-country results, pins, best scores,
// recent games and menu preferences. Export/import lets you back it up or move it.
(function () {
  'use strict';
  const GM = (window.GM = window.GM || {});

  const KEY = 'globalMinefield.v1';
  const MASTERED_STREAK = 3; // right this many games in a row = off the hot list
  const MAX_GAMES = 200;

  const blank = () => ({ v: 1, countries: {}, pins: {}, best: {}, games: [], prefs: {} });
  let data = blank();
  let ok = true;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) data = Object.assign(blank(), JSON.parse(raw));
    } catch (e) {
      ok = false;
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      ok = true;
    } catch (e) {
      ok = false;
    }
  }

  const Store = {
    MASTERED_STREAK,
    load,
    get ok() {
      return ok;
    },

    rec(code) {
      return data.countries[code] || null;
    },

    // One result per country per game: true = found on the first try.
    record(code, correct) {
      const now = Date.now();
      const r =
        data.countries[code] ||
        (data.countries[code] = { n: 0, ok: 0, miss: 0, streak: 0, last: 0, lastMiss: 0, recent: '' });
      r.n++;
      r.last = now;
      if (correct) {
        r.ok++;
        r.streak++;
      } else {
        r.miss++;
        r.streak = 0;
        r.lastMiss = now;
      }
      r.recent = (r.recent + (correct ? '1' : '0')).slice(-10);
      save();
    },

    isPinned(code) {
      return !!data.pins[code];
    },
    setPinned(code, on) {
      if (on) data.pins[code] = Date.now();
      else delete data.pins[code];
      save();
    },

    isHot(code) {
      if (data.pins[code]) return true;
      const r = data.countries[code];
      return !!(r && r.miss > 0 && r.streak < MASTERED_STREAK);
    },

    // 'hot' | 'mastered' | 'learning' | 'new'
    status(code) {
      if (this.isHot(code)) return 'hot';
      const r = data.countries[code];
      if (!r || !r.n) return 'new';
      return r.streak >= MASTERED_STREAK ? 'mastered' : 'learning';
    },

    // How badly a country needs practice; the hot list is sorted by this.
    heat(code) {
      const r = data.countries[code];
      if (!r) return data.pins[code] ? 1 : 0;
      const recentMisses = (r.recent.match(/0/g) || []).length;
      return recentMisses * 3 + r.miss - r.streak * 2 + (data.pins[code] ? 1 : 0);
    },

    // `items` is GM.COUNTRIES or GM.WATER: each game has its own hot list.
    hotList(items = GM.COUNTRIES) {
      return items.filter((c) => this.isHot(c.code)).sort(
        (a, b) => this.heat(b.code) - this.heat(a.code) || a.name.localeCompare(b.name)
      );
    },

    best(key) {
      return data.best[key] || null;
    },
    // Keeps the better of the stored and new result; returns true if it's a new best.
    offerBest(key, entry, isBetter) {
      const cur = data.best[key];
      if (cur && !isBetter(entry, cur)) return false;
      data.best[key] = entry;
      save();
      return true;
    },

    addGame(game) {
      data.games.push(game);
      if (data.games.length > MAX_GAMES) data.games.splice(0, data.games.length - MAX_GAMES);
      save();
    },
    games() {
      return data.games;
    },

    pref(name, fallback) {
      return name in data.prefs ? data.prefs[name] : fallback;
    },
    setPref(name, value) {
      data.prefs[name] = value;
      save();
    },

    exportJSON() {
      return JSON.stringify(data, null, 1);
    },
    importJSON(text) {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || typeof parsed.countries !== 'object') {
        throw new Error('That file is not a Global Minefield progress backup.');
      }
      data = Object.assign(blank(), parsed);
      save();
    },
    reset() {
      const prefs = data.prefs;
      data = blank();
      data.prefs = prefs;
      save();
    },
  };

  GM.Store = Store;
})();
