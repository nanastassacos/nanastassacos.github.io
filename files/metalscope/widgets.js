(function () {
  'use strict';
  var esc = function (s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  };
  var el = function (tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };
  var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function logo(canvas, d) {
    canvas.width = d.w;
    canvas.height = d.h;
    var ctx = canvas.getContext('2d'), i = 0, timer = null;
    function draw(k) {
      var rows = d.frames[d.order[k]];
      ctx.clearRect(0, 0, d.w, d.h);
      for (var p = 0; p < rows.length; p++) {
        var c = d.pal[rows[p]];
        if (!c) continue;
        ctx.fillStyle = 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
        ctx.fillRect(p % d.w, (p / d.w) | 0, 1, 1);
      }
    }
    draw(still ? Math.floor(d.order.length * 0.55) : 0);
    if (still) return;
    function run(on) {
      if (on && !timer) timer = setInterval(function () { i = (i + 1) % d.order.length; draw(i); }, d.ms);
      if (!on && timer) { clearInterval(timer); timer = null; }
    }
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { run(es[0].isIntersecting); }).observe(canvas);
    else run(true);
  }

  function prose(text) {
    return esc(text.trim())
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?;:]|$)/g, '$1<em>$2</em>')
      .replace(/^#{1,6}\s+(.*)$/gm, '<strong>$1</strong>')
      .replace(/^\s*[-*]\s+/gm, '• ')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\n/g, '<br>');
  }

  var conf = function (p) { return p == null || p < 0.5 ? 'c-bad' : p < 0.9 ? 'c-mid' : 'c-good'; };
  var quote = function (s) { return '"' + esc(s.replace(/\n/g, '\\n')) + '"'; };
  var pct = function (x) { return x < 0 ? '·' : x < 0.5 ? '<0.5%' : (x < 10 ? x.toFixed(1) : Math.round(x)) + '%'; };
  function dock(root, model) {
    var d = el('div', 'dk'), top = el('div', 'dk-top', '<b>◆ metalscope</b><span class="dk-status"></span><span class="dk-right">' + esc(model) + '</span>');
    d.appendChild(top);
    root.appendChild(d);
    return { box: d, status: top.querySelector('.dk-status'), add: function (e) { d.appendChild(e); return e; } };
  }
  function button(cls, html, on, pick) {
    var b = el('button', cls + (on ? ' on' : ''), html);
    b.type = 'button';
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.addEventListener('click', pick);
    return b;
  }
  function tokens(p, toks, cls, at, out) {
    var spans = toks.map(function (t, i) {
      var s = el('span', cls(t, i), esc(t.t));
      s.addEventListener('pointerenter', function () { at(i); });
      s.addEventListener('click', function () { at(i); });
      p.appendChild(s);
      return s;
    });
    p.addEventListener('pointerleave', out);
    return spans;
  }

  function steer(root, d) {
    var state = { c: 0, dose: null, arc: d.arcs[0], turn: 2 };
    var k = dock(root, d.model + ' · ds4'), page = k.add(el('div', 'st-page')), list = el('div', 'st-list'), info = el('div', 'st-info');
    page.appendChild(list);
    page.appendChild(info);
    k.add(el('hr', 'dk-rule'));
    var ex = k.add(el('div', 'st-ex')), user = k.add(el('p', 'st-user')), pair = k.add(el('div', 'st-pair'));
    k.add(el('p', 'dk-hint', '<span>pick a concept, a dose, a chat</span><span>‹ › the turn before, the next</span>'));
    var key = function (x) { return String(+x); };
    function side(head, marks, good, r, steered) {
      var s = el('div', 'st-side' + (steered ? ' steered' : ''));
      s.appendChild(el('p', 'st-head', esc(head) + '<span' + (good ? ' class="good"' : '') + '>' + esc(marks) + '</span>'));
      s.appendChild(el('div', 'st-body', r && r.text ? prose(r.text) : 'no reply kept'));
      return s;
    }
    function marks(r, steered) {
      if (!r) return '';
      var m = [r.style == null ? '' : 'style ' + r.style, r.sense == null ? '' : 'sense ' + r.sense].filter(Boolean);
      if (steered) m.unshift(r.good ? '✓ good' : r.why && r.why.length ? r.why.join(', ') : 'not good');
      return m.join(' · ');
    }
    function draw() {
      var c = d.concepts[state.c];
      if (state.dose === null || !c.doses.some(function (x) { return key(x.dose) === state.dose; })) state.dose = key(c.default);
      var at = function (dose) { return c.doses.filter(function (x) { return key(x.dose) === key(dose); })[0]; };
      k.status.textContent = state.dose === '0' ? 'no steering' : c.name + ' @' + state.dose;
      list.innerHTML = '<p class="dk-h">STEER <span>by the chat test</span></p>';
      d.concepts.forEach(function (x, i) {
        var best = x.doses.filter(function (y) { return key(y.dose) === key(x.default); })[0];
        list.appendChild(button('st-c', '<span>' + esc(x.name) + '</span><span>' + best.good + '/' + x.turns_per_dose + '</span><span>@' + x.default + '</span>',
          i === state.c, function () { state.c = i; state.dose = null; draw(); }));
      });
      info.innerHTML = '<p><b>' + esc(c.title) + '</b><span class="dk-dim"> · pushes at L' + c.layer + '</span></p><p class="st-about">' + esc(c.about) + '</p>';
      var doses = el('div', 'st-doses');
      doses.style.setProperty('--n', c.doses.length);
      doses.appendChild(el('span', 'lab', 'dose'));
      c.doses.forEach(function (x) {
        var b = button('st-d', x.dose ? String(x.dose) : '0', key(x.dose) === state.dose, function () { state.dose = key(x.dose); draw(); });
        b.setAttribute('aria-label', (x.dose ? 'dose ' + x.dose : 'no steering') + ': ' + x.good + ' good replies of ' + c.turns_per_dose);
        doses.appendChild(b);
      });
      doses.appendChild(el('span', 'lab', 'good'));
      c.doses.forEach(function (x) {
        doses.appendChild(el('span', 'st-bar', '<i style="height:' + Math.round(100 * x.good / c.turns_per_dose) + '%"></i>'));
      });
      info.appendChild(doses);
      var now = at(state.dose), picked = key(c.default) === state.dose;
      info.appendChild(el('p', picked ? 'st-pick' : 'dk-dim', '<b>dose ' + state.dose + '</b> · ' + now.good + '/' + c.turns_per_dose + ' good' + (picked ? ' · the dose the chat test picked' : '')));
      var turns = c.arcs[state.arc], n = turns.length, t = turns[state.turn];
      ex.innerHTML = '<p class="dk-h">EXAMPLES</p>';
      d.arcs.forEach(function (a) { ex.appendChild(button('st-arc', esc(a), a === state.arc, function () { state.arc = a; draw(); })); });
      ex.appendChild(el('span', 'dk-dim', 'turn ' + (state.turn + 1) + ' of ' + n));
      var step = function (label, by) {
        var b = button('st-nav', label, false, function () { state.turn += by; draw(); });
        b.disabled = state.turn + by < 0 || state.turn + by >= n;
        b.removeAttribute('aria-pressed');
        return b;
      };
      ex.appendChild(step('‹ back', -1));
      ex.appendChild(step('next ›', 1));
      user.innerHTML = '<span>turn ' + (state.turn + 1) + '</span>' + esc(t.user || '');
      var plain = state.dose === '0';
      pair.className = 'st-pair' + (plain ? ' one' : '');
      pair.innerHTML = '';
      pair.appendChild(side('no steering', marks(t.by['0'], false), false, t.by['0'], false));
      if (!plain) pair.appendChild(side('steered at ' + state.dose, marks(t.by[state.dose], true), (t.by[state.dose] || {}).good, t.by[state.dose], true));
    }
    draw();
  }

  function maps(root, d) {
    var NS = 'http://www.w3.org/2000/svg';
    d.replies.forEach(function (r) {
      var COLS = Math.max(35, Math.ceil(Math.sqrt(1.8 * r.n)));
      var k = dock(root, d.model), rows = Math.ceil(r.n / COLS), unsure = r.p.filter(function (p) { return p < 0.5; }).length, home = 0;
      r.p.forEach(function (p, i) { if (p < 0.5 && (r.p[home] >= 0.5 || p > r.p[home])) home = i; });
      k.add(el('p', 'mp-ask', '<span class="dk-dim">› </span>' + esc(r.prompt)));
      k.add(el('p', 'dk-h', 'REPLY'));
      var text = k.add(el('p', 'dk-text mp-text'));
      k.add(el('hr', 'dk-rule'));
      var board = k.add(el('div', 'mp-board')), left = board.appendChild(el('div', 'mp-map')), toks = board.appendChild(el('div', 'mp-toks'));
      left.appendChild(el('p', 'dk-h', 'MAP <span>' + r.n + ' tok · ' + unsure + ' unsure · ' + Math.round(100 * r.green) + '% green · ' + Math.round(100 * r.red) + '% red</span>'));
      var svg = left.appendChild(document.createElementNS(NS, 'svg')), rect = function (cls) {
        var c = svg.appendChild(document.createElementNS(NS, 'rect'));
        c.setAttribute('width', 1.02);
        c.setAttribute('height', 1.02);
        c.setAttribute('class', cls);
        return c;
      };
      svg.setAttribute('viewBox', '0 0 ' + COLS + ' ' + rows);
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', 'The reply one cell per token: ' + Math.round(100 * r.green) + '% green, ' + Math.round(100 * r.red) + '% red');
      svg.style.aspectRatio = COLS + ' / ' + rows;
      r.p.forEach(function (p, i) {
        var c = rect(conf(p));
        c.setAttribute('x', i % COLS);
        c.setAttribute('y', Math.floor(i / COLS));
      });
      var cur = rect('mp-cur');
      k.add(el('p', 'dk-hint', '<span>point at or tap a cell or a word</span><span>REPLY scrolls</span><span>TOKENS: the token\'s top choices, ▸ the one written</span>'));
      var at = home, spans = tokens(text, r.t.map(function (t) { return { t: t }; }), function (t, i) { return conf(r.p[i]); },
        function (i) { focus(i); }, function () {});
      function focus(i, show) {
        k.status.textContent = 'paused at #' + i;
        cur.setAttribute('x', i % COLS);
        cur.setAttribute('y', Math.floor(i / COLS));
        spans[at].classList.remove('cur');
        spans[at = i].classList.add('cur');
        if (show) { var lh = parseFloat(getComputedStyle(text).lineHeight) || 20; text.scrollTop = spans[i].offsetTop - Math.floor(text.clientHeight / lh / 2) * lh; }
        var all = [[r.t[i], r.p[i], true]].concat(r.a[i].map(function (x) { return [x[0], x[1], false]; }))
          .sort(function (x, y) { return y[1] - x[1]; }).slice(0, 10);
        toks.innerHTML = '<span class="hd">TOKENS <span class="dk-dim">#' + i + ' ' + quote(r.t[i]) + ' · ' + pct(100 * r.p[i]) + '</span></span>';
        all.forEach(function (c) {
          toks.appendChild(el('span', 'w' + (c[2] ? ' mine' : ' dk-dim'), quote(c[0])));
          toks.appendChild(el('span', 'bar' + (c[2] ? ' ' + conf(c[1]) : ''), '<i style="width:' + (100 * c[1]) + '%"></i>'));
          toks.appendChild(el('span', 'n' + (c[2] ? ' ' + conf(c[1]) : ' dk-dim'), pct(100 * c[1])));
        });
      }
      var point = function (ev) {
        var box = svg.getBoundingClientRect();
        var i = Math.floor((ev.clientY - box.top) / box.height * rows) * COLS + Math.floor((ev.clientX - box.left) / box.width * COLS);
        if (i >= 0 && i < r.n) focus(i, true);
      };
      svg.addEventListener('pointermove', point);
      svg.addEventListener('pointerdown', point);
      focus(home, true);
    });
  }

  function settle(root, d) {
    var NS = 'http://www.w3.org/2000/svg', ROW = 4.6, N = d.tokens.length;
    var early = d.notes.filter(function (n) { return n.kind === 'early'; })[0];
    var home = early ? early.i : d.notes.length ? d.notes[0].i : N - 1;
    var state = { lens: d.lenses[0].key, col: home, row: -1 };
    var svgEl = function (tag, attrs) {
      var e = document.createElementNS(NS, tag);
      for (var a in attrs) e.setAttribute(a, attrs[a]);
      return e;
    };
    var k = dock(root, d.model);
    k.add(el('p', 'dk-h', 'REPLY <span>green 90%+ · yellow 50-90% · red under 50%</span>'));
    var reply = k.add(el('p', 'dk-text'));
    k.add(el('hr', 'dk-rule'));
    var line = k.add(el('div', 'se-line')), map = k.add(el('div', 'se-map')), read = k.add(el('p', 'dk-read'));
    read.setAttribute('aria-live', 'polite');
    k.add(el('p', 'dk-hint', '<span><i class="l3"></i>settled on the written word</span><span><i class="l2"></i>its top word, lower down</span>' +
      '<span><i class="l1"></i>in a top 10</span><span><i class="fo"></i>the token in focus</span><span>point at or tap a word or a cell</span>'));
    var notes = el('ol', 'se-notes');
    root.appendChild(notes);
    var spans = tokens(reply, d.tokens, function (t) { return conf(t.p); }, function (i) { focus(i, -1); }, function () { focus(home, -1); });
    var word = function (t) { return quote(t.t.trim()); };
    var col, cell, n;
    function lensOf() { return d.lenses.filter(function (l) { return l.key === state.lens; })[0]; }
    function focus(c, row) {
      spans[state.col].classList.remove('cur');
      state.col = c;
      state.row = row;
      spans[c].classList.add('cur');
      k.status.textContent = 'paused at #' + c;
      col.setAttribute('x', c);
      var L = lensOf(), t = d.tokens[c], r = t[state.lens];
      var first = '<span class="dk-dim">#' + c + '</span> ' + word(t) + '<span class="dk-dim"> · ';
      if (!r) { cell.setAttribute('visibility', 'hidden'); read.innerHTML = first + 'not read by this lens</span>'; return; }
      var at = row < 0 ? n - 1 : row, top = d.words[r.w[at]].trim(), lv = r.lv[at];
      cell.setAttribute('visibility', row < 0 ? 'hidden' : 'visible');
      cell.setAttribute('y', n - 1 - at);
      read.innerHTML = first + (r.settle == null ? 'never settles' : 'settles L' + r.settle + '/' + d.n_layers) + '</span><br>' +
        '<span class="dk-dim">L' + L.layers[at] + '</span>  ' + (lv >= '2' ? '<b class="c-good">' + (lv === '3' ? '▸ ' : '') + esc(top) + '</b>  <span class="c-good">' + pct(r.tp[at]) + '</span>'
          : esc(top) + '  ' + pct(r.tp[at]) + '<span class="dk-dim"> · ' + word(t) + (r.wp[at] < 0 ? ' not in its top 10' : ' ' + pct(r.wp[at])) + '</span>');
    }
    function draw() {
      var L = lensOf();
      n = L.layers.length;
      line.innerHTML = '';
      line.appendChild(el('p', 'dk-h', 'SETTLING <span>' + esc(L.label) + '</span>'));
      line.appendChild(el('span', 'dk-dim', 'old → now · ' + n + ' layers'));
      if (d.lenses.length > 1) {
        var sw = button('se-sw', d.lenses.map(function (l) { return '<span' + (l.key === state.lens ? ' class="on"' : '') + '>' + esc(l.label) + '</span>'; })
          .join(state.lens === d.lenses[0].key ? ' <i>◉───○</i> ' : ' <i>○───◉</i> '), false, function () {
            state.lens = d.lenses[(d.lenses.indexOf(L) + 1) % d.lenses.length].key;
            draw();
          });
        sw.setAttribute('aria-label', 'Switch lens: now the ' + L.label);
        sw.removeAttribute('aria-pressed');
        line.appendChild(sw);
      }
      map.innerHTML = '';
      var ys = map.appendChild(el('div', 'se-ys'));
      var svg = svgEl('svg', { viewBox: '0 0 ' + N + ' ' + n, preserveAspectRatio: 'none', role: 'img',
        'aria-label': 'Each token of the reply against the layers the ' + L.label + ' read: where the lens reads the written word' });
      svg.style.height = Math.round(n * ROW) + 'px';
      col = svg.appendChild(svgEl('rect', { 'class': 'se-col', x: 0, y: 0, width: 1, height: n }));
      d.tokens.forEach(function (t, c) {
        var r = t[state.lens];
        if (!r) return;
        for (var j = 0; j < n; j++)
          if (r.lv[j] !== '0') svg.appendChild(svgEl('rect', { x: c, y: n - 1 - j, width: 1.02, height: 1.02, 'class': 'l' + r.lv[j] }));
      });
      cell = svg.appendChild(svgEl('rect', { 'class': 'se-cell', x: 0, y: 0, width: 1, height: 1, visibility: 'hidden' }));
      for (var j = n - 1; j >= 0; j -= 6) {
        var y = ys.appendChild(el('span', '', 'L' + L.layers[j]));
        y.style.top = (100 * (n - 1 - j) / n) + '%';
      }
      map.appendChild(svg);
      notes.innerHTML = '';
      var first = state.lens === d.lenses[0].key;
      if (first && d.stats) notes.appendChild(el('li', 'se-stat', esc(d.stats)));
      var point = function (ev) {
        var box = svg.getBoundingClientRect();
        var c = Math.floor((ev.clientX - box.left) / box.width * N), r = n - 1 - Math.floor((ev.clientY - box.top) / box.height * n);
        if (c >= 0 && c < N && r >= 0 && r < n) focus(c, r);
      };
      svg.addEventListener('pointermove', point);
      svg.addEventListener('pointerdown', point);
      svg.addEventListener('pointerleave', function () { focus(home, -1); });
      focus(state.col, -1);
    }
    draw();
  }

  function engram(root, d) {
    var N = d.tokens.length, state = { at: d.home };
    var k = dock(root, d.model);
    var title = k.add(el('p', 'en-title')), text = k.add(el('p', 'dk-text en-text'));
    k.add(el('hr', 'dk-rule'));
    var toks = k.add(el('div', 'en-toks'));
    k.add(el('p', 'dk-hint', '<span><i class="h1"></i>helped by the engram</span><span>block: what it looked up</span><span>underlined: what that predicted</span>' +
      '<span>' + d.helped + ' of ' + N + ' tokens helped</span><span>point at or tap a word</span>'));
    var spans = tokens(text, d.tokens, function (t) { return 'h' + t.lv; }, focus, function () { focus(d.home); });
    function focus(i) {
      state.at = i;
      var t = d.tokens[i], from = Math.max(0, i - d.ngram);
      spans.forEach(function (s, j) { s.className = 'h' + d.tokens[j].lv + (j === i ? ' pred' : j >= from && j < i ? ' blk' : ''); });
      k.status.textContent = 'paused at #' + i;
      var before = i ? quote(d.tokens.slice(from, i).map(function (x) { return x.t; }).join('')) : 'the prompt';
      title.innerHTML = '<span class="dk-h">ENGRAM INSPECTION</span><span>engram ' + before + ' → ' + quote(t.t) + '</span><span>' +
        (t.lv ? 'without ' + pct(t.off) + ' → with ' + pct(t.on) : 'no change') + '</span>';
      toks.innerHTML = '<span class="hd">TOKENS <span class="dk-dim">#' + i + '</span></span><span class="hd n">without</span><span></span><span class="hd n">with</span><span></span>';
      t.top.forEach(function (c) {
        var mine = c[0] === t.t;
        toks.appendChild(el('span', 'w' + (mine ? ' mine' : ' dk-dim'), quote(c[0])));
        toks.appendChild(el('span', 'n' + (mine ? '' : ' dk-dim'), pct(c[2])));
        toks.appendChild(el('span', 'bar', '<i style="width:' + Math.max(0, c[2]) + '%"></i>'));
        toks.appendChild(el('span', 'n on', pct(c[1])));
        toks.appendChild(el('span', 'bar on', '<i style="width:' + c[1] + '%"></i>'));
      });
    }
    focus(d.home);
  }

  function toc(nav) {
    var links = [].slice.call(nav.querySelectorAll('li > a')), mark = nav.appendChild(el('i', 'ms-toc-mark')), cur = -2;
    var heads = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
    function place() {
      mark.style.opacity = cur < 0 ? 0 : 1;
      if (cur < 0) return;
      mark.style.transform = 'translateY(' + links[cur].parentNode.offsetTop + 'px)';
      mark.style.height = links[cur].offsetHeight + 'px';
    }
    function set() {
      var k = -1, line = window.innerHeight * 0.3;
      heads.forEach(function (h, i) { if (h && h.getBoundingClientRect().top < line) k = i; });
      if (k === cur) return;
      cur = k;
      links.forEach(function (a, i) { a.parentNode.classList.toggle('on', i === k); });
      place();
    }
    window.addEventListener('scroll', set, { passive: true });
    window.addEventListener('resize', function () { cur = -2; set(); });
    set();
  }

  function start() {
    var q = function (id) { return document.getElementById(id); };
    if (document.querySelector('.ms-toc')) toc(document.querySelector('.ms-toc'));
    if (q('ms-logo') && window.MS_IDLE) logo(q('ms-logo'), window.MS_IDLE);
    if (q('ms-steer') && window.MS_CHATS) steer(q('ms-steer'), window.MS_CHATS);
    if (q('ms-maps') && window.MS_MAPS) maps(q('ms-maps'), window.MS_MAPS);
    if (q('ms-settle') && window.MS_SETTLE) settle(q('ms-settle'), window.MS_SETTLE);
    if (q('ms-engram') && window.MS_ENGRAM) engram(q('ms-engram'), window.MS_ENGRAM);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
