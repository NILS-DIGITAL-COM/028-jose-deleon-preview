/* Grand Hacienda Palm Beach, site-v2.
   1. Ad attribution (same as site/): gclid/gbraid/wbraid/utm_* from the URL into localStorage for 90 days,
      copied into the hidden inputs of every form, plus landing_page and form_variant (<body data-variant>).
   2. Enquiry forms: a valid submit posts the lead to the portal's lead-notify, then opens the thank-you page
      (test mode never posts). The CRM embeds can be added beside them later.
   3. Property pages: the amenities list toggle (closed by default), photos dialog. Old ?view=events links
      (the Stay / Events switch was removed in Round 1, 2026-10-10) land on the Events section.
   4. Menu, date rules, phone sticky bar.
   Every storage call is wrapped in try/catch: the page must work with storage blocked. */
(function () {
  'use strict';
  var root = document.documentElement;
  var KEY = 'jd_attr';
  var TTL = 90 * 24 * 60 * 60 * 1000;
  var PARAMS = ['gclid', 'gbraid', 'wbraid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

  function each(list, fn) { for (var i = 0; i < list.length; i++) fn(list[i], i); }
  function jump(y) { try { window.scrollTo({ top: y, behavior: 'instant' }); } catch (e) { window.scrollTo(0, y); } }
  function setUrl(search, hash) {
    try { history.replaceState(null, '', location.pathname + search + (hash || '')); } catch (e) { /* file:// or old browser */ }
  }

  /* ---- 0. Motion: open/close (2026-10-11). Everything that opens closes with motion too, both ways.
     Durations and easings match the "Motion: open/close" block in site.css. Under prefers-reduced-motion
     every change is instant. Exposed as window.GHMotion for sections.js.
     - fold(dz, open): a .dz > .dz-in region, grid rows 0fr to 1fr plus a fade and a 10px drop.
     - morph(el, change, opening, toggle): animates el's measured height across a class change (a clamp, a "More").
     - hold(toggle, content, ms): while something above the toggle shrinks, keep the toggle where it is, but only
       when the reader is inside that content (its top is above the screen). Otherwise nothing above moves.
     - dialogs: showModal() and close() are wrapped per dialog, so every caller (X, backdrop, Escape, swipe,
       Back) animates in and out; the native close() runs after the motion, so focus return and the close
       event happen as before. ---- */
  var MO_IN = 340, MO_OUT = 280;
  var RMQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function still() { return !!RMQ.matches; }
  function hold(toggle, content, ms) {
    if (!toggle || !ms || !window.requestAnimationFrame) return;
    if (content && content.getBoundingClientRect().top >= 0) return;   // all of it is on screen: let it fold up
    var y0 = toggle.getBoundingClientRect().top, end = Date.now() + ms + 80;
    (function f() {
      var d = toggle.getBoundingClientRect().top - y0;
      if (Math.abs(d) > 0.5) jump(window.pageYOffset + d);
      if (Date.now() < end) requestAnimationFrame(f);
    })();
  }
  function wrapFold(host, nodes) {
    var dz = document.createElement('div'), inn = document.createElement('div');
    dz.className = 'dz'; inn.className = 'dz-in';
    dz.appendChild(inn);
    if (nodes[0]) nodes[0].parentNode.insertBefore(dz, nodes[0]); else host.appendChild(dz);
    each(nodes, function (n) { inn.appendChild(n); });
    return dz;
  }
  function fold(dz, open, instant) {
    clearTimeout(dz.__moT);
    if (instant || still()) {
      dz.classList.add('no-mo');
      dz.classList.toggle('is-open', open); dz.classList.toggle('is-done', open);
      void dz.offsetHeight;
      dz.classList.remove('no-mo');
      return 0;
    }
    if (open) {
      dz.classList.remove('is-done');
      void dz.offsetHeight;   // commit the closed state, so the rows transition from 0fr
      dz.classList.add('is-open');
      dz.__moT = setTimeout(function () { dz.classList.add('is-done'); }, MO_IN + 30);
      return MO_IN;
    }
    dz.classList.remove('is-done', 'is-open');
    return MO_OUT;
  }
  function morph(el, change, opening, toggle) {
    // turned round mid-way: start from the height it has right now
    var h0 = el.getBoundingClientRect().height;
    if (el.__moEnd) el.__moEnd();
    if (still() || !el.animate) { change(); return; }
    change();
    var h1 = el.getBoundingClientRect().height;
    if (!opening) change.undo();   // closing: keep the long text until the box has folded to its new height
    if (Math.abs(h1 - h0) < 1) { if (!opening) change(); return; }
    var ms = opening ? MO_IN : MO_OUT, ov = el.style.overflow, done = false;
    el.style.overflow = 'hidden';
    var a = el.animate([{ height: h0 + 'px' }, { height: h1 + 'px' }],
      { duration: ms, easing: opening ? 'cubic-bezier(.22,.8,.24,1)' : 'cubic-bezier(.55,0,.75,.3)', fill: 'forwards' });
    function end() {
      if (done) return;
      done = true; el.__moEnd = null;
      if (!opening) change();
      el.style.overflow = ov;
      a.cancel();
    }
    el.__moEnd = end;
    a.onfinish = end;
    if (!opening) hold(toggle, el, ms);
  }
  function wireDialogMotion() {
    var P = window.HTMLDialogElement && window.HTMLDialogElement.prototype;
    if (!P || !P.showModal) return;
    var nShow = P.showModal, nClose = P.close;
    var stack = [];   // dialogs in the order they opened, so a second Escape mid-close reaches the one underneath
    function lift(d) { var i = stack.indexOf(d); if (i > -1) stack.splice(i, 1); stack.push(d); }
    // Back closes the window on top (audit r2): each window opened by a tap adds a history entry with no URL change.
    // A window a #amenities-<category> link opened has its own entry already (sections.js marks it __byHash).
    var selfBack = 0;
    window.addEventListener('popstate', function () {
      if (selfBack) { selfBack--; return; }   // our own history.back() after a close by X, backdrop, Escape or swipe
      var top = stack.filter(function (x) { return x.open && !x.classList.contains('is-out'); }).pop();
      if (top && top.__pushed) { top.__pushed = false; top.__viaPop = true; top.close(); }
    });
    // a link inside a window navigates on its own: that window's entry is left as it is (never undone by a close)
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href]'), d = a && a.closest('dialog');
      if (d) d.__pushed = false;
    }, true);
    each(document.querySelectorAll('dialog'), function (d) {
      if (d.__mo) return;
      d.__mo = true;
      var t = 0, closing = false;
      function enter() {
        if (still()) { d.classList.add('is-in'); return; }
        d.classList.remove('is-in');
        void d.offsetWidth;
        try { void getComputedStyle(d, '::backdrop').opacity; } catch (x) { /* old engine */ }
        requestAnimationFrame(function () { if (d.open && !closing) d.classList.add('is-in'); });
      }
      function reset() { clearTimeout(t); closing = false; d.classList.remove('is-in', 'is-out'); }
      d.classList.add('mo');
      if (d.open) d.classList.add('is-in');
      d.showModal = function () {
        if (closing) { reset(); d.classList.add('is-in'); return; }   // reopened mid-close: turn round
        if (d.open) return;
        nShow.call(d);
        d.__at = (window.performance ? performance.now() : Date.now());   // double-tap guards (fresh())
        if (!d.__byHash) { try { history.pushState({ dlg: d.id || true }, ''); d.__pushed = true; } catch (x) { /* file:// */ } }
        lift(d);
        enter();
      };
      d.close = function (rv) {
        if (!d.open || closing) return;
        if (d.__pushed && !d.__viaPop) { d.__pushed = false; selfBack++; try { history.back(); } catch (x) { selfBack--; } }
        d.__viaPop = false;
        if (still()) { reset(); nClose.call(d, rv); return; }
        closing = true;
        d.classList.remove('is-in'); d.classList.add('is-out');
        t = setTimeout(function () { reset(); if (d.open) nClose.call(d, rv); }, MO_OUT + 20);
      };
      // Escape: animate instead of the instant native close (cancel is the fallback some engines send instead)
      // A second Escape while this one is still closing goes to the window underneath, as it would without motion.
      function esc() {
        if (!closing) { d.close(); return; }
        var under = stack.filter(function (x) { return x !== d && x.open && !x.classList.contains('is-out'); }).pop();
        if (under) under.close();
      }
      d.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape' || !d.open) return;
        e.preventDefault(); e.stopPropagation();
        esc();
      });
      d.addEventListener('cancel', function (e) { e.preventDefault(); esc(); });
      d.addEventListener('close', reset);   // a close that skipped us (forced by the engine): clean up
      // opened by something that did not call showModal (setAttribute('open')): still fade it in
      new MutationObserver(function () { if (d.open && !closing && !d.classList.contains('is-in')) { lift(d); enter(); } })
        .observe(d, { attributes: true, attributeFilter: ['open'] });
    });
  }
  // Every <details>: the content after <summary> goes in a fold, the summary click is taken over so closing
  // animates before the native state changes; native semantics (open, toggle, find-in-page) stay.
  function wireFolds() {
    each(document.querySelectorAll('details'), function (d) {
      var sum = d.firstElementChild;
      if (d.__fold || !sum || sum.tagName !== 'SUMMARY' || d.closest('[data-no-fold]')) return;
      d.__fold = true;
      var nodes = [], n = sum.nextSibling;
      while (n) { nodes.push(n); n = n.nextSibling; }
      var dz = wrapFold(d, nodes), closing = 0;
      d.classList.add('fold');
      function state(open, instant) { d.classList.toggle('is-open', open); return fold(dz, open, instant); }
      state(d.open, true);
      sum.addEventListener('click', function (e) {
        e.preventDefault();
        if (d.open && !closing) {
          var ms = state(false);
          if (!ms) { d.open = false; return; }
          hold(sum, dz, ms);
          closing = setTimeout(function () { closing = 0; if (!dz.classList.contains('is-open')) d.open = false; }, ms + 20);
        } else {
          if (closing) { clearTimeout(closing); closing = 0; }
          if (!d.open) d.open = true;
          state(true);
        }
      });
      // opened or closed by anything else (a #inquire link, find-in-page): follow at once
      d.addEventListener('toggle', function () {
        if (closing) return;
        if (d.open !== dz.classList.contains('is-open')) state(d.open, true);
      });
    });
  }
  window.GHMotion = { fold: fold, morph: morph, hold: hold, still: still, IN: MO_IN, OUT: MO_OUT };

  /* ---- 1. attribution ---- */
  function readStore() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || typeof o !== 'object' || !o.ts || Date.now() - o.ts > TTL) { window.localStorage.removeItem(KEY); return null; }
      return o;
    } catch (e) { return null; }
  }
  function writeStore(o) { try { window.localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* blocked */ } }
  function attribution() {
    var data = null, fromUrl = {}, any = false;
    try {
      var q = new URLSearchParams(window.location.search);
      PARAMS.forEach(function (k) { var v = q.get(k); if (v) { fromUrl[k] = v.slice(0, 250); any = true; } });
    } catch (e) { /* old browser */ }
    var stored = readStore();
    if (any) {
      data = { ts: Date.now(), landing_page: window.location.pathname + window.location.search };
      PARAMS.forEach(function (k) { if (fromUrl[k]) data[k] = fromUrl[k]; });
      writeStore(data);
    } else if (stored) {
      data = stored;
    } else {
      data = { ts: Date.now(), landing_page: window.location.pathname };
      writeStore(data);
    }
    return data || {};
  }
  function fillHidden(data) {
    var variant = document.body.getAttribute('data-variant') || '';
    var names = PARAMS.concat(['landing_page', 'form_variant']);
    each(document.querySelectorAll('input[type="hidden"][name]'), function (input) {
      var n = input.name, v = '';
      if (names.indexOf(n) === -1) return;
      if (n === 'form_variant') v = variant;
      else if (n === 'landing_page') v = data.landing_page || window.location.pathname;
      else if (data[n]) v = data[n];
      input.value = v;
    });
  }

  /* ---- 2. stand-in forms and date rules ---- */
  function ymd(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function labelOf(f) {
    var l = f.id && document.querySelector('label[for="' + f.id + '"]');
    return l ? l.textContent.replace(/\(optional\)/i, '').trim() : 'this';
  }
  function off(f) { return f.disabled || (f.matches && f.matches(':disabled')); }   // inside a closed topic group
  function message(f) {
    if (off(f)) return '';
    var v = f.validity, lab = labelOf(f).toLowerCase();
    var fm = f.form;
    if (f.name === 'event_date' && fm && !f.value) {
      var fx = fm.querySelector('input[name="date_flexible"]');
      if (fx && fx.checked) return '';
    }
    if (f.name === 'check_out' && f.value && fm) {
      var ci = fm.querySelector('input[name="check_in"]');
      if (ci && ci.value && f.value <= ci.value) return 'Please pick a check-out after check-in.';
    }
    if (v.badInput || v.stepMismatch) return f.type === 'number' ? 'Please enter a whole number.' : 'Please check ' + lab + '.';
    if (v.rangeOverflow) return f.name === 'overnight_guests' ? 'Grand Hacienda sleeps up to ' + f.max + '.' : f.name === 'guests' ? 'Please enter up to ' + f.max + ' guests.' : 'Please check ' + lab + '.';
    if (f.type === 'tel' && f.value && f.value.replace(/\D/g, '').length < 10) return 'Please enter a phone number with the area code.';
    if (f.required && (f.type === 'text' || f.tagName === 'TEXTAREA') && !f.value.trim()) return 'Please fill in ' + lab + '.';
    if (f.type === 'email' && f.value && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.value.trim())) return 'Please enter a valid email, like name@example.com.';
    // WebKit does not enforce min on date fields: check it here
    if (f.type === 'date' && f.value && f.min && f.value < f.min) return f.name === 'check_out' ? 'Please pick a check-out after check-in.' : 'Please pick a date from today on.';
    if (v.valueMissing) {
      if (f.tagName === 'SELECT') return 'Please choose one.';
      if (f.type === 'date') return 'Please pick a date.';
      return 'Please fill in ' + lab + '.';
    }
    if (v.typeMismatch && f.type === 'email') return 'Please enter a valid email, like name@example.com.';
    if (v.rangeUnderflow) {
      if (f.name === 'check_out') return 'Please pick a check-out after check-in.';
      if (f.type === 'date') return 'Please pick a date from today on.';
      return 'Please enter at least ' + f.min + '.';
    }
    return v.valid ? '' : 'Please check ' + lab + '.';
  }
  function showErr(f, msg) {
    var id = (f.id || f.name) + '-err', p = document.getElementById(id);
    if (!msg) {
      f.removeAttribute('aria-invalid');
      if (p) p.parentNode.removeChild(p);
      return;
    }
    if (!p) { p = document.createElement('p'); p.className = 'field-err'; p.id = id; f.parentNode.appendChild(p); }
    p.textContent = msg;
    f.setAttribute('aria-invalid', 'true');
    f.setAttribute('aria-describedby', id);
  }
  function wireForms() {
    each(document.querySelectorAll('form[data-thanks]'), function (form) {
      var fields = form.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"]), select, textarea');
      each(fields, function (f) {
        var check = function () { if (f.getAttribute('aria-invalid') === 'true') showErr(f, message(f)); };
        f.addEventListener('input', check); f.addEventListener('change', check);
        f.addEventListener('blur', function () { if (f.value) showErr(f, message(f)); });
      });
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var first = null;
        each(fields, function (f) { var m = message(f); showErr(f, m); if (m && !first) first = f; });
        if (first) { first.focus({ preventScroll: true }); first.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
        sendLead(form);
      });
      var retry = form.querySelector('.form-retry');
      if (retry) retry.addEventListener('click', function () { sendLead(form); });
    });
  }

  /* ---- 2b. leads: every enquiry form posts to the portal's lead-notify (contract:
     001-nils-client-portal/supabase/functions/lead-notify/index.ts). The thank-you page shows only after the lead
     was accepted ({ok: true}); a network error or a refusal shows an inline note with Try again, and the form keeps
     everything typed, so a lead is never lost silently.
     TEST MODE never posts: ?test=1 (kept for the browser tab), and by default on localhost and the preview hosts
     (data-test-hosts). ?test=0 turns it off there. In test mode the payload goes to the console and
     window.__lastLead, and the thank-you page opens as usual. */
  var TEST_KEY = 'ghp_lead_test';
  function testMode(form) {
    var q = null;
    try { q = new URLSearchParams(window.location.search).get('test'); } catch (e) { /* old browser */ }
    try {
      if (q === '1') sessionStorage.setItem(TEST_KEY, '1');
      else if (q === '0') sessionStorage.setItem(TEST_KEY, '0');
      var st = sessionStorage.getItem(TEST_KEY);
      if (st === '1') return true;
      if (st === '0') return false;
    } catch (e) { if (q) return q === '1'; }
    var h = window.location.hostname, hosts = (form.getAttribute('data-test-hosts') || '').split(/\s+/);
    return h === 'localhost' || h === '127.0.0.1' || hosts.indexOf(h) > -1;
  }
  function optionText(f) { var o = f.options[f.selectedIndex]; return o && o.value ? o.textContent.replace(/\s*\(.*\)\s*$/, '').trim() : ''; }
  // The lead, in the order the client's alert lists it: who, then what they asked about, then attribution.
  var ORDER = ['first_name', 'last_name', 'email', 'phone', 'future_dates', 'estate', 'check_in', 'check_out', 'event_date', 'date_flexible',
               'guests', 'overnight_guests', 'event_type', 'package_interest', 'tour_preference', 'tour_date', 'tour_time',
               'occasion', 'stay_overnight', 'message', 'sms_consent'];
  function leadOf(form) {
    var lead = {}, extra = {};
    each(form.elements, function (f) {
      if (!f.name || f.name === 'company_url' || off(f)) return;
      var v;
      if (f.type === 'checkbox') v = f.checked ? 'Yes' : '';
      else if (f.tagName === 'SELECT') v = optionText(f);
      else v = (f.value || '').trim();
      if (f.name === 'property') { if (v && v !== 'Not sure yet') extra.estate = v; else if (v) extra.estate = 'Not sure yet'; return; }
      if (v) extra[f.name] = v;
    });
    if (!extra.estate && form.getAttribute('data-estate')) extra.estate = form.getAttribute('data-estate');
    ORDER.forEach(function (k) { if (extra[k]) { lead[k] = extra[k]; delete extra[k]; } });
    Object.keys(extra).forEach(function (k) { lead[k] = extra[k]; });
    lead.source = form.getAttribute('data-source') || '';
    lead.page_url = window.location.href;
    return lead;
  }
  /* The CRM copy (2026-10-18): every field with data-crm="<custom field id>" goes to lead-notify as crm_fields, which
     writes it onto the GHL contact; plus the form's inquiry type (data-inquiry, set per topic on Contact). */
  function crmOf(form) {
    var out = {};
    each(form.querySelectorAll('[data-crm]'), function (f) {
      if (off(f)) return;
      var v = f.type === 'checkbox' ? (f.checked ? 'Yes' : '') : f.tagName === 'SELECT' ? optionText(f) : (f.value || '').trim();
      if (v) out[f.getAttribute('data-crm')] = v;
    });
    var iq = form.getAttribute('data-crm-inquiry'), t = form.getAttribute('data-inquiry');
    if (iq && t) out[iq] = t;
    // Future dates (2026-11-05): no CRM field of its own, so it leads the Message field on the GHL contact
    var fu = form.querySelector('input[name="future_dates"]'), msg = form.querySelector('[name="message"][data-crm]');
    if (fu && fu.checked && !off(fu) && msg) {
      var k = msg.getAttribute('data-crm');
      out[k] = 'Future dates inquiry (more than 6 months out)' + (out[k] ? '. ' + out[k] : '');
    }
    return out;
  }
  function sendLead(form) {
    var btn = form.querySelector('.form-submit'), fail = form.querySelector('.form-fail'), label = btn ? btn.textContent : '';
    var thanks = form.getAttribute('data-thanks');
    var hp = form.querySelector('input[name="company_url"]');
    if (hp && hp.value) { window.location.href = thanks; return; }   // a bot: pretend it went through
    var lead = leadOf(form);
    var crm = crmOf(form), ce = form.getAttribute('data-crm-estate');
    if (ce && lead.estate) crm[ce] = lead.estate;
    var payload = { client_id: form.getAttribute('data-client'), source: lead.source, page_url: lead.page_url, lead: lead, crm_fields: crm };
    window.__lastLead = payload;
    if (testMode(form)) {
      if (window.console) console.info('[lead] test mode, nothing sent:', payload);
      window.location.href = thanks;
      return;
    }
    if (fail) fail.hidden = true;
    if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
    var done = false, ctl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 12000);   // the function can cold start; give it time
    function failed(why) {
      if (done) return; done = true; clearTimeout(timer);
      if (window.console) console.error('[lead] not delivered:', why);
      if (btn) { btn.disabled = false; btn.textContent = label; }
      if (fail) { fail.hidden = false; fail.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    }
    try {
      fetch(form.getAttribute('data-notify'), {
        method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), signal: ctl ? ctl.signal : undefined
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (r.ok && j && j.ok) { done = true; clearTimeout(timer); markLead(); window.location.href = thanks; }
          else failed(r.status + ' ' + JSON.stringify(j).slice(0, 200));
        });
      }, function (err) { failed(err && err.message || 'network'); });
    } catch (err) { failed(err && err.message || 'fetch'); }
  }
  /* ---- 2c. the Contact form's "What is it about?": the choice sets the thank-you page, the alert's source and
     estate (from its option's data-*), and opens only its own fields (a closed group is hidden AND disabled, so its
     required fields neither block the submit nor reach the alert). ?about=event preselects a choice. ---- */
  /* ---- 2e. two slides (Emilio, 2026-10-18, as on Superheroes Academy): name, email and phone, then Next opens the
     rest. Next checks slide one only and keeps the contact as a partial lead (lead-notify with notify:false and
     stage:'partial', CRM Inquiry type "Started: ..."), so a drop-off can be followed up; the finished form then
     updates the same contact. Test mode never posts. CSS shows the slides only under html.js, so without JS the whole
     form shows and sends as before. ---- */
  function wireSteps() {
    each(document.querySelectorAll('form[data-steps]'), function (form) {
      var one = form.querySelector('.fstep--1'), next = form.querySelector('.fstep-next'), back = form.querySelector('.fstep-back');
      if (!one || !next) return;
      var captured = false, card = form.closest('.form-card') || form;
      function go(n) {
        form.classList.toggle('at2', n === 2);
        try { card.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { /* old browser */ }
        var f = form.querySelector(n === 2 ? '.fstep--2 input:not([type="hidden"]):not([type="checkbox"]), .fstep--2 select' : '.fstep--1 input');
        if (f) setTimeout(function () { try { f.focus({ preventScroll: true }); } catch (e) { /* old browser */ } }, 300);
      }
      next.addEventListener('click', function () {
        var first = null;
        each(one.querySelectorAll('input, select, textarea'), function (f) { var m = message(f); showErr(f, m); if (m && !first) first = f; });
        if (first) { first.focus({ preventScroll: true }); first.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
        if (!captured) { captured = true; capturePartial(form); }
        go(2);
      });
      if (back) back.addEventListener('click', function () { go(1); });
      one.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); next.click(); } });
    });
  }
  function capturePartial(form) {
    var hp = form.querySelector('input[name="company_url"]');
    if (hp && hp.value) return;   // a bot
    var lead = {}, crm = {};
    each(form.querySelectorAll('.fstep--1 [name]'), function (f) { var v = (f.value || '').trim(); if (v) lead[f.name] = v; });
    each(form.querySelectorAll('input[type="hidden"][name]'), function (f) {
      if (!f.value) return;
      lead[f.name] = f.value;
      if (f.getAttribute('data-crm')) crm[f.getAttribute('data-crm')] = f.value;
    });
    var iq = form.getAttribute('data-crm-inquiry'), t = form.getAttribute('data-inquiry');
    if (iq && t) crm[iq] = 'Started: ' + t;
    lead.source = form.getAttribute('data-source') || '';
    lead.page_url = window.location.href;
    var payload = { client_id: form.getAttribute('data-client'), source: lead.source, page_url: lead.page_url, lead: lead,
                    crm_fields: crm, notify: false, stage: 'partial' };
    window.__lastPartial = payload;
    if (testMode(form)) { if (window.console) console.info('[lead] test mode, slide one not sent:', payload); return; }
    try {
      fetch(form.getAttribute('data-notify'), { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload) }).catch(function () { /* the finished form still sends everything */ });
    } catch (e) { /* the finished form still sends everything */ }
  }

  /* "Price this package" on /weddings/packages/: picks that package in the pricing form below. */
  function wirePackagePick() {
    each(document.querySelectorAll('a[data-package]'), function (a) {
      a.addEventListener('click', function () {
        var s = document.querySelector('#pricing select[name="package_interest"]');
        if (s) { s.value = a.getAttribute('data-package'); s.dispatchEvent(new Event('change', { bubbles: true })); }
      });
    });
  }
  function wireTopics() {
    each(document.querySelectorAll('select[data-topic-select]'), function (s) {
      var form = s.form;
      if (!form) return;
      var sync = function () {
        var o = s.options[s.selectedIndex], d = (o && o.value) ? o.dataset : {};
        form.setAttribute('data-thanks', d.thanks || form.getAttribute('data-thanks'));
        if (d.source) form.setAttribute('data-source', d.source);
        if (d.estate) form.setAttribute('data-estate', d.estate); else form.removeAttribute('data-estate');
        if (d.inquiry) form.setAttribute('data-inquiry', d.inquiry);
        each(form.querySelectorAll('[data-topic]'), function (g) {
          var on = g.getAttribute('data-topic') === s.value;
          g.hidden = !on; g.disabled = !on;
          if (!on) each(g.querySelectorAll('input, select, textarea'), function (f) { showErr(f, ''); });
        });
      };
      var q = null;
      try { q = new URLSearchParams(location.search).get('about'); } catch (e) { /* old browser */ }
      if (q && !s.value && [].some.call(s.options, function (o) { return o.value === q; })) s.value = q;
      // ?future=1 (the "Inquire About Future Dates" button) ticks the future-dates box
      var fu = form.querySelector('input[name="future_dates"]'), fq = null;
      try { fq = new URLSearchParams(location.search).get('future'); } catch (e) { /* old browser */ }
      if (fu && fq === '1') fu.checked = true;
      s.addEventListener('change', sync);
      sync();
      window.addEventListener('pageshow', sync);
      setTimeout(sync, 0);
    });
  }

  /* ---- 2c2. Arriving on a form link (/028-jose-deleon-preview/contact/?about=...#message, the "Inquire About Future Dates" button, any
     #anchor that holds a form): the browser puts the form flush with the top edge, cutting the page heading off.
     Center the form card on screen instead (Emilio, 2026-11-05); a card taller than the screen sits 16px from the
     top. Re-centred once the page has loaded (photos and fonts move things); stops when the visitor scrolls. ---- */
  function wireFormCenter() {
    var id = location.hash && location.hash.length > 1 ? decodeURIComponent(location.hash.slice(1)) : '';
    var t = id && document.getElementById(id);
    // #book also holds the question form (2026-11-16): landing there is about booking, so never re-centre on that form
    var card = t && (t.classList.contains('form-card') ? t : (t.querySelector('.bk') ? null : t.querySelector('.form-card')));
    if (!card) return;
    var done = false;
    var stop = function () { done = true; };
    ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(function (ev) { window.addEventListener(ev, stop, { once: true, passive: true }); });
    var center = function () {
      if (done) return;
      var r = card.getBoundingClientRect(), vh = window.innerHeight;
      var y = window.pageYOffset + r.top - (r.height < vh - 32 ? (vh - r.height) / 2 : 16);
      jump(Math.max(0, Math.round(y)));
    };
    center();
    requestAnimationFrame(center);
    setTimeout(center, 300);
    window.addEventListener('load', function () { center(); setTimeout(center, 400); setTimeout(stop, 1500); });
  }

  /* ---- 2d. sideways rows (bedroom cards on phones): Safari does not load lazy photos that sit off to the side, so
     they popped in mid-swipe. Once a row comes near the screen, its photos load. ---- */
  function wireRowImages() {
    var rows = document.querySelectorAll('.rbcs');
    if (!rows.length || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        each(e.target.querySelectorAll('img[loading="lazy"]'), function (i) { i.loading = 'eager'; });
        io.unobserve(e.target);
      });
    }, { rootMargin: '600px 0px' });
    each(rows, function (r) { io.observe(r); });
  }

  function wireDates() {
    var today = ymd(new Date());
    each(document.querySelectorAll('input[type="date"]'), function (d) { d.min = today; });
    each(document.querySelectorAll('form'), function (form) {
      var cin = form.querySelector('input[name="check_in"]'), cout = form.querySelector('input[name="check_out"]');
      if (cin && cout) {
        var setMin = function (clear) {
          if (!cin.value) return;
          var d = new Date(cin.value + 'T00:00:00'); d.setDate(d.getDate() + 1);
          cout.min = ymd(d);
          if (clear && cout.value && cout.value < cout.min) cout.value = '';
        };
        cin.addEventListener('change', function () { setMin(true); });
        setMin(false);
        window.addEventListener('pageshow', function () { setMin(false); });
      }
      // stays: up to 32 guests, 18 when Bleu is picked
      var prop = form.querySelector('select[name="property"]'), gs = form.querySelector('input[name="guests"][max]');
      if (prop && gs) {
        var cap = function () { gs.max = String(prop.value).toLowerCase().indexOf('bleu') > -1 ? 18 : 32; };   // (no /028-jose-deleon-preview/bleu/ regex literal: the preview build prefixes /028-jose-deleon-preview/bleu/ paths)
        prop.addEventListener('change', cap); cap();
        window.addEventListener('pageshow', cap);
      }
      var flex = form.querySelector('input[name="date_flexible"]'), ed = form.querySelector('input[name="event_date"]');
      if (flex && ed) {
        var sync = function () { ed.required = !flex.checked; if (ed.getAttribute('aria-invalid') === 'true') showErr(ed, message(ed)); };
        flex.addEventListener('change', sync); sync();
        window.addEventListener('pageshow', sync);
      }
    });
  }

  /* ---- 3a. old ?view=events links: the Events section (there is no Stay / Events switch since Round 1) ---- */
  function wireViews() {
    var q = null;
    try { q = new URLSearchParams(location.search); } catch (e) { return; }
    if (q.get('view') !== 'events') return;
    var t = document.getElementById('events');
    q.delete('view');
    var search = q.toString() ? '?' + q.toString() : '';
    // an explicit fragment wins (?view=events#tour lands on the tour); the browser scrolls to it itself
    var own = location.hash && location.hash.length > 1 && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (!t || own) { setUrl(search, location.hash); return; }
    setUrl(search, '#events');
    t.scrollIntoView({ block: 'start', behavior: 'instant' });
  }

  /* ---- 3a'. smooth scrolling for in-page clicks only. html.sm (site.css) turns on scroll-behavior: smooth at the
     first pointer or key press, so the browser's own scroll to a deep link on load is never animated. ---- */
  function wireSmooth() {
    function on() {
      root.classList.add('sm');
      document.removeEventListener('pointerdown', on, true);
      document.removeEventListener('keydown', on, true);
    }
    document.addEventListener('pointerdown', on, true);
    document.addEventListener('keydown', on, true);
  }

  /* ---- 3b. amenities: the toggle opens the full grouped list (closed by default). On phones it opens the
     bottom sheet instead (large rows, a clear close). ---- */
  var PHONE_W = window.matchMedia ? window.matchMedia('(max-width: 759px)') : { matches: false };
  function wireAmenities() {
    if (!document.getElementById('amenities-all')) return;
    var toggles = document.querySelectorAll('[data-am-toggle]');
    var sheet = document.getElementById('am-sheet');
    // the list folds open and shut (Motion: open/close); html[data-amenities] still swaps the button label
    var dz = wrapFold(null, [document.getElementById('amenities-all')]);
    function isOpen() { return root.getAttribute('data-amenities') === 'open'; }
    function sync() {
      var o = isOpen() ? 'true' : 'false';
      each(toggles, function (t) { t.setAttribute('aria-expanded', o); });
    }
    fold(dz, isOpen(), true);
    function set(open, keep) {
      if (open) root.setAttribute('data-amenities', 'open'); else root.removeAttribute('data-amenities');
      var ms = fold(dz, open);
      // Keep the clicked button where it is if the list it closes sits above it and the reader is inside it.
      if (!open && keep) hold(keep, dz, ms);
      sync();
    }
    function phoneSheet() { if (sheet && PHONE_W.matches && sheet.showModal) { openSheet(sheet); return true; } return false; }
    each(toggles, function (t) { t.addEventListener('click', function () { if (isOpen()) set(false, t); else if (!phoneSheet()) set(true, t); }); });
    // #amenities only scrolls to the section: the full list stays closed until asked for (Round 1, R1-08).
    sync();
  }

  /* ---- 3d. bottom sheets: open, close on the X / backdrop / Escape (native) / a swipe down on the handle ---- */
  function openSheet(d) {
    d.style.transform = '';
    if (d.showModal) d.showModal(); else d.setAttribute('open', '');
    var x = d.querySelector('[data-sheet-close], [data-close]');
    if (x) x.focus({ preventScroll: true });
  }
  function closeSheet(d) { d.style.transform = ''; if (d.close) d.close(); else d.removeAttribute('open'); }
  // Drag the handle (or the sheet's header) down: the sheet follows the finger (transform) and closes past 80px.
  function swipeDown(handles, sheet, close) {
    each(handles, function (h) {
      var y0 = null, dy = 0, id = null;
      h.style.touchAction = 'none';
      h.addEventListener('pointerdown', function (e) {
        if (e.target.closest('button, a')) return;
        y0 = e.clientY; dy = 0; id = e.pointerId;
        try { h.setPointerCapture(id); } catch (x) { /* old browser */ }
        sheet.style.transition = 'none';
      });
      h.addEventListener('pointermove', function (e) {
        if (y0 === null || e.pointerId !== id) return;
        dy = Math.max(0, e.clientY - y0);
        sheet.style.transform = 'translateY(' + dy + 'px)';
      });
      function end() {
        if (y0 === null) return;
        y0 = null; sheet.style.transition = '';
        if (dy > 80) close(); else sheet.style.transform = '';
      }
      h.addEventListener('pointerup', end); h.addEventListener('pointercancel', end);
    });
  }
  function fresh(d) { return !!(d && d.__at && (window.performance ? performance.now() : Date.now()) - d.__at < 400); }
  window.GHFresh = fresh;
  function wireSheets() {
    // Header "Book direct" on a page about both houses: a small "Which house?" sheet
    each(document.querySelectorAll('[data-book-pick]'), function (a) {
      var d = document.getElementById('book-pick');
      if (d) a.addEventListener('click', function (e) {
        e.preventDefault();
        var m = document.getElementById('menu');
        if (m && !m.hidden) { var x = m.querySelector('.menu-close'); if (x) x.click(); }
        d.__at = window.performance ? performance.now() : Date.now(); openSheet(d);
      });
    });
    // Arriving at /<house>/#book from another page (header, "Ready to book?", the chooser): open the booking window
    if (location.hash === '#book') {
      var only = document.querySelectorAll('dialog.bk-dlg');
      var ob = only.length === 1 && document.querySelector('[data-open-book="' + only[0].id + '"]');
      if (ob) setTimeout(function () { ob.click(); }, 700);
    }
    // "Ready to book?" under a form: open that house's direct-booking window if this page has it, else follow the link
    each(document.querySelectorAll('[data-book-link]'), function (a) {
      a.addEventListener('click', function (e) {
        var d = document.getElementById('bk-dlg-' + a.getAttribute('data-book-link'));
        var b = d && document.querySelector('[data-open-book="' + d.id + '"]');
        if (!b) return;
        e.preventDefault();
        b.click();
      });
    });
    // Book: "Avoid the fees, book direct" opens the house's OwnerRez window (booking_block in build.py)
    each(document.querySelectorAll('[data-open-book]'), function (b) {
      var d = document.getElementById(b.getAttribute('data-open-book'));
      if (d) b.addEventListener('click', function () { d.__at = window.performance ? performance.now() : Date.now(); openSheet(d); });
    });
    each(document.querySelectorAll('dialog.sheet, dialog.amt-dlg'), function (d) {
      var close = function () { closeSheet(d); };
      each(d.querySelectorAll('[data-sheet-close]'), function (b) { b.addEventListener('click', close); });
      d.addEventListener('click', function (e) { if (e.target === d && !fresh(d)) close(); });   // backdrop tap
      d.addEventListener('close', function () { d.style.transform = ''; });
      swipeDown(d.querySelectorAll('[data-grab], .sheet-bar, .amt-dbar'), d, close);
    });
  }

  /* ---- 3e. "More": the rest of a paragraph, on phones ---- */
  function wireMore() {
    each(document.querySelectorAll('.more-btn'), function (b) {
      b.addEventListener('click', function () {
        var p = b.closest('.more'), x = p.querySelector('.more-x');
        var change = function () { p.classList.add('is-open'); };
        change.undo = function () { p.classList.remove('is-open'); };
        morph(p, change, true);
        if (x && x.animate && !still()) x.animate([{ opacity: 0 }, { opacity: 1 }], { duration: MO_IN, easing: 'cubic-bezier(.22,.8,.24,1)' });
        b.setAttribute('aria-expanded', 'true');
        if (x) { x.setAttribute('tabindex', '-1'); x.focus({ preventScroll: true }); }
      });
    });
  }

  /* ---- 3c. photos dialog ---- */
  function openPhotos(id, group) {
    var d = document.getElementById(id);
    if (!d) return;
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
    d.scrollTop = 0;
    if (group) {
      // land on that section's group inside the gallery
      var h = [].slice.call(d.querySelectorAll('.dlg-h')).filter(function (x) { return x.textContent.trim() === group; })[0];
      var bar = d.querySelector('.dlg-bar');
      if (h) d.scrollTop = h.offsetTop - (bar ? bar.offsetHeight : 0) - 8;
    }
  }
  function wirePhotos() {
    each(document.querySelectorAll('[data-open-photos]'), function (b) {
      b.addEventListener('click', function (e) { e.preventDefault(); openPhotos(b.getAttribute('data-open-photos'), b.getAttribute('data-group')); });
    });
    each(document.querySelectorAll('.photos-dlg'), function (d) {
      var close = function () { if (typeof d.close === 'function') d.close(); else d.removeAttribute('open'); };
      var btn = d.querySelector('[data-close-photos]');
      if (btn) btn.addEventListener('click', close);
    });
  }

  /* ---- 3f. photo rails: no scrollbar. Touch swipes natively (scroll-snap); a mouse drags, with a little momentum,
     then snaps to the nearest photo; arrow keys move one photo; a soft fade at each end says there is more.
     A drag never counts as a click (the pointer must move less than 6px for a click). ---- */
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function wireRails() {
    each(document.querySelectorAll('.rail'), function (rail) {
      var wrap = rail.parentNode, cells = rail.querySelectorAll('.rail-cell');
      function fades() {
        var max = rail.scrollWidth - rail.clientWidth;
        wrap.classList.toggle('is-start', rail.scrollLeft <= 2);
        wrap.classList.toggle('is-end', rail.scrollLeft >= max - 2);
      }
      rail.addEventListener('scroll', fades, { passive: true });
      window.addEventListener('resize', fades);
      fades();
      function step() { return cells.length > 1 ? cells[1].offsetLeft - cells[0].offsetLeft : rail.clientWidth * 0.8; }
      function pad() { return parseFloat(getComputedStyle(rail).paddingLeft) || 0; }
      function snapNearest(behavior) {
        var best = 0, d = 1e9, x = rail.scrollLeft;
        each(cells, function (c) { var dd = Math.abs(c.offsetLeft - pad() - x); if (dd < d) { d = dd; best = c.offsetLeft - pad(); } });
        var max = rail.scrollWidth - rail.clientWidth;
        if (x >= max - 2) best = max;
        rail.scrollTo({ left: Math.max(0, Math.min(max, best)), behavior: behavior });
      }
      rail.addEventListener('keydown', function (e) {
        if (e.key === 'Home' || e.key === 'End') {
          e.preventDefault();
          rail.scrollTo({ left: e.key === 'Home' ? 0 : rail.scrollWidth - rail.clientWidth, behavior: REDUCED ? 'auto' : 'smooth' });
          return;
        }
        var dir = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
        if (!dir) return;
        e.preventDefault();
        rail.scrollBy({ left: dir * step(), behavior: REDUCED ? 'auto' : 'smooth' });
      });
      // mouse drag (touch and pen keep the browser's own swipe)
      var pid = null, x0 = 0, sl0 = 0, down = false, moved = false, suppress = false, lastX = 0, lastT = 0, v = 0, raf = 0;
      rail.addEventListener('pointerdown', function (e) {
        if (e.pointerType !== 'mouse' || e.button !== 0) return;
        e.preventDefault();   // no text selection, no ghost image
        cancelAnimationFrame(raf);
        down = true; moved = false; x0 = lastX = e.clientX; sl0 = rail.scrollLeft; lastT = performance.now(); v = 0;
        pid = e.pointerId;
      });
      rail.addEventListener('pointermove', function (e) {
        if (!down) return;
        var dx = e.clientX - x0;
        if (!moved && Math.abs(dx) >= 6) {
          moved = true; rail.classList.add('is-dragging');
          // capture only once it is a drag, so a plain click still lands on the photo
          try { rail.setPointerCapture(pid); } catch (x) { /* old browser */ }
        }
        if (!moved) return;
        rail.scrollLeft = sl0 - dx;
        var t = performance.now(), dt = Math.max(1, t - lastT);
        v = 0.7 * v + 0.3 * ((lastX - e.clientX) / dt);   // px per ms, in scroll direction
        lastX = e.clientX; lastT = t;
      });
      function end() {
        if (!down) return;
        down = false;
        if (!moved) return;
        suppress = true;
        setTimeout(function () { suppress = false; }, 0);
        if (REDUCED || Math.abs(v) < 0.05) { finish(); return; }
        var t0 = performance.now();
        (function glide(t) {
          var dt = Math.min(32, t - t0); t0 = t;
          rail.scrollLeft += v * dt;
          v *= Math.pow(0.94, dt / 16);
          if (Math.abs(v) > 0.05 && rail.scrollLeft > 0 && rail.scrollLeft < rail.scrollWidth - rail.clientWidth) raf = requestAnimationFrame(glide);
          else finish();
        })(t0);
      }
      function finish() {
        snapNearest(REDUCED ? 'auto' : 'smooth');
        setTimeout(function () { rail.classList.remove('is-dragging'); }, REDUCED ? 0 : 450);
      }
      rail.addEventListener('pointerup', end);
      rail.addEventListener('pointercancel', end);
      rail.addEventListener('dragstart', function (e) { e.preventDefault(); });
      // a click (not a drag) on a photo opens the gallery at this rail's group
      rail.addEventListener('click', function (e) {
        if (suppress || rail.classList.contains('is-dragging') && moved) { e.preventDefault(); e.stopPropagation(); return; }
        var cell = e.target.closest && e.target.closest('.rail-cell');
        if (cell && rail.getAttribute('data-photos')) openPhotos(rail.getAttribute('data-photos'), rail.getAttribute('data-group'));
      }, true);
    });
  }

  /* ---- 4. menu: a bottom sheet. Closes on the X, the backdrop, Escape or a swipe down; the page under it does not
     scroll while it is open; focus stays inside it. ---- */
  function wireMenu() {
    var btn = document.querySelector('.menu-btn'), menu = document.getElementById('menu');
    if (!btn || !menu) return;
    var sheet = menu.querySelector('.menu-sheet'), closeBtn = menu.querySelector('.menu-close'), timer = 0, openedAt = 0;
    // Back closes the menu (audit r2 recheck): opening adds a history entry; any other close takes it back out
    var pushed = false, ownBack = 0;
    window.addEventListener('popstate', function () {
      if (ownBack) { ownBack--; return; }
      if (pushed && isOpen()) { pushed = false; set(false, true, true); }
    });
    function isOpen() { return !menu.hidden; }
    function set(open, refocus, viaPop) {
      clearTimeout(timer);
      if (!open && pushed && !viaPop) { pushed = false; ownBack++; try { history.back(); } catch (x) { ownBack--; } }
      if (open && !pushed && menu.hidden) { try { history.pushState({ dlg: 'menu' }, ''); pushed = true; } catch (x) { /* file:// */ } }
      if (open) {
        openedAt = Date.now();
        menu.hidden = false;
        root.classList.add('is-locked');
        if (still()) menu.classList.add('is-open');   // reduced motion: there at once
        else requestAnimationFrame(function () { requestAnimationFrame(function () { menu.classList.add('is-open'); }); });
        btn.setAttribute('aria-expanded', 'true');
        if (closeBtn) closeBtn.focus({ preventScroll: true });
      } else {
        menu.classList.remove('is-open');
        root.classList.remove('is-locked');
        btn.setAttribute('aria-expanded', 'false');
        if (sheet) sheet.style.transform = '';
        // hidden once the slide out has finished (Motion: open/close); at once under reduced motion
        if (still()) menu.hidden = true; else timer = setTimeout(function () { menu.hidden = true; }, MO_OUT + 20);
        if (refocus) btn.focus({ preventScroll: true });
      }
    }
    btn.addEventListener('click', function (e) { e.preventDefault(); set(true); });
    btn.addEventListener('keydown', function (e) { if (e.key === ' ') { e.preventDefault(); set(true); } });
    // the layout no longer shows the Menu button (wider window, rotated iPad): close at once, no animation
    function fit() {
      if (!isOpen() || getComputedStyle(btn).display !== 'none') return;
      clearTimeout(timer);
      menu.classList.remove('is-open'); root.classList.remove('is-locked'); btn.setAttribute('aria-expanded', 'false');
      if (sheet) sheet.style.transform = '';
      menu.hidden = true;
    }
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', function () { setTimeout(fit, 300); });
    if (closeBtn) closeBtn.addEventListener('click', function () { set(false, true); });
    each(menu.querySelectorAll('[data-menu-close]'), function (b) { b.addEventListener('click', function () { if (Date.now() - openedAt < 400) return; set(false, true); }); });
    each(menu.querySelectorAll('a'), function (a) { a.addEventListener('click', function () { pushed = false; set(false); }); });
    document.addEventListener('keydown', function (e) {
      if (!isOpen()) return;
      if (e.key === 'Escape') { set(false, true); return; }
      if (e.key === 'Tab' && sheet) {
        var f = [].slice.call(sheet.querySelectorAll('a[href], button'));
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    if (sheet) swipeDown(sheet.querySelectorAll('[data-grab], .menu-top'), sheet, function () { set(false, true); });
  }

  /* ---- 4b. phone sticky bar: on once the hero action has scrolled away, aside while a form/booking block shows ---- */
  function wireSticky() {
    var bar = document.querySelector('.sticky-bar');
    var watch = document.querySelector('[data-sticky-watch]');
    if (!bar || !watch || !('IntersectionObserver' in window)) return;
    var gone = false, hiders = 0;
    var show = function () { bar.classList.toggle('is-on', gone && hiders === 0); document.body.classList.toggle('sticky-on', bar.classList.contains('is-on')); };
    document.addEventListener('focusin', function (e) { if (e.target.matches && e.target.matches('input, select, textarea')) bar.classList.add('is-held'); });
    document.addEventListener('focusout', function () { setTimeout(function () {
      var a = document.activeElement; if (!(a && a.matches && a.matches('input, select, textarea'))) bar.classList.remove('is-held'); }, 50); });
    new IntersectionObserver(function (entries) {
      var e = entries[entries.length - 1];
      gone = !e.isIntersecting;
      show();
    }, { threshold: [0, 0.01] }).observe(watch);
    each(document.querySelectorAll('[data-sticky-hide], .booking-slot, .form-slot'), function (el) {
      var inView = false;
      // data-sticky-hide="past" (Book, the last section): it keeps the bar aside once scrolled above the screen too,
      // so the bar never slides back in over the footer offering the section the visitor just passed
      var past = el.getAttribute('data-sticky-hide') === 'past';
      new IntersectionObserver(function (entries) {
        var e = entries[entries.length - 1];
        var now = e.isIntersecting || (past && e.boundingClientRect.top < 0);
        if (now !== inView) { hiders += now ? 1 : -1; inView = now; show(); }
      }, { threshold: 0.05 }).observe(el);
      // a jump straight from below Book to above it (or back, e.g. the menu's links from the footer) crosses no
      // threshold, so the observer stays silent: a cheap scroll check settles a "past" block's state then
      if (past) {
        var tick = false;
        window.addEventListener('scroll', function () {
          if (tick) return; tick = true;
          requestAnimationFrame(function () {
            tick = false;
            var r = el.getBoundingClientRect(), now = r.top < 0 ? true : (r.top >= window.innerHeight ? false : null);
            if (now !== null && now !== inView) { hiders += now ? 1 : -1; inView = now; show(); }
          });
        }, { passive: true });
      }
    });
  }

  function wireDialogLock() {
    var opener = null;
    document.addEventListener('click', function (e) { var t = e.target.closest && e.target.closest('button, a'); if (t) opener = t; }, true);
    function sync() {
      var any = !!document.querySelector('dialog[open]');
      root.classList.toggle('dlg-locked', any);
    }
    // While a dialog is open the page under it does not scroll: a wheel that would reach the page is cancelled;
    // scrolling inside the dialog (or its lists) still works. The layout is untouched, so nothing moves.
    window.addEventListener('wheel', function (e) {
      var d = document.querySelector('dialog[open]');
      if (!d) return;
      for (var n = e.target; n && n.nodeType === 1; n = n.parentElement) {
        var box = n.getBoundingClientRect();
        var inside = e.clientX >= box.left && e.clientX <= box.right && e.clientY >= box.top && e.clientY <= box.bottom;
        // a wheel over the backdrop targets the dialog but would scroll the page: only a pointer inside the box counts
        if (inside && d.contains(n) && n.scrollHeight > n.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(n).overflowY)) {
          var up = e.deltaY < 0;
          if ((up && n.scrollTop > 0) || (!up && n.scrollTop + n.clientHeight < n.scrollHeight - 1)) return;
        }
        if (n === d) break;
      }
      e.preventDefault();
    }, { passive: false });
    var ty = 0, tx = 0;
    window.addEventListener('touchstart', function (e) { if (e.touches[0]) { ty = e.touches[0].clientY; tx = e.touches[0].clientX; } }, { passive: true });
    window.addEventListener('touchmove', function (e) {
      var d = document.querySelector('dialog[open]');
      if (!d || !e.touches[0] || e.touches.length > 1) return;   // a pinch is a zoom, never a page scroll
      if (d.id === 'lb') return;                                  // the full-screen viewer: nothing behind it shows
      var dy = e.touches[0].clientY - ty, dx = e.touches[0].clientX - tx;
      if (Math.abs(dx) > Math.abs(dy)) {
        // mostly sideways: a photo strip inside the window that can still move that way takes it
        for (var h = e.target; h && h.nodeType === 1 && h !== d; h = h.parentElement) {
          if (h.scrollWidth > h.clientWidth + 1 && /(auto|scroll)/.test(getComputedStyle(h).overflowX) &&
              ((dx < 0 && h.scrollLeft + h.clientWidth < h.scrollWidth - 1) || (dx > 0 && h.scrollLeft > 0))) return;
        }
        return;   // a sideways move never scrolls the page anyway
      }
      for (var n = e.target; n && n.nodeType === 1; n = n.parentElement) {
        if (n !== d && d.contains(n) && n.scrollHeight > n.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(n).overflowY)) {
          if ((dy > 0 && n.scrollTop > 0) || (dy < 0 && n.scrollTop + n.clientHeight < n.scrollHeight - 1)) return;
        }
        if (n === d) {
          // the window itself scrolls (a sheet): let it, inside its range
          if (d.scrollHeight > d.clientHeight + 1 && e.target !== d &&
              ((dy > 0 && d.scrollTop > 0) || (dy < 0 && d.scrollTop + d.clientHeight < d.scrollHeight - 1))) return;
          break;
        }
      }
      if (e.cancelable) e.preventDefault();
    }, { passive: false });
    window.addEventListener('keydown', function (e) {
      var d = document.querySelector('dialog[open]');
      if (!d || d.contains(document.activeElement)) return;
      if ([' ', 'PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', 'Home', 'End'].indexOf(e.key) > -1) e.preventDefault();
    });
    each(document.querySelectorAll('dialog'), function (d) {
      var mine = null;
      new MutationObserver(function () {
        if (d.open) { mine = opener; }
        sync();
      }).observe(d, { attributes: true, attributeFilter: ['open'] });
      d.addEventListener('close', function () {
        sync();
        // WebKit does not return focus by itself: put it back on the control that opened this dialog
        var host = mine && mine.closest('dialog');
        if (mine && document.contains(mine) && (!host || host.open)) { try { mine.focus({ preventScroll: true }); } catch (x) { /* ignore */ } }
      });
    });
  }

  function wireFocusClear() {
    var keyNav = false;
    document.addEventListener('keydown', function (e) { if (e.key === 'Tab') keyNav = true; }, true);
    document.addEventListener('pointerdown', function () { keyNav = false; }, true);
    document.addEventListener('focusin', function (e) {
      if (!keyNav) return;
      var el = e.target;
      if (!el.getBoundingClientRect || el.closest('dialog, .sticky-bar, .site-header, .menu')) return;
      requestAnimationFrame(function () {
        var r = el.getBoundingClientRect(), top = 8, bottom = window.innerHeight - 8;
        // keep clear of the phone bar's area whether it shows right now or not (it can appear as the page moves)
        var sb = document.querySelector('.sticky-bar');
        if (sb && getComputedStyle(sb).display !== 'none') bottom = window.innerHeight - sb.offsetHeight - 8;
        var by = r.top < top ? r.top - top : (r.bottom > bottom && r.height < bottom - top ? r.bottom - bottom : 0);
        if (by) { try { window.scrollBy({ top: by, behavior: 'instant' }); } catch (x) { window.scrollBy(0, by); } }
      });
    });
  }

  /* ---- 5. Google Ads conversions (launch, 2026-10-20). The Google tag (AW-18501432527) loads in every page head.
     A lead counts only when lead-notify confirmed it: sendLead marks the session, and the thank-you page fires its
     conversion once and clears the mark, so a bot (honeypot), a reload or a direct visit to /028-jose-deleon-preview/thank-you/ never counts.
     A tap on our phone number counts as a call click (not on the guest pages, never the hospital's number).
     A tap on a booking button (Book direct, Airbnb, VRBO) counts as "Booking click (website)", a SECONDARY action
     added 2026-10-26 for Umair to watch how much paid traffic heads to a booking; it is never bid on.
     Booking conversions fire inside OwnerRez's checkout (its Analytics Tracking settings), not here. ---- */
  var ADS = 'AW-18501432527';
  var ADS_LEAD = {
    '/028-jose-deleon-preview/thank-you/event/': 'JEGzCKuN_6MdEM_plfZE',     // Lead - Event inquiry (website)
    '/028-jose-deleon-preview/thank-you/stay/': 'a5_LCK6N_6MdEM_plfZE',      // Lead - Stay request (website)
    '/028-jose-deleon-preview/thank-you/tour/': 'YjpICLGN_6MdEM_plfZE',      // Lead - Tour request (website)
    '/028-jose-deleon-preview/thank-you/message/': 'nAAECLSN_6MdEM_plfZE'    // Lead - Contact message (website)
  };
  var ADS_CALL = '1PYiCLeN_6MdEM_plfZE';             // Call click (website)
  var ADS_BOOK = '-TvzCKf0taodEM_plfZE';             // Booking click (website), secondary
  var BOOK_BTN = '.bk-open, .ch-btn, .bm-direct, .bm-row, [data-book-link]';   // Book direct opened, Book on Airbnb / Vrbo, /book menu rows
  var OUR_PHONES = [];   // none: no phone number on the site since 2026-11-01 (Emilio). A number here counts its tel: taps as Call click.
  function liveSite() { return /(^|\.)grandhaciendapalmbeach\.com$/.test(location.hostname); }
  function markLead() { try { sessionStorage.setItem('ghp_lead', String(Date.now())); } catch (e) { /* blocked */ } }
  function wireAds() {
    if (!liveSite() || typeof window.gtag !== 'function') return;
    var label = ADS_LEAD[location.pathname], at = 0;
    try { at = +sessionStorage.getItem('ghp_lead') || 0; } catch (e) { /* blocked */ }
    if (label && at && Date.now() - at < 30 * 60 * 1000) {
      try { sessionStorage.removeItem('ghp_lead'); } catch (e) { /* blocked */ }
      window.gtag('event', 'conversion', { send_to: ADS + '/' + label });
    }
    if (/^\/stay\//.test(location.pathname)) return;   // booked guests calling about their stay are not leads
    document.addEventListener('click', function (e) {
      if (!e.target.closest) return;
      var a = e.target.closest('a[href^="tel:"]');
      if (a) {
        var n = a.getAttribute('href').slice(4).replace(/[^+\d]/g, '');
        if (OUR_PHONES.indexOf(n) > -1) window.gtag('event', 'conversion', { send_to: ADS + '/' + ADS_CALL });
        return;
      }
      if (e.target.closest(BOOK_BTN)) window.gtag('event', 'conversion', { send_to: ADS + '/' + ADS_BOOK });
    }, true);
  }

  // Hero carousel (2026-11-16): swipe or drag (mouse too), arrows, dots, and it turns by itself every 5s. Slide 1 is the
  // themed .hero-media; the rest get their files only after the page has loaded. Crossfade = opacity transition only.
  function wireHeroSlides() {
    each(document.querySelectorAll('.hero--slides .hero-bg'), function (bg) {
      var first = bg.querySelector('img.hero-media:not(.hero-media--ns)');
      var rest = [].slice.call(bg.querySelectorAll('.hs-slide'));
      if (!first || !rest.length) return;
      var slides = [first].concat(rest), dots = bg.querySelectorAll('.hs-dot'), cur = 0, timer = null, held = false;
      var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      bg.classList.add('hs-on');
      function load(im) { if (im.getAttribute('data-src')) { im.srcset = im.getAttribute('data-srcset'); im.src = im.getAttribute('data-src'); im.removeAttribute('data-src'); } }
      function show(i) {
        i = (i + slides.length) % slides.length;
        load(slides[i]); load(slides[(i + 1) % slides.length]);
        slides[cur].classList.remove('hs-cur'); slides[i].classList.add('hs-cur');
        if (cur === 0 && i !== 0) bg.classList.add('hs-moved');
        cur = i;
        each(dots, function (d, k) { d.setAttribute('aria-current', k === i ? 'true' : 'false'); });
      }
      function tick() { if (!held && !document.hidden) show(cur + 1); }
      function start() { if (!still) { clearInterval(timer); timer = setInterval(tick, 5000); } }
      slides[0].classList.add('hs-cur'); show(0);
      var later = function () { rest.forEach(load); start(); };
      if (document.readyState === 'complete') setTimeout(later, 1500); else window.addEventListener('load', function () { setTimeout(later, 1500); });
      bg.querySelector('.hs-prev').addEventListener('click', function () { show(cur - 1); start(); });
      bg.querySelector('.hs-next').addEventListener('click', function () { show(cur + 1); start(); });
      each(dots, function (d, k) { d.addEventListener('click', function () { show(k); start(); }); });
      bg.addEventListener('mouseenter', function () { held = true; });
      bg.addEventListener('mouseleave', function () { held = false; });
      var x0 = null, y0 = 0;
      bg.addEventListener('pointerdown', function (e) { if (e.target.closest('button,a')) return; x0 = e.clientX; y0 = e.clientY; });
      bg.addEventListener('pointerup', function (e) {
        if (x0 === null) return;
        var dx = e.clientX - x0, dy = e.clientY - y0; x0 = null;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { show(cur + (dx < 0 ? 1 : -1)); start(); }
      });
      bg.addEventListener('pointercancel', function () { x0 = null; });
      bg.addEventListener('dragstart', function (e) { e.preventDefault(); });
    });
  }

  function init() {
    try { fillHidden(attribution()); } catch (e) { /* never block the page */ }
    [wireSmooth, wireDialogMotion, wireFolds, wirePackagePick, wireTopics, wireFormCenter, wireSteps, wireForms, wireRowImages, wireDates, wireViews, wireAmenities, wireSheets, wireMore, wirePhotos, wireRails, wireHeroSlides, wireMenu, wireSticky, wireDialogLock, wireFocusClear, wireAds].forEach(function (fn) {
      try { fn(); } catch (e) { if (window.console) console.warn(e); }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

// Spanish button (2026-11-13): our own AI translation, not Google's. /028-jose-deleon-preview/assets/i18n/es.json maps every English string
// (text, placeholder, aria-label, alt) of the guest pages to Spanish; _build/i18n/ makes it. The choice is kept in
// localStorage, so every page opens in Spanish until the visitor taps English. Text that changes later (form steps,
// dialogs) is caught by a MutationObserver. Anything not in the file simply stays in English.
(function () {
  var KEY = 'gh-lang', es = false;
  try { es = localStorage.getItem(KEY) === 'es'; } catch (e) {}
  var dict = null, SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1 };
  function norm(t) { return t.replace(/\s+/g, ' ').trim(); }
  function off(el) {
    for (; el && el.nodeType === 1; el = el.parentNode) { if (SKIP[el.tagName] || el.getAttribute('translate') === 'no') return true; }
    return false;
  }
  function doText(n) {
    var raw = n.nodeValue, k = norm(raw);
    if (!k || !dict[k] || off(n.parentNode)) return;
    var m = raw.match(/^\s*/)[0], e = raw.match(/\s*$/)[0];
    n.nodeValue = m + dict[k] + e;
  }
  function doEl(el) {
    if (off(el)) return;
    ['placeholder', 'aria-label', 'alt', 'title'].forEach(function (a) {
      var v = el.getAttribute(a); if (v && dict[norm(v)]) el.setAttribute(a, dict[norm(v)]);
    });
  }
  function walk(root) {
    if (root.nodeType === 3) return doText(root);
    if (root.nodeType !== 1) return;
    doEl(root);
    var w = document.createTreeWalker(root, 5), n;
    while ((n = w.nextNode())) { n.nodeType === 3 ? doText(n) : doEl(n); }
  }
  function apply() {
    document.documentElement.lang = 'es';
    walk(document.body);
    new MutationObserver(function (ms) {
      ms.forEach(function (m) {
        if (m.type === 'characterData') doText(m.target);
        else m.addedNodes.forEach(walk);
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  // Flag button fixed at the bottom left (Emilio, 2026-11-13). Spain's flag offers Spanish; the US flag goes back.
  var FLAG_ES = '<svg viewBox="0 0 30 20" aria-hidden="true"><rect width="30" height="20" fill="#AA151B"/><rect y="5" width="30" height="10" fill="#F1BF00"/></svg>';
  var FLAG_US = '<svg viewBox="0 0 30 20" aria-hidden="true"><rect width="30" height="20" fill="#B22234"/><path d="M0 2.3h30M0 5.4h30M0 8.5h30M0 11.6h30M0 14.7h30M0 17.8h30" stroke="#fff" stroke-width="1.55"/><rect width="13" height="10.8" fill="#3C3B6E"/></svg>';
  function wire() {
    var f = document.createElement('button');
    f.type = 'button'; f.className = 'lang-flag'; f.setAttribute('data-lang', ''); f.setAttribute('translate', 'no');
    document.body.appendChild(f);
    document.querySelectorAll('[data-lang]').forEach(function (b) {
      b.innerHTML = (es ? FLAG_US : FLAG_ES) + '<span>' + (es ? 'English' : 'Español') + '</span>';
      b.setAttribute('aria-label', es ? 'View in English' : 'Ver en español');
      b.setAttribute('lang', es ? 'en' : 'es');
      b.addEventListener('click', function () {
        try { es ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, 'es'); } catch (e) {}
        if (window.umami) try { umami.track(es ? 'Language English' : 'Language Spanish'); } catch (e) {}
        location.reload();
      });
    });
    if (!es) return;
    fetch('/028-jose-deleon-preview/assets/i18n/es.json?v=1').then(function (r) { return r.json(); })
      .then(function (d) { dict = d; apply(); }).catch(function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
})();


/* Form glow (Emilio, 2026-11-17): after a button or link jumps to a form, the form card glows softly twice once the
   scroll has settled, so the visitor sees where to start. Any in-page link whose target is, or holds, a .form-card. */
(function () {
  function cardFor(hash) {
    if (!hash || hash.length < 2) return null;
    var t; try { t = document.querySelector(hash); } catch (e) { return null; }
    if (!t) return null;
    return t.classList.contains('form-card') ? t : t.querySelector('.form-card') || (t.closest && t.closest('.form-card'));
  }
  function glow(card) {
    card.classList.remove('is-glow'); void card.offsetWidth; card.classList.add('is-glow');
    setTimeout(function () { card.classList.remove('is-glow'); }, 2600);
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var card = cardFor(a.getAttribute('href'));
    if (!card) return;
    var done = false, go = function () { if (!done) { done = true; glow(card); } };
    if ('onscrollend' in window) window.addEventListener('scrollend', go, { once: true });
    setTimeout(go, 900);   // no scroll needed, or no scrollend support
  });
})();
