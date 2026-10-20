// Wires the UI together: start menu, the game loop, results, the progress screen and the
// study map.
(function () {
  'use strict';
  const GM = window.GM;
  const Store = GM.Store;

  const $ = (sel) => document.querySelector(sel);
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  const COUNTRY = new Map(GM.COUNTRIES.map((c) => [c.code, c]));
  const CONTINENT = new Map(GM.CONTINENTS.map((c) => [c.id, c]));
  const ALL_CODES = GM.COUNTRIES.map((c) => c.code);
  const nameOf = (code) => COUNTRY.get(code).name;

  const RULES = {
    minefield: { name: 'Minefield', desc: 'One wrong click ends the game. How far can you get?' },
    accuracy: { name: 'Accuracy', desc: 'A miss turns the real country red and the game keeps going.' },
    learn: { name: 'Learn', desc: 'Misses come back a few turns later until you get them right.' },
  };
  const STATUS_LABEL = { hot: 'Hot', learning: 'Learning', mastered: 'Mastered', new: 'Not played' };

  function fmtTime(ms) {
    const total = Math.floor(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = String(total % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
  }
  const pct = (x) => (x == null || isNaN(x) ? '–' : Math.round(x * 100) + '%');
  const unionBounds = (a, b) => [
    [Math.min(a[0][0], b[0][0]), Math.min(a[0][1], b[0][1])],
    [Math.max(a[1][0], b[1][0]), Math.max(a[1][1], b[1][1])],
  ];

  Store.load();
  const map = new GM.WorldMap($('#map'));

  let mode = 'menu'; // menu | play | over | study
  let session = null;
  let timer = 0;
  let bannerTimer = 0;
  let statsReturn = null;
  let scope = loadScope();
  let rules = RULES[Store.pref('rules')] ? Store.pref('rules') : 'minefield';
  const statsFilter = { q: '', cont: '', status: '' };

  // ---------------------------------------------------------------- scopes

  // { kind: 'world' } | { kind: 'cont', ids } | { kind: 'hot' } | { kind: 'list', codes, label }
  function loadScope() {
    const s = Store.pref('scope');
    if (s && s.kind === 'cont' && Array.isArray(s.ids) && s.ids.length && s.ids.every((id) => CONTINENT.has(id))) return s;
    if (s && s.kind === 'hot') return s;
    return { kind: 'world' };
  }
  function scopeCodes(sc) {
    if (sc.kind === 'cont') return ALL_CODES.filter((c) => sc.ids.includes(COUNTRY.get(c).cont));
    if (sc.kind === 'hot') return Store.hotList().map((c) => c.code);
    if (sc.kind === 'list') return sc.codes.slice();
    return ALL_CODES.slice();
  }
  function scopeLabel(sc) {
    if (sc.kind === 'cont') return sc.ids.map((id) => CONTINENT.get(id).name).join(' + ');
    if (sc.kind === 'hot') return 'Hot list';
    if (sc.kind === 'list') return sc.label;
    return 'World';
  }
  // Best scores are kept per mode for the World and for each set of continents.
  function bestKey(r, sc) {
    if (sc.kind === 'world') return r + '|world';
    if (sc.kind === 'cont') return r + '|' + sc.ids.slice().sort().join('+');
    return null;
  }
  // The view a game starts in: the chosen continents, or the one continent a list falls in.
  function scopeView(sc, codes) {
    let ids = sc.kind === 'cont' ? sc.ids : null;
    if (!ids && sc.kind !== 'world') {
      const conts = new Set(codes.map((c) => COUNTRY.get(c).cont));
      if (conts.size === 1) ids = [...conts];
    }
    return ids ? ids.map((id) => map.boundsForBox(CONTINENT.get(id).view)).reduce(unionBounds) : null;
  }

  // ---------------------------------------------------------------- screens

  function setMode(m) {
    mode = m;
    document.body.dataset.mode = m;
    document.body.classList.remove('results-hidden');
    map.setHover(null);
    hideTip();
  }
  function showOverlay(id) {
    for (const el of ['menu', 'results', 'stats']) $('#' + el).hidden = el !== id;
  }

  function openMenu() {
    if (mode === 'play' && session && session.done > 0 && !confirm('Leave this game? Results so far are already saved.')) return;
    stopTimer();
    session = null;
    setMode('menu');
    hideBanner();
    map.clearReveals();
    map.setHome(null);
    map.goHome();
    renderMenu();
    showOverlay('menu');
  }

  function masteredShare(codes) {
    return codes.length ? codes.filter((c) => Store.status(c) === 'mastered').length / codes.length : 0;
  }

  function bestText(r, sc) {
    const key = bestKey(r, sc);
    const b = key && Store.best(key);
    if (!b) return '';
    if (r === 'minefield') return `Best: ${b.found}/${b.total}`;
    if (r === 'accuracy') return `Best: ${pct(b.acc)} in ${fmtTime(b.ms)}`;
    return '';
  }

  function renderMenu() {
    const hot = Store.hotList().map((c) => c.code);
    if (scope.kind === 'hot' && !hot.length) scope = { kind: 'world' };
    const chip = (key, label, codes, on, cls = '', disabled = false) =>
      `<button class="chip ${cls} ${on ? 'on' : ''}" data-scope="${key}" aria-pressed="${on}" ${disabled ? 'disabled' : ''}>` +
      `${label} <span class="n">${codes.length}</span><i class="bar" style="--p:${Math.round(masteredShare(codes) * 100)}%"></i></button>`;
    $('#scopeChips').innerHTML = [
      chip('world', 'World', ALL_CODES, scope.kind === 'world'),
      ...GM.CONTINENTS.map((ct) =>
        chip(
          'cont:' + ct.id,
          ct.name,
          ALL_CODES.filter((c) => COUNTRY.get(c).cont === ct.id),
          scope.kind === 'cont' && scope.ids.includes(ct.id)
        )
      ),
      chip('hot', '🔥 Hot list', hot, scope.kind === 'hot', 'hot', !hot.length),
    ].join('');

    $('#modes').innerHTML = Object.entries(RULES)
      .map(([id, r]) => {
        const best = bestText(id, scope);
        return (
          `<button class="mode ${id === rules ? 'on' : ''}" data-rules="${id}" aria-pressed="${id === rules}">` +
          `<b>${r.name}</b><span>${r.desc}</span>${best ? `<em>${best}</em>` : ''}</button>`
        );
      })
      .join('');

    const n = scopeCodes(scope).length;
    $('#btnStart').textContent = `Start ${RULES[rules].name} · ${n} ${n === 1 ? 'country' : 'countries'}`;
    $('#storageWarn').hidden = Store.ok;
  }

  $('#scopeChips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-scope]');
    if (!b || b.disabled) return;
    const v = b.dataset.scope;
    if (v === 'world' || v === 'hot') {
      scope = { kind: v };
    } else {
      const id = v.slice(5);
      let ids = [id];
      if (scope.kind === 'cont') ids = scope.ids.includes(id) ? scope.ids.filter((x) => x !== id) : [...scope.ids, id];
      ids = GM.CONTINENTS.map((c) => c.id).filter((x) => ids.includes(x));
      scope = !ids.length || ids.length === GM.CONTINENTS.length ? { kind: 'world' } : { kind: 'cont', ids };
    }
    Store.setPref('scope', scope);
    renderMenu();
  });
  $('#modes').addEventListener('click', (e) => {
    const b = e.target.closest('[data-rules]');
    if (!b) return;
    rules = b.dataset.rules;
    Store.setPref('rules', rules);
    renderMenu();
  });
  $('#btnStart').addEventListener('click', () => startGame(scope, rules));
  $('#btnStudy').addEventListener('click', startStudy);
  $('#btnStats').addEventListener('click', openStats);

  // ---------------------------------------------------------------- game loop

  function startGame(sc, r) {
    const codes = scopeCodes(sc);
    if (!codes.length) return;
    session = new GM.Session({ rules: r, codes, scope: sc });
    setMode('play');
    document.body.classList.toggle('rules-learn', r === 'learn');
    showOverlay(null);
    hideBanner();
    map.clearReveals();
    map.setHome(scopeView(sc, codes));
    map.goHome();
    clearLog();

    $('#hudMode').textContent = `${RULES[r].name} · ${scopeLabel(sc)}`;
    $('#hudScoreLabel').textContent = { minefield: 'found', accuracy: 'done', learn: 'learned' }[r];
    $('#hudAccLabel').textContent = r === 'learn' ? 'first try' : 'accuracy';
    const key = bestKey(r, sc);
    const best = key && Store.best(key);
    $('#hudAccWrap').hidden = r === 'minefield';
    $('#hudBestWrap').hidden = r !== 'minefield' || !key;
    $('#hudBest').textContent = best ? best.found : '–';

    renderHud();
    renderPrompt();
    startTimer();
  }

  function renderHud() {
    if (!session) return;
    $('#hudScore').textContent = `${session.done}/${session.total}`;
    $('#hudAcc').textContent = pct(session.firstTryAccuracy);
    $('#hudTime').textContent = fmtTime(session.elapsed());
  }
  function startTimer() {
    stopTimer();
    timer = setInterval(() => {
      if (session) $('#hudTime').textContent = fmtTime(session.elapsed());
    }, 500);
  }
  function stopTimer() {
    clearInterval(timer);
    timer = 0;
  }

  function renderPrompt() {
    const code = session.current;
    if (!code) return;
    const c = COUNTRY.get(code);
    // Learn mode: a missed country stays red for a few turns, then hides again when it comes back.
    if (session.rules === 'learn' && map.revealedAs(code) === 'missed') map.unreveal(code);
    $('#promptName').textContent = c.name;
    $('#promptAka').textContent = c.aka ? `also known as ${c.aka}` : '';
    $('#btnSkip').disabled = session.queue.length < 2;
    const p = $('#prompt');
    p.classList.remove('bump');
    void p.offsetWidth;
    p.classList.add('bump');
  }

  map.onClick = (p, screen) => {
    if (mode === 'play') answerAt(p, screen);
    else if (mode === 'study' || mode === 'over') identifyAt(p, screen);
  };

  function answerAt(p, screen) {
    const s = session;
    if (!s || s.over) return;
    const code = s.current;
    const name = nameOf(code);
    const { correct, clicked } = map.judge(p, code);
    if (!correct && !clicked) {
      map.toast(screen, 'Open water: no penalty', 'neutral');
      return;
    }
    const result = s.answer(correct, clicked.label);
    if (result === 'correct' || result === 'relearned') {
      map.reveal(code, result === 'correct' ? 'found' : 'relearned');
      map.toast(screen, '✓ ' + name, 'good');
      addLog(code, 'good', result === 'relearned' ? 'got it this time' : '');
    } else {
      map.reveal(code, 'missed');
      if (result === 'boom') map.reveal(clicked.code, 'boom');
      map.toast(screen, (result === 'boom' ? '💥 ' : '✗ ') + clicked.label, 'bad');
      showTarget(code, 'miss', result === 'boom' ? 4200 : 2600);
      addLog(code, 'bad', 'you clicked ' + clicked.label);
      if (result === 'boom') shake();
      else
        banner(
          `<b>${esc(name)}</b> is shown in red. You clicked ${esc(clicked.label)}.` +
            (s.rules === 'learn' ? ' It will come back in a few turns.' : ''),
          'bad'
        );
    }
    afterTurn();
  }

  // Make sure a country is on screen, then draw attention to it.
  function showTarget(code, cls, ms) {
    if (map.isVisible(code)) {
      map.pulse(code, cls, ms);
      return;
    }
    map.focus(code, { context: 160 });
    setTimeout(() => map.pulse(code, cls, ms), 800);
  }

  function afterTurn() {
    renderHud();
    if (session.over) endGame();
    else renderPrompt();
  }

  function skip() {
    if (mode !== 'play' || !session) return;
    if (session.skip()) renderPrompt();
  }

  function showMe() {
    if (mode !== 'play' || !session || session.rules !== 'learn') return;
    const code = session.showMe();
    if (!code) return;
    map.reveal(code, 'missed');
    showTarget(code, 'info', 2600);
    addLog(code, 'bad', 'shown');
    banner(`Here's <b>${esc(nameOf(code))}</b>. It will come back in a few turns.`);
    afterTurn();
  }

  function giveUp() {
    if (mode !== 'play' || !session) return;
    const left = session.queue.length;
    const what = session.rules === 'learn' ? 'End this session' : 'Give up';
    if (left && !confirm(`${what}? The ${left} ${left === 1 ? 'country' : 'countries'} left will be shown on the map.`)) return;
    session.giveUp();
    session.gaveUp.forEach((c) => map.reveal(c, 'gaveup'));
    if (session.rules === 'learn') {
      for (const c of session.missed.keys()) if (!session.relearned.has(c)) map.reveal(c, 'missed');
    }
    endGame();
  }

  function endGame() {
    stopTimer();
    const s = session;
    setMode('over');
    renderHud();
    const completed = !s.boom && !s.gaveUp.length;
    Store.addGame({
      at: s.startedAt,
      rules: s.rules,
      scope: scopeLabel(s.scope),
      total: s.total,
      found: s.found.size,
      missed: s.missed.size,
      ms: s.elapsed(),
      completed,
    });
    let newBest = false;
    const key = bestKey(s.rules, s.scope);
    if (key && s.rules === 'minefield' && s.found.size > 0) {
      newBest = Store.offerBest(
        key,
        { found: s.found.size, total: s.total, ms: s.elapsed(), at: Date.now() },
        (a, b) => a.found > b.found || (a.found === b.found && a.ms < b.ms)
      );
    }
    if (key && s.rules === 'accuracy' && completed) {
      newBest = Store.offerBest(
        key,
        { acc: s.firstTryAccuracy, total: s.total, ms: s.elapsed(), at: Date.now() },
        (a, b) => a.acc > b.acc || (a.acc === b.acc && a.ms < b.ms)
      );
    }
    setTimeout(() => {
      if (session === s && mode === 'over') showResults(newBest);
    }, s.boom ? 1800 : 700);
  }

  // ---------------------------------------------------------------- results

  function pinButton(code) {
    const on = Store.isPinned(code);
    return `<button class="pin ${on ? 'on' : ''}" data-pin="${code}" aria-pressed="${on}" title="${on ? 'Unpin from' : 'Pin to'} your hot list">📌</button>`;
  }

  function showResults(newBest) {
    const s = session;
    let title;
    let sub;
    if (s.rules === 'minefield') {
      if (s.boom) {
        title = '💥 Boom!';
        sub = `You clicked ${esc(s.boom.clicked)}. ${esc(nameOf(s.boom.code))} is shown in red.`;
      } else if (s.gaveUp.length) {
        title = 'Game over';
        sub = `You stopped with ${s.gaveUp.length} left to find. They're shown in orange.`;
      } else {
        title = '🏆 Minefield cleared!';
        sub = `All ${s.total} without a single wrong click.`;
      }
    } else if (s.rules === 'accuracy') {
      title = s.gaveUp.length ? 'Round over' : 'Round complete';
      sub = s.missed.size ? 'Your misses are shown in red' : 'Not a single miss';
      sub += s.gaveUp.length ? ", and the ones you didn't get to in orange." : '.';
    } else {
      title = s.gaveUp.length ? 'Session over' : 'Session complete';
      sub = `${s.found.size} right on the first try`;
      sub += s.relearned.size ? `, ${s.relearned.size} learned after a miss.` : '.';
    }

    const time = [fmtTime(s.elapsed()), 'time'];
    let tiles;
    if (s.rules === 'minefield') {
      const b = Store.best(bestKey(s.rules, s.scope) || '');
      tiles = [[`${s.found.size}/${s.total}`, 'found'], time, [b ? `${b.found}` : '–', 'best']];
    } else if (s.rules === 'accuracy') {
      tiles = [[`${s.found.size}/${s.total}`, 'found'], [pct(s.firstTryAccuracy), 'accuracy'], time];
    } else {
      tiles = [[`${s.found.size}/${s.total}`, 'first try'], [s.relearned.size, 'learned'], time];
    }

    let bestLine = '';
    const key = bestKey(s.rules, s.scope);
    if (newBest) bestLine = '<div class="res-best new">🎉 New personal best!</div>';
    else if (key && s.rules === 'accuracy') {
      const b = Store.best(key);
      bestLine = b
        ? `<div class="res-best">Personal best: ${pct(b.acc)} in ${fmtTime(b.ms)}</div>`
        : '<div class="res-best">Finish a full round to set a best score.</div>';
    }

    // Everything worth reviewing: misses first, then the ones never found.
    const items = [];
    for (const [code, clicked] of s.missed) {
      if (s.rules === 'learn') {
        const ok = s.relearned.has(code);
        items.push({ code, mark: ok ? '✓' : '✗', cls: ok ? 'good' : '', why: ok ? 'learned after a miss' : 'still to learn' });
      } else {
        items.push({ code, mark: '✗', cls: '', why: clicked ? 'you clicked ' + clicked : 'shown' });
      }
    }
    for (const code of s.gaveUp) items.push({ code, mark: '–', cls: 'gave', why: 'not found' });
    const review = items.map((i) => i.code);

    const list = items.length
      ? `<div class="res-list-head">To review (${items.length}) · 📌 pins one to your hot list</div><ul class="res-list">${items
          .map(
            (i) =>
              `<li><span class="mk ${i.cls}">${i.mark}</span><span class="nm">${esc(nameOf(i.code))}</span>` +
              `<span class="why">${esc(i.why)}</span><button class="link" data-locate="${i.code}">Show</button>${pinButton(i.code)}</li>`
          )
          .join('')}</ul>`
      : '';

    $('#resultsCard').innerHTML =
      `<div class="res-title">${title}</div><div class="res-sub">${sub}</div>` +
      `<div class="res-stats">${tiles.map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('')}</div>` +
      bestLine +
      list +
      '<div class="res-actions">' +
      (review.length
        ? `<button class="btn primary" data-act="learn-review">Practice ${review.length === 1 ? 'it' : `these ${review.length}`} in Learn mode</button>`
        : '') +
      `<button class="btn ${review.length ? '' : 'primary'}" data-act="again">Play again</button>` +
      '<button class="btn" data-act="menu">Menu</button>' +
      '<button class="btn ghost" data-act="map">View map</button>' +
      '</div>';
    $('#resultsCard').dataset.review = review.join(',');
    hideBanner();
    showOverlay('results');
    document.body.classList.remove('results-hidden');
  }

  function viewMap() {
    showOverlay(null);
    document.body.classList.add('results-hidden');
  }

  $('#resultsCard').addEventListener('click', (e) => {
    const loc = e.target.closest('[data-locate]');
    if (loc) {
      viewMap();
      locate(loc.dataset.locate);
      return;
    }
    const act = e.target.closest('[data-act]');
    if (!act || !session) return;
    const a = act.dataset.act;
    if (a === 'again') startGame(session.scope, session.rules);
    else if (a === 'menu') openMenu();
    else if (a === 'map') viewMap();
    else if (a === 'learn-review') {
      const codes = $('#resultsCard').dataset.review.split(',').filter(Boolean);
      startGame({ kind: 'list', codes, label: 'Review' }, 'learn');
    }
  });
  $('#btnShowResults').addEventListener('click', () => {
    showOverlay('results');
    document.body.classList.remove('results-hidden');
  });

  // ---------------------------------------------------------------- feedback bits

  let logCount = 0;
  function clearLog() {
    logCount = 0;
    $('#log').innerHTML = '';
    $('#logCount').textContent = '';
    $('#logPanel').classList.remove('has-items');
  }
  function addLog(code, cls, why) {
    const li = document.createElement('li');
    li.className = cls;
    li.dataset.code = code;
    li.innerHTML =
      `<span class="mk">${cls === 'good' ? '✓' : '✗'}</span><span class="nm">${esc(nameOf(code))}</span>` +
      (why ? `<span class="why">${esc(why)}</span>` : '');
    const list = $('#log');
    list.prepend(li);
    while (list.children.length > 60) list.lastChild.remove();
    $('#logCount').textContent = `(${++logCount})`;
    $('#logPanel').classList.add('has-items');
  }
  $('#log').addEventListener('click', (e) => {
    const li = e.target.closest('li[data-code]');
    if (li) locate(li.dataset.code);
  });
  function setLogCollapsed(collapsed) {
    $('#logPanel').classList.toggle('collapsed', collapsed);
    $('#logToggle').setAttribute('aria-expanded', !collapsed);
  }
  setLogCollapsed(!!Store.pref('logCollapsed', false));
  $('#logToggle').addEventListener('click', () => {
    const collapsed = !$('#logPanel').classList.contains('collapsed');
    setLogCollapsed(collapsed);
    Store.setPref('logCollapsed', collapsed);
  });

  function locate(code) {
    showTarget(code, 'info', 2600);
  }

  function banner(html, cls = '') {
    const el = $('#feedback');
    el.innerHTML = html;
    el.className = 'banner show ' + cls;
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(hideBanner, 4500);
  }
  function hideBanner() {
    $('#feedback').classList.remove('show');
  }

  function shake() {
    document.body.classList.remove('shake');
    void document.body.offsetWidth;
    document.body.classList.add('shake');
    setTimeout(() => document.body.classList.remove('shake'), 500);
  }

  // ---------------------------------------------------------------- study map + identifying

  function startStudy() {
    stopTimer();
    session = null;
    setMode('study');
    hideBanner();
    showOverlay(null);
    map.setHome(null);
    map.goHome();
    $('#hudMode').textContent = 'Study map';
    $('#studyColors').checked = !!Store.pref('studyColors', false);
    applyStudyColors();
  }

  function applyStudyColors() {
    const on = $('#studyColors').checked;
    document.body.classList.toggle('study-colors', on);
    map.clearReveals();
    if (!on) return;
    for (const c of GM.COUNTRIES) {
      const st = Store.status(c.code);
      if (st !== 'new') map.reveal(c.code, 'st-' + st);
    }
  }
  $('#studyColors').addEventListener('change', () => {
    Store.setPref('studyColors', $('#studyColors').checked);
    applyStudyColors();
  });

  $('#countryNames').innerHTML = GM.COUNTRIES.flatMap((c) => [c.name, c.aka].filter(Boolean))
    .sort((a, b) => a.localeCompare(b))
    .map((n) => `<option value="${esc(n)}"></option>`)
    .join('');

  function findCountry() {
    const q = $('#studySearch').value.trim().toLowerCase();
    if (!q) return;
    const c =
      GM.COUNTRIES.find((x) => x.name.toLowerCase() === q || x.aka.toLowerCase() === q) ||
      GM.COUNTRIES.find((x) => x.name.toLowerCase().startsWith(q)) ||
      GM.COUNTRIES.find((x) => x.name.toLowerCase().includes(q) || x.aka.toLowerCase().includes(q));
    if (!c) return;
    const r = map.byCode.get(c.code);
    hideTip();
    map.setHover(c.code, 'search');
    map.focus(c.code, { context: 140 });
    setTimeout(() => {
      map.pulse(c.code, 'info', 2600);
      showTip(map.toScreen(r.main.cx, r.main.cy), r);
    }, 800);
  }
  $('#studySearch').addEventListener('change', findCountry);
  $('#studySearch').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') findCountry();
  });

  map.onHover = (p, screen) => {
    if (mode !== 'study' && mode !== 'over') return;
    const r = p && map.pick(p);
    if (!r) {
      map.setHover(null);
      hideTip();
      return;
    }
    map.setHover(r.code);
    showTip(screen, r);
  };

  function identifyAt(p, screen) {
    const r = map.pick(p);
    if (!r) {
      map.setHover(null);
      hideTip();
      return;
    }
    map.setHover(r.code);
    showTip(screen, r);
  }

  function showTip([x, y], r) {
    const tip = $('#tip');
    let sub;
    if (r.country) {
      const rec = Store.rec(r.code);
      sub = CONTINENT.get(r.country.cont).name + ' · ' + (rec ? `${rec.ok} of ${rec.n} right` : 'not played yet');
      if (Store.isHot(r.code)) sub += ' · 🔥 hot list';
    } else {
      sub = 'Not one of the 197 countries';
    }
    tip.innerHTML = `<b>${esc(r.label)}</b><small>${esc(sub)}</small>`;
    tip.classList.add('show');
    const { width } = $('#map').getBoundingClientRect();
    const half = tip.offsetWidth / 2 + 8;
    tip.style.left = Math.max(half, Math.min(width - half, x)) + 'px';
    tip.style.top = Math.max(tip.offsetHeight + 20, y) + 'px';
  }
  function hideTip() {
    $('#tip').classList.remove('show');
  }

  // ---------------------------------------------------------------- progress screen

  function openStats() {
    statsReturn = !$('#menu').hidden ? 'menu' : !$('#results').hidden ? 'results' : null;
    renderStats();
    showOverlay('stats');
  }
  function closeStats() {
    showOverlay(statsReturn);
    if (statsReturn === 'menu') renderMenu();
  }
  $('#btnCloseStats').addEventListener('click', closeStats);
  $('#stats').addEventListener('click', (e) => {
    if (e.target.id === 'stats') closeStats();
  });

  function renderStats() {
    const status = new Map(ALL_CODES.map((c) => [c, Store.status(c)]));
    const count = (st, codes = ALL_CODES) => codes.filter((c) => status.get(c) === st).length;
    const hot = Store.hotList();
    const games = Store.games().length;

    const tiles = [
      [`${count('mastered')}/${ALL_CODES.length}`, `mastered (right ${Store.MASTERED_STREAK} games in a row)`],
      [hot.length, 'on your hot list'],
      [count('learning'), 'still learning'],
      [games, games === 1 ? 'game played' : 'games played'],
    ];

    const contRows = GM.CONTINENTS.map((ct) => {
      const codes = ALL_CODES.filter((c) => COUNTRY.get(c).cont === ct.id);
      const seg = ['mastered', 'learning', 'hot']
        .map((st) => `<i class="st-${st}" style="width:${(count(st, codes) / codes.length) * 100}%" title="${count(st, codes)} ${STATUS_LABEL[st].toLowerCase()}"></i>`)
        .join('');
      const hotN = count('hot', codes);
      return (
        `<div class="cont-row"><span class="nm">${ct.name}</span><div class="stack">${seg}</div>` +
        `<span class="ct">${count('mastered', codes)}/${codes.length} mastered${hotN ? ` · ${hotN} hot` : ''}</span></div>`
      );
    }).join('');

    const hotHtml = hot.length
      ? `<div class="hot-chips">${hot.map((c) => `<span class="hot-chip">${esc(c.name)}${pinButton(c.code)}</span>`).join('')}</div>`
      : `<div class="empty">Nothing here yet. Any country you miss lands on the hot list, and it drops off once you get it right in ${Store.MASTERED_STREAK} games in a row. You can also pin any country with 📌.</div>`;

    const opt = (value, label, current) => `<option value="${value}" ${value === current ? 'selected' : ''}>${label}</option>`;
    $('#statsBody').innerHTML =
      `<div class="tiles">${tiles.map(([v, l]) => `<div class="tile"><b>${v}</b><span>${l}</span></div>`).join('')}</div>` +
      `<div class="stats-h"><h3>By continent</h3><div class="legend-inline">` +
      `<span class="badge mastered">Mastered</span> <span class="badge learning">Learning</span> <span class="badge hot">Hot</span></div></div>` +
      `<div class="cont-rows">${contRows}</div>` +
      `<div class="stats-h"><h3>🔥 Hot list (${hot.length})</h3>` +
      (hot.length ? '<button class="btn primary" data-act="practice-hot">Practice the hot list</button>' : '') +
      `</div>${hotHtml}` +
      '<div class="stats-h"><h3>All countries</h3><div class="filters">' +
      `<input type="search" id="fQ" placeholder="Search" value="${esc(statsFilter.q)}" />` +
      `<select id="fCont">${opt('', 'All continents', statsFilter.cont)}${GM.CONTINENTS.map((c) => opt(c.id, c.name, statsFilter.cont)).join('')}</select>` +
      `<select id="fStatus">${opt('', 'Any status', statsFilter.status)}${Object.entries(STATUS_LABEL).map(([k, l]) => opt(k, l, statsFilter.status)).join('')}</select>` +
      '</div></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Country</th><th class="hide-sm">Continent</th><th class="num">Played</th>' +
      '<th class="num">Right</th><th class="num hide-sm">Streak</th><th>Status</th><th></th></tr></thead><tbody id="statsRows"></tbody></table></div>';
    renderStatsRows();
  }

  function renderStatsRows() {
    const order = { hot: 0, learning: 1, mastered: 2, new: 3 };
    const q = statsFilter.q.trim().toLowerCase();
    const rows = GM.COUNTRIES.filter(
      (c) =>
        (!statsFilter.cont || c.cont === statsFilter.cont) &&
        (!statsFilter.status || Store.status(c.code) === statsFilter.status) &&
        (!q || c.name.toLowerCase().includes(q) || c.aka.toLowerCase().includes(q))
    )
      .map((c) => ({ c, st: Store.status(c.code), r: Store.rec(c.code) }))
      .sort((a, b) => order[a.st] - order[b.st] || Store.heat(b.c.code) - Store.heat(a.c.code) || a.c.name.localeCompare(b.c.name));
    $('#statsRows').innerHTML =
      rows
        .map(
          ({ c, st, r }) =>
            `<tr><td>${esc(c.name)}</td><td class="hide-sm">${CONTINENT.get(c.cont).name}</td>` +
            `<td class="num">${r ? r.n : 0}</td><td class="num">${r ? pct(r.ok / r.n) : '–'}</td>` +
            `<td class="num hide-sm">${r ? r.streak : 0}</td><td><span class="badge ${st}">${STATUS_LABEL[st]}</span></td>` +
            `<td>${pinButton(c.code)}</td></tr>`
        )
        .join('') || '<tr><td colspan="7">No countries match.</td></tr>';
  }

  $('#statsBody').addEventListener('input', (e) => {
    if (e.target.id === 'fQ') {
      statsFilter.q = e.target.value;
      renderStatsRows();
    }
  });
  $('#statsBody').addEventListener('change', (e) => {
    if (e.target.id === 'fCont') statsFilter.cont = e.target.value;
    else if (e.target.id === 'fStatus') statsFilter.status = e.target.value;
    else return;
    renderStatsRows();
  });
  $('#statsBody').addEventListener('click', (e) => {
    if (e.target.closest('[data-act="practice-hot"]')) startGame({ kind: 'hot' }, 'learn');
  });

  // Pin buttons live in the results list, the hot list and the country table.
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pin]');
    if (!b) return;
    const code = b.dataset.pin;
    Store.setPinned(code, !Store.isPinned(code));
    if (!$('#stats').hidden) renderStats();
    document.querySelectorAll(`[data-pin="${code}"]`).forEach((el) => {
      const on = Store.isPinned(code);
      el.classList.toggle('on', on);
      el.setAttribute('aria-pressed', on);
      el.title = `${on ? 'Unpin from' : 'Pin to'} your hot list`;
    });
  });

  $('#btnExport').addEventListener('click', () => {
    const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `global-minefield-progress-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $('#btnImport').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    file.text().then((text) => {
      try {
        Store.importJSON(text);
        renderStats();
        alert('Progress imported.');
      } catch (err) {
        alert(err.message || 'Could not read that file.');
      }
    });
  });
  $('#btnReset').addEventListener('click', () => {
    if (!confirm('Erase all your stats, pins, best scores and hot list? This cannot be undone.')) return;
    Store.reset();
    renderStats();
  });

  // ---------------------------------------------------------------- controls

  $('#btnSkip').addEventListener('click', skip);
  $('#btnShowMe').addEventListener('click', showMe);
  $('#btnGiveUp').addEventListener('click', giveUp);
  $('#btnMenu').addEventListener('click', openMenu);
  $('#btnDone').addEventListener('click', openMenu);
  $('#zoomIn').addEventListener('click', () => map.zoomBy(1.6));
  $('#zoomOut').addEventListener('click', () => map.zoomBy(1 / 1.6));
  $('#zoomHome').addEventListener('click', () => map.goHome());

  // A mouse-clicked button keeps focus, and Space would then "click" it again.
  document.addEventListener(
    'click',
    (e) => {
      const b = e.target.closest && e.target.closest('button');
      if (b && e.detail > 0) b.blur();
    },
    true
  );

  const isTyping = (e) => !!(e.target.closest && e.target.closest('input, select, textarea'));
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (isTyping(e)) {
      if (e.key === 'Escape') e.target.blur();
      return;
    }
    const k = e.key;
    if (mode === 'play' && (k === ' ' || k === 's' || k === 'S')) {
      e.preventDefault();
      skip();
    } else if (mode === 'play' && (k === 'h' || k === 'H')) {
      showMe();
    } else if (k === '+' || k === '=') {
      map.zoomBy(1.6);
    } else if (k === '-' || k === '_') {
      map.zoomBy(1 / 1.6);
    } else if (k === '0') {
      map.goHome();
    } else if (k === 'Escape') {
      if (!$('#stats').hidden) closeStats();
      else if (mode === 'over' && !$('#results').hidden) viewMap();
      else hideTip();
    } else if (k === 'Enter' && !$('#menu').hidden && !e.target.closest('button')) {
      startGame(scope, rules);
    }
  });
  document.addEventListener('keyup', (e) => {
    if (e.key === ' ' && mode === 'play' && !isTyping(e)) e.preventDefault();
  });

  // ---------------------------------------------------------------- go

  renderMenu();
  showOverlay('menu');

  // Handy for poking at things from the browser console.
  GM.app = {
    map,
    startGame,
    get session() {
      return session;
    },
    get mode() {
      return mode;
    },
  };
})();
