/* Grand Hacienda Palm Beach, site-v2: the sections picked on /variations/ (2026-10-08).
   1. Tour (W6): an auto-playing tour of one estate's day (every house photo, stop by stop) beside its itinerary,
      with a "3 / 7" counter and a progress bar in the active stop and a strip of the stop's photos under the photo. Gentle push-in (transform),
      chapter bars, pause/play, skip, keyboard arrows. It plays only while it is on screen, the tab is visible
      and the visitor has not paused it; under prefers-reduced-motion it never starts by itself. The current
      moment is kept in view inside the itinerary by scrolling the LIST, never the page.
   2. Amenity tiles (A3): each tile opens its full list in a dialog.
   3. Occasion picker (V3): tabs that swap the photo and one line.
   4. Estate switch on the home amenities.
   Photos a stage can swap to come from <script id="sec-photos">. Every stage is a fixed box: two <img> layers
   cross-fade (opacity), so a change never moves the page. Motion: opacity and transform only. */
(function () {
  'use strict';
  var RM = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var PH = {};
  try { PH = JSON.parse(document.getElementById('sec-photos').textContent); } catch (e) { /* stages keep their first photo */ }

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return [].slice.call((r || document).querySelectorAll(s)); }
  function data(root) { try { return JSON.parse($('.sec-data', root).textContent); } catch (e) { return null; } }
  // Content that only becomes visible on a click has nothing to scroll in, so smooth-load's fade is skipped.
  function unhide(el) { $$('.sl-in', el).forEach(function (n) { n.classList.remove('sl-in'); n.classList.add('sl-done'); }); }

  /* ---- photo stage: two layers, cross-fade ---- */
  function Stage(el) {
    var layers = $$('.stg-l', el), cur = 0, token = 0, key = el.getAttribute('data-k');
    // quick: a swipe, a tap or a key (0.3s fade); otherwise the tour's own pace (Emilio, 2026-10-11: "swipe faster")
    function show(k, quick) {
      if (!k || k === key || !PH[k]) return;
      key = k;
      var p = PH[k], next = layers[1 - cur], prev = layers[cur], t = ++token;
      next.classList.remove('is-on', 'is-top');
      next.style.transform = '';
      next.width = p.w; next.height = p.h; next.alt = p.a;
      next.srcset = p.ss; next.src = p.m;
      var done = function () {
        if (t !== token) return;
        el.classList.toggle('is-quick', !!quick);
        next.classList.add('is-top', 'is-on');
        prev.classList.remove('is-top');
        cur = 1 - cur;
        setTimeout(function () { if (t === token) { prev.classList.remove('is-on'); prev.style.transform = ''; } }, quick ? 350 : 650);
      };
      if (next.decode) next.decode().then(done, done); else if (next.complete) done(); else next.onload = next.onerror = done;
    }
    return { show: show, top: function () { return layers[cur]; } };
  }

  /* ---- 1. tour ---- */
  function wireTour(root) {
    var d = data(root);
    if (!d) return null;
    var slides = d.slides, beats = d.beats, st = Stage($('.stg', root));
    var segs = $$('.tour-seg i', root), stops = $$('.tour-stop', root), list = $('.tour-list', root), playBtn = $('.tour-play', root);
    var wEl = $('.tour-when', root), tEl = $('.tour-t', root), cEl = $('.tour-c', root), cap = $('.tour-cap', root), nEl = $('.tour-count', root);
    var strip = $('.tour-thumbs', root), groups = $$('.tour-tg', root), thumbs = $$('.tour-th', root), areaBtns = $$('.tour-area', root), subBtns = $$('.tour-sub', root);
    var bars = stops.map(function (x) { return $('.tour-bar i', x); }), cnts = stops.map(function (x) { return $('.tour-cnt', x); });
    var stg0 = $('.stg-l', root), sizes = stg0 ? stg0.getAttribute('sizes') : '100vw', pre = {};
    var DUR = +root.getAttribute('data-dur') || 5200, i = 0, el = 0, last = 0;
    var userPaused = RM, inView = false, suspended = false, focusIn = false;
    var per = beats.map(function (b, bi) { return slides.filter(function (s) { return s.b === bi; }).length; });
    var startOf = beats.map(function (b, bi) { for (var n = 0; n < slides.length; n++) if (slides[n].b === bi) return n; return 0; });
    function running() { return !userPaused && inView && !suspended && !focusIn && !document.hidden; }
    function sync() {
      var r = running();
      root.setAttribute('data-running', r ? '1' : '0');
      playBtn.setAttribute('aria-pressed', userPaused ? 'true' : 'false');
      playBtn.setAttribute('aria-label', userPaused ? 'Play the tour' : 'Pause the tour');
      cap.setAttribute('aria-live', r ? 'off' : 'polite');
    }
    function paint() {
      var s = slides[i], b = s.b, within = i - startOf[b], frac = Math.min(1, el / DUR);
      segs.forEach(function (g, gi) {
        var v = gi < b ? 1 : gi > b ? 0 : (within + frac) / per[b];
        g.style.transform = 'scaleX(' + v.toFixed(4) + ')';
      });
      // the active stop's own progress: the photos of the stop played so far, plus this one's share
      if (bars[b]) bars[b].style.transform = 'scaleX(' + ((within + frac) / per[b]).toFixed(4) + ')';
      // no slow zoom on the photo (Emilio, 2026-10-11: no Ken Burns): the photo stays still
    }
    // Keep the current moment in view inside the itinerary: scroll the list itself (sideways on phones).
    function keep(stop) {
      if (!list || !stop) return;
      var beh = RM ? 'auto' : 'smooth';
      if (list.scrollWidth > list.clientWidth + 2) {
        // the sideways strip on phones: the current moment sits in the middle
        var l = stop.offsetLeft, w = stop.offsetWidth;
        list.scrollTo({ left: Math.max(0, l - (list.clientWidth - w) / 2), behavior: beh });
      } else if (list.scrollHeight > list.clientHeight + 2) {
        var t = stop.offsetTop, h = stop.offsetHeight;
        if (t < list.scrollTop || t + h > list.scrollTop + list.clientHeight) list.scrollTo({ top: Math.max(0, t - 12), behavior: beh });
      }
    }
    function go(n, quick) {
      i = (n + slides.length) % slides.length; el = 0;
      root.setAttribute('data-i', i);
      var s = slides[i], b = beats[s.b], within = i - startOf[s.b];
      st.show(s.k, quick);
      wEl.textContent = b.w; tEl.textContent = b.t; cEl.textContent = s.c;
      var count = (within + 1) + ' / ' + per[s.b];
      if (nEl) nEl.textContent = count;
      root.setAttribute('data-stop', s.b);
      stops.forEach(function (x, xi) {
        if (xi === s.b) x.setAttribute('aria-current', 'true'); else x.removeAttribute('aria-current');
        if (cnts[xi]) cnts[xi].textContent = xi === s.b ? count : (xi < s.b ? per[xi] : 0) + ' / ' + per[xi];
        if (bars[xi] && xi !== s.b) bars[xi].style.transform = 'scaleX(' + (xi < s.b ? 1 : 0) + ')';
      });
      // phones: the area switch follows the tour
      areaBtns.forEach(function (a) {
        var on = a.getAttribute('data-area') === b.w;
        a.setAttribute('aria-pressed', on ? 'true' : 'false');
        a.parentNode.classList.toggle('is-open', on);   // desktop: its rooms show under it
        // a row of many pills (phones and tablets): keep the current one in view, scrolling the row, never the page
        var row = a.closest('.tour-areas');
        if (on && row.scrollWidth > row.clientWidth + 1) row.scrollTo({ left: Math.max(0, row.scrollLeft + a.getBoundingClientRect().left - row.getBoundingClientRect().left - (row.clientWidth - a.offsetWidth) / 2), behavior: RM ? 'auto' : 'smooth' });
      });
      subBtns.forEach(function (x) { if (+x.getAttribute('data-b') === s.b) x.setAttribute('aria-current', 'true'); else x.removeAttribute('aria-current'); });
      // the strip of this stop's photos: only its group shows; it scrolls itself, never the page
      groups.forEach(function (g) {
        var on = +g.getAttribute('data-b') === s.b;
        g.hidden = !on;
        if (on) $$('img[data-src]', g).forEach(function (im) { im.srcset = im.getAttribute('data-srcset'); im.src = im.getAttribute('data-src'); im.removeAttribute('data-src'); });
      });
      var th = null;
      thumbs.forEach(function (t) { var on = +t.getAttribute('data-i') === i; if (on) { t.setAttribute('aria-current', 'true'); th = t; } else t.removeAttribute('aria-current'); });
      if (strip && th) {
        var left = Math.max(0, th.offsetLeft - (strip.clientWidth - th.offsetWidth) / 2);
        strip.scrollLeft = left;
      }
      // load the next two photos ahead, and only those
      [1, 2].forEach(function (d) {
        var k = slides[(i + d) % slides.length].k, p = PH[k];
        if (!p || pre[k]) return;
        pre[k] = new Image(); pre[k].sizes = sizes; pre[k].srcset = p.ss; pre[k].src = p.m;
      });
      keep(stops[s.b]);
      paint();
    }
    function frame(t) {
      var dt = last ? Math.min(100, t - last) : 0; last = t;
      if (running()) { el += dt; if (el >= DUR) go(i + 1); else paint(); }
      requestAnimationFrame(frame);
    }
    playBtn.addEventListener('click', function () { userPaused = !userPaused; sync(); });
    $$('.tour-btn[data-dir]', root).forEach(function (b) { b.addEventListener('click', function () { go(i + (+b.getAttribute('data-dir')), true); }); });
    stops.forEach(function (x, xi) { x.addEventListener('click', function () { go(startOf[xi], true); }); });
    thumbs.forEach(function (t) { t.addEventListener('click', function () { go(+t.getAttribute('data-i'), true); }); });
    subBtns.forEach(function (x) { x.addEventListener('click', function () { go(startOf[+x.getAttribute('data-b')], true); }); });
    // an area jumps to its first stop
    areaBtns.forEach(function (a) {
      a.addEventListener('click', function () {
        for (var bi = 0; bi < beats.length; bi++) if (beats[bi].w === a.getAttribute('data-area')) { go(startOf[bi], true); return; }
      });
    });
    root.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(i + 1, true); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(i - 1, true); }
    });
    // Swipe the photo left or right to change stop. The stage is touch-action: pan-y, so a vertical drag still
    // scrolls the page (the browser cancels the pointer) and only a clear sideways swipe counts.
    var sx = null, sy = 0, sid = null;
    var stg = $('.stg', root);
    stg.addEventListener('pointerdown', function (e) {
      if (e.button > 0 || e.target.closest('button')) return;
      sx = e.clientX; sy = e.clientY; sid = e.pointerId;
    });
    function swipeEnd(e) {
      if (sx === null || e.pointerId !== sid) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      sx = null;
      if (e.type === 'pointerup' && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(i + (dx < 0 ? 1 : -1), true);
    }
    stg.addEventListener('pointerup', swipeEnd);
    stg.addEventListener('pointercancel', swipeEnd);
    stg.addEventListener('dragstart', function (e) { e.preventDefault(); });
    new IntersectionObserver(function (es) { inView = es[es.length - 1].isIntersecting; sync(); }, { threshold: 0.35 }).observe($('.stg', root));
    document.addEventListener('visibilitychange', sync);
    // keyboard focus inside the tour holds it, so the itinerary never scrolls away from a focused stop
    root.addEventListener('focusin', function (e) { if (e.target !== root && e.target.matches(':focus-visible')) { focusIn = true; sync(); } });
    root.addEventListener('focusout', function (e) { if (!root.contains(e.relatedTarget)) { focusIn = false; sync(); } });
    go(0); sync();
    requestAnimationFrame(frame);
    // Hidden by a switch (the /variations/ panel): stop; shown again: carry on unless the visitor paused it.
    return { hide: function () { suspended = true; sync(); }, show: function () { suspended = false; unhide(root); sync(); } };
  }

  /* ---- 2. amenity tiles: dialogs ---- */
  function wireAmt(root) {
    $$('[data-dlg]', root).forEach(function (t) {
      t.addEventListener('click', function () {
        var dl = document.getElementById(t.getAttribute('data-dlg'));
        if (!dl) return;
        if (dl.showModal) dl.showModal(); else dl.setAttribute('open', '');
      });
    });
  }
  /* ---- 2b. full-screen photo viewer: opened from a photo view; swipe, arrow keys, the buttons; Escape or X closes ---- */
  function wireLightbox() {
    var lb = document.getElementById('lb');
    if (!lb) return;
    var im = $('.lb-img', lb), cap = $('.lb-cap', lb), num = $('.lb-n', lb), list = [], i = 0;
    function show(n) {
      i = (n + list.length) % list.length;
      var it = list[i], p = PH[it.k], n = i, total = list.length;
      lb.setAttribute('data-i', i);
      function label() { if (+lb.getAttribute('data-i') !== n) return; cap.textContent = it.c; num.textContent = (n + 1) + ' / ' + total; im.classList.remove('is-loading'); }
      if (p && im.getAttribute('data-k') !== it.k) {
        im.classList.add('is-loading');
        im.setAttribute('data-k', it.k);
        im.srcset = p.ss; im.src = p.m; im.alt = p.a;
        if (im.decode) im.decode().then(label, label); else im.onload = im.onerror = label;
      } else label();
    }
    // Any .pv-open button inside a photo view (.pv) or a photo set on the page ([data-lb-set]) opens the viewer on
    // its photo; the viewer steps through the photos of that set that are showing (a filtered gallery skips the rest).
    document.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.pv-open') : null;
      var view = b && b.closest('.pv, [data-lb-set]');
      if (!view) return;
      if (window.GHFresh && window.GHFresh(b.closest('dialog'))) return;   // the second tap of the tap that opened its window
      var btns = $$('.pv-open', view).filter(function (x) { return !x.closest('[hidden], .is-off'); });
      list = btns.map(function (x) { var f = x.closest('figure').querySelector('figcaption[data-k]'); return { k: f.getAttribute('data-k'), c: f.textContent }; });
      show(Math.max(0, btns.indexOf(b)));
      if (lb.showModal) lb.showModal(); else lb.setAttribute('open', '');
      $('.lb-x', lb).focus({ preventScroll: true });
    });
    // A tap on the dark area around the photo closes the viewer (Emilio, 2026-10-11). Not a tap on the photo itself
    // (measured as drawn: object-fit contain leaves dark bands inside the <img> box), a control, the caption, the end
    // of a swipe, or the second tap of the tap that opened it.
    var px = 0, py = 0;
    lb.addEventListener('pointerdown', function (e) { px = e.clientX; py = e.clientY; }, true);
    lb.addEventListener('click', function (e) {
      if (e.target.closest('button, .lb-cap, .lb-n')) return;
      if (Math.abs(e.clientX - px) > 10 || Math.abs(e.clientY - py) > 10) return;
      if (window.GHFresh && window.GHFresh(lb)) return;
      if (e.target === im && im.naturalWidth) {
        var r = im.getBoundingClientRect(), k = Math.min(r.width / im.naturalWidth, r.height / im.naturalHeight);
        var w = im.naturalWidth * k, h = im.naturalHeight * k, l = r.left + (r.width - w) / 2, t = r.top + (r.height - h) / 2;
        if (e.clientX >= l && e.clientX <= l + w && e.clientY >= t && e.clientY <= t + h) return;
      }
      if (lb.close) lb.close(); else lb.removeAttribute('open');
    });
    $('.lb-prev', lb).addEventListener('click', function () { show(i - 1); });
    $('.lb-next', lb).addEventListener('click', function () { show(i + 1); });
    $('.lb-x', lb).addEventListener('click', function () { if (lb.close) lb.close(); else lb.removeAttribute('open'); });
    lb.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var f = $$('button', lb).filter(function (x) { return x.offsetParent && !x.hidden; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1], a = document.activeElement;
      if (e.shiftKey && (a === first || !lb.contains(a))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (a === last || !lb.contains(a))) { e.preventDefault(); first.focus(); }
    });
    lb.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); show(i + 1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); show(i - 1); }
    });
    var sx = null, sy = 0;
    var stage = $('.lb-stage', lb);
    stage.addEventListener('pointerdown', function (e) { sx = e.clientX; sy = e.clientY; });
    stage.addEventListener('pointerup', function (e) {
      if (sx === null) return;
      var dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) show(i + (dx < 0 ? 1 : -1));
    });
    stage.addEventListener('pointercancel', function () { sx = null; });
  }

  /* ---- 2c. #amenities-<category> opens that category's photo view (on load and when the hash changes) ---- */
  function wireAmenityLinks() {
    var byHash = null;
    function open() {
      var m = /^#amenities-([a-z0-9-]+)$/i.exec(location.hash);
      if (!m) {
        // Back (or any other hash) closes a window that a #amenities-<category> link opened
        if (byHash && byHash.open) { var b = byHash; byHash = null; if (b.close) b.close(); else b.removeAttribute('open'); }
        return;
      }
      var sec = document.getElementById('amenities') || document.getElementById('amenities-both');
      var t = sec && sec.querySelector('[data-cat="' + m[1].toLowerCase() + '"]');
      if (sec) sec.scrollIntoView({ block: 'start' });
      if (!t) return;   // a category this estate does not have: the Amenities section itself
      var d = document.getElementById(t.getAttribute('data-dlg'));
      if (d && !d.open) { d.__byHash = true; if (d.showModal) d.showModal(); else d.setAttribute('open', ''); d.__byHash = false; byHash = d; }
    }
    $$('.amt-dlg').forEach(function (d) {
      d.addEventListener('close', function () {
        if (/^#amenities-/.test(location.hash)) {
          try { history.replaceState(history.state, '', location.pathname + location.search); } catch (e) { /* file:// */ }
        }
        if (byHash === d) byHash = null;
      });
    });
    open();
    window.addEventListener('hashchange', open);
  }

  function wireDialogs() {
    $$('.amt-dlg').forEach(function (dl) {
      var close = function () { if (dl.close) dl.close(); else dl.removeAttribute('open'); };
      $('[data-close]', dl).addEventListener('click', close);
      dl.addEventListener('click', function (e) { if (e.target === dl && !(window.GHFresh && window.GHFresh(dl))) close(); });
    });
  }

  /* ---- 3. occasion picker ---- */
  function wireOcc(root) {
    var tabs = $$('[role="tab"]', root), st = Stage($('.stg', root)), txts = $$('.occ-txt', root), panel = $('[role="tabpanel"]', root);
    function sel(t, focus) {
      tabs.forEach(function (x) { var on = x === t; x.setAttribute('aria-selected', on ? 'true' : 'false'); x.tabIndex = on ? 0 : -1; });
      var n = t.getAttribute('data-i');
      txts.forEach(function (x) { x.classList.toggle('is-on', x.getAttribute('data-i') === n); });
      panel.setAttribute('aria-labelledby', t.id);
      st.show(t.getAttribute('data-k'));
      if (focus) t.focus();
    }
    tabs.forEach(function (t, ti) {
      t.addEventListener('click', function () { sel(t); });
      t.addEventListener('keydown', function (e) {
        var d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (d) { e.preventDefault(); sel(tabs[(ti + d + tabs.length) % tabs.length], true); }
        else if (e.key === 'Home') { e.preventDefault(); sel(tabs[0], true); }
        else if (e.key === 'End') { e.preventDefault(); sel(tabs[tabs.length - 1], true); }
      });
    });
  }

  /* ---- 4. estate switch (home amenities): panes share one grid cell, so the box keeps its size ---- */
  function wireEstPick(root) {
    var btns = $$('[data-est]', root), panes = $$('[data-est-pane]', root);
    function pick(b, focus) {
      btns.forEach(function (x) { var on = x === b; x.setAttribute('aria-checked', on ? 'true' : 'false'); x.tabIndex = on ? 0 : -1; });
      panes.forEach(function (pn) {
        var on = pn.getAttribute('data-est-pane') === b.getAttribute('data-est');
        pn.classList.toggle('is-on', on); pn.setAttribute('aria-hidden', on ? 'false' : 'true');
        if (on) unhide(pn);
      });
      if (focus) b.focus();
    }
    btns.forEach(function (b, bi) {
      b.addEventListener('click', function () { pick(b); });
      b.addEventListener('keydown', function (e) {
        var d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (d) { e.preventDefault(); pick(btns[(bi + d + btns.length) % btns.length], true); }
      });
    });
    pick(btns[0]);
  }

  /* ---- 5. Round 1 picks: the events gallery (filters, and the viewer of the R1-11c option) ---- */
  function showPhoto(viewer, btn) {
    var k = btn.getAttribute('data-k'), c = btn.getAttribute('data-c'), ph = PH[k];
    var fig = $('.evv-fig', viewer), img = $('img', fig), cap = $('figcaption', fig);
    $$('.evv-t', viewer).forEach(function (t) { t.setAttribute('aria-pressed', t === btn ? 'true' : 'false'); });
    if (!ph || cap.getAttribute('data-k') === k) return;
    cap.setAttribute('data-k', k); cap.textContent = c;
    $('.pv-open', fig).setAttribute('aria-label', 'Open photo full screen: ' + c);
    function swap() { img.srcset = ph.ss; img.src = ph.m; img.alt = ph.a; }
    if (RM) { swap(); return; }
    img.classList.add('is-swap');
    setTimeout(function () {
      swap();
      var on = function () { img.classList.remove('is-swap'); };
      if (img.decode) img.decode().then(on, on); else img.onload = on;
    }, 220);
  }
  function wireEvents() {
    $$('[data-evg]').forEach(function (g) {
      var btns = $$('.evf-b', g), its = $$('.evg-i', g), viewer = g.hasAttribute('data-evv') ? g : null;
      btns.forEach(function (b) {
        b.addEventListener('click', function () {
          var f = b.getAttribute('data-f');
          btns.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
          its.forEach(function (it) { it.classList.toggle('is-off', f !== 'all' && it.getAttribute('data-f') !== f); });
          $$('[data-pl]', g).forEach(function (pl) { pl.hidden = pl.getAttribute('data-pl') !== f; });
          if (viewer) { var first = its.filter(function (it) { return !it.classList.contains('is-off'); })[0]; if (first) showPhoto(viewer, $('.evv-t', first)); }
        });
      });
      if (viewer) $$('.evv-t', g).forEach(function (t) { t.addEventListener('click', function () { showPhoto(viewer, t); }); });
    });
  }

  /* ---- 6. long reviews fold behind "Read more"; "Ask about a date" opens on #inquire links ---- */
  function wireMore() {
    $$('.rvw-more').forEach(function (b) {
      b.addEventListener('click', function () {
        var f = b.closest('.rvw'), o = b.getAttribute('aria-expanded') !== 'true';
        // Motion: open/close. The quote's height animates across the clamp, both ways (site.js GHMotion).
        var q = $('.rvw-q', f) || f, M = window.GHMotion;
        var change = function () { f.classList.toggle('is-open', o); };
        change.undo = function () { f.classList.toggle('is-open', !o); };
        if (M) M.morph(q, change, o, b); else change();
        b.setAttribute('aria-expanded', o ? 'true' : 'false');
        b.textContent = o ? 'Read less' : 'Read more';
      });
    });
    // A quote that already fits in its 6 lines gets no "Read more" (it would do nothing). Re-checked once the
    // fonts are in and on resize, because the clamp depends on the column width.
    function fit() {
      $$('.rvw-more').forEach(function (b) {
        if (b.getAttribute('aria-expanded') === 'true') return;
        var p = $('.rvw-q p', b.closest('.rvw'));
        if (p && p.clientHeight) b.hidden = p.scrollHeight <= p.clientHeight + 1;   // not laid out yet (inside a closed fold): later
      });
    }
    fit();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    var ft;
    window.addEventListener('resize', function () { clearTimeout(ft); ft = setTimeout(fit, 150); });
    document.addEventListener('toggle', function (e) { if (e.target.open) requestAnimationFrame(fit); }, true);   // More reviews
  }
  function wireAsk() {
    var d = document.getElementById('inquire-wrap');
    if (!d || d.tagName !== 'DETAILS') return;
    function openTo(h, instant) {
      if (h !== '#inquire' && h !== '#inquire-wrap') return false;
      d.open = true;
      // its fold (site.js, Motion: open/close) opens at once here, so the scroll lands on the full form
      var dz = d.querySelector(':scope > .dz');
      if (dz && window.GHMotion && !dz.classList.contains('is-open')) { d.classList.add('is-open'); window.GHMotion.fold(dz, true, true); }
      var t = document.getElementById(h.slice(1));
      if (t) t.scrollIntoView({ block: 'start', behavior: (RM || instant) ? 'instant' : 'smooth' });
      return true;
    }
    document.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a[href="#inquire"], a[href="#inquire-wrap"]') : null;
      if (a && openTo(a.getAttribute('href'))) e.preventDefault();
    });
    openTo(location.hash, true);   // a #inquire deep link lands at once, never a smooth trip down the page (QA 2026-10-11)
    window.addEventListener('hashchange', function () { openTo(location.hash); });
  }

  function init() {
    if (!('IntersectionObserver' in window)) return;
    $$('[data-tour]').forEach(function (r) { try { var api = wireTour(r); if (api) { r.__var = api; r.__tour = api; } } catch (e) { if (window.console) console.error(e); } });
    $$('[data-amt]').forEach(function (r) { try { wireAmt(r); } catch (e) { if (window.console) console.error(e); } });
    $$('[data-occ]').forEach(function (r) { try { wireOcc(r); } catch (e) { if (window.console) console.error(e); } });
    $$('[data-est-pick]').forEach(function (r) { try { wireEstPick(r); } catch (e) { if (window.console) console.error(e); } });
    try { wireDialogs(); } catch (e) { if (window.console) console.error(e); }
    try { wireLightbox(); } catch (e) { if (window.console) console.error(e); }
    try { wireAmenityLinks(); } catch (e) { if (window.console) console.error(e); }
    [wireEvents, wireMore, wireAsk].forEach(function (fn) { try { fn(); } catch (e) { if (window.console) console.error(e); } });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
