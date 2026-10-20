// One round of the game: the queue of countries, the rules for wrong clicks, and scoring.
//
//   minefield — one wrong click ends the game; score = countries found
//   accuracy  — a wrong click marks the country missed and the game moves on
//   learn     — a missed country comes back a few turns later until you find it
//
// Each country's first result in a game is saved to your progress (Store.record), so
// the hot list only moves once per game.
(function () {
  'use strict';
  const GM = (window.GM = window.GM || {});

  const RELEARN_GAP = 3; // Learn mode: a missed country returns after this many others

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  class Session {
    constructor({ rules, codes, scope }) {
      this.rules = rules;
      this.scope = scope; // { key, label, ... } from the menu
      this.total = codes.length;
      this.queue = shuffle(codes.slice());
      this.found = new Set(); // found on the first try
      this.missed = new Map(); // code -> label of what was clicked instead (null = "show me")
      this.relearned = new Set(); // Learn mode: missed, then found later
      this.skipped = new Set();
      this.recorded = new Set();
      this.gaveUp = [];
      this.boom = null; // minefield: { code, clicked }
      this.over = false;
      this.startedAt = Date.now();
      this.endedAt = null;
    }

    get current() {
      return this.queue[0] || null;
    }
    // The header count: found (minefield), answered (accuracy) or learned (learn).
    get done() {
      if (this.rules === 'minefield') return this.found.size;
      if (this.rules === 'learn') return this.found.size + this.relearned.size;
      return this.found.size + this.missed.size;
    }
    get firstTryAccuracy() {
      const tries = this.found.size + this.missed.size;
      return tries ? this.found.size / tries : null;
    }
    elapsed() {
      return (this.endedAt || Date.now()) - this.startedAt;
    }

    _record(code, correct) {
      if (this.recorded.has(code)) return;
      this.recorded.add(code);
      GM.Store.record(code, correct);
    }

    _finish() {
      this.over = true;
      this.endedAt = Date.now();
    }

    // Returns 'correct' | 'relearned' | 'miss' | 'boom'.
    answer(correct, clickedLabel) {
      const code = this.current;
      if (!code || this.over) return null;
      let result;
      if (correct) {
        this.queue.shift();
        if (this.missed.has(code)) {
          this.relearned.add(code);
          result = 'relearned';
        } else {
          this.found.add(code);
          this._record(code, true);
          result = 'correct';
        }
      } else {
        result = this._miss(code, clickedLabel);
      }
      if (!this.queue.length && !this.over) this._finish();
      return result;
    }

    _miss(code, clickedLabel) {
      if (!this.missed.has(code)) this.missed.set(code, clickedLabel);
      this._record(code, false);
      if (this.rules === 'minefield') {
        this.boom = { code, clicked: clickedLabel };
        this._finish();
        return 'boom';
      }
      this.queue.shift();
      if (this.rules === 'learn') this.queue.splice(Math.min(RELEARN_GAP, this.queue.length), 0, code);
      return 'miss';
    }

    // Learn mode: give up on the current country and see where it is.
    showMe() {
      const code = this.current;
      if (!code || this.over) return null;
      this._miss(code, null);
      return code;
    }

    skip() {
      const code = this.current;
      if (!code || this.over || this.queue.length < 2) return false;
      this.skipped.add(code);
      this.queue.push(this.queue.shift());
      return true;
    }

    // End the round. Countries you skipped but never found count as misses.
    giveUp() {
      if (this.over) return;
      this.gaveUp = this.queue.filter((c) => !this.missed.has(c));
      this.gaveUp.forEach((c) => {
        if (this.skipped.has(c)) this._record(c, false);
      });
      this._finish();
    }
  }

  GM.Session = Session;
})();
