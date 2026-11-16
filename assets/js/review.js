/* ==========================================================================
   /review/: the star page the review request links to (built by build.py build_review()).

   THE FLOW (Emilio, as on Superhero Swim 007):
     5 stars   straight on to Google's write-a-review box. No second ask.
     1 to 4    a short private feedback form. Everything optional; Send works with just the rating.
   The feedback screen has NO link to Google. That is Emilio's decision, made knowingly. Do not add one.

   Link: /review/?c=<GHL contact id>&h=<gh|bleu>. h names the house (the head of the page already set the title);
   c rides along in the alert so José knows who wrote it. Bare /review/ works the same, just without them.

   Feedback is a lead-notify post (contract: 001-nils-client-portal/supabase/functions/lead-notify/index.ts), source
   "Guest feedback (N stars)". It is NOT a lead conversion: no thank-you page, no markLead, nothing for Ads.
   Nothing is written on load, so a mail or SMS link scanner records nothing.
   TEST MODE never posts (same rule as site.js): ?test=1, localhost and the preview hosts; ?test=0 turns it off.
   In test mode the payload goes to the console and window.__lastFeedback.
   5-star taps are counted as an Umami event ("review-stars", {stars}); the site already loads Umami.
   ========================================================================== */
(function () {
  'use strict';
  var root = document.querySelector('[data-review]');
  if (!root) return;
  var $ = function (s) { return root.querySelector(s); };
  var box = $('[data-google]'), GOOGLE = box.getAttribute('data-google');
  var title = $('[data-rv-title]'), rate = $('[data-rv-rate]'), go = $('[data-rv-go]');
  var form = $('[data-rv-form]'), done = $('[data-rv-done]');
  var stars = [].slice.call(root.querySelectorAll('.rv-star'));
  var HOUSES = { gh: 'Grand Hacienda', bleu: 'Bleu' };

  var q;
  try { q = new URLSearchParams(location.search); } catch (e) { q = { get: function () { return null; } }; }
  var house = HOUSES[(q.get('h') || '').toLowerCase()] || '';
  var contact = (q.get('c') || '').replace(/[^\w-]/g, '').slice(0, 64);
  var chosen = 0;

  var TEST_KEY = 'ghp_lead_test';   // shared with site.js, so ?test=1 on any page covers this one too
  function testMode() {
    var t = q.get('test');
    try {
      if (t === '1') sessionStorage.setItem(TEST_KEY, '1');
      else if (t === '0') sessionStorage.setItem(TEST_KEY, '0');
      var st = sessionStorage.getItem(TEST_KEY);
      if (st === '1') return true;
      if (st === '0') return false;
    } catch (e) { if (t) return t === '1'; }
    var h = location.hostname, hosts = (form.getAttribute('data-test-hosts') || '').split(/\s+/);
    return h === 'localhost' || h === '127.0.0.1' || hosts.indexOf(h) > -1;
  }
  function track(n) {
    try { if (window.umami && window.umami.track) window.umami.track('review-stars', { stars: n, house: house || 'none' }); } catch (e) {}
  }
  function paint(n) {
    stars.forEach(function (s, i) {
      s.classList.toggle('on', i < n);
      s.setAttribute('aria-checked', i + 1 === n ? 'true' : 'false');
    });
  }
  function show(which) {
    rate.hidden = which !== 'rate' && which !== 'form';   // the stars stay above the form, so a guest can change them
    go.hidden = which !== 'go';
    form.hidden = which !== 'form';
    done.hidden = which !== 'done';
  }

  /* Star tap log (Emilio, 2026-11-11: follow up "si no presionan"). A guest who taps any star gets no more campaign
     emails; the campaign (n8n "José: past guests review campaign") reads jose_review_log in Zona Libre. Only with a
     c= id from our link, never in test mode. Anon key + RPC jose_review_star (checks the id, caps rows). A tap is a
     person's action, so mail link scanners still record nothing. */
  var STAR_RPC = 'https://nroeiabeirifurdaybyo.supabase.co/rest/v1/rpc/jose_review_star';
  var STAR_KEY = 'sb_publishable_uFoD5psy350ZOSxjm97EEA_Jf-4xN02';
  function logTap(n) {
    if (!contact || testMode()) return;
    try {
      fetch(STAR_RPC, {
        method: 'POST', keepalive: true,
        headers: { 'Content-Type': 'application/json', apikey: STAR_KEY, Authorization: 'Bearer ' + STAR_KEY },
        body: JSON.stringify({ p_contact: contact, p_stars: n })
      }).catch(function () {});
    } catch (e) {}
  }

  function pick(n) {
    chosen = n; paint(n); track(n); logTap(n);
    if (n === 5) {
      title.textContent = 'Thank you!';
      show('go');
      // a moment for the count to leave, then on to Google (replace: Back does not land on "Taking you...")
      setTimeout(function () { location.replace(GOOGLE); }, 700);
      return;
    }
    if (form.hidden) {
      title.textContent = 'Thank you for telling us.';
      $('.rv-rate .hero-sub').textContent = 'What could we have done better?';
      show('form');
    }
  }
  stars.forEach(function (s) {
    s.addEventListener('click', function () { pick(parseInt(s.getAttribute('data-n'), 10)); });
  });

  /* The payload lead-notify takes. Every field is optional except the rating: a guest who only taps 3 stars and
     Send still reaches José. "Email or phone" is one box; it lands in email or phone so the alert's Call and Reply
     buttons work. */
  function payload() {
    var v = function (n) { var f = form.querySelector('[name="' + n + '"]'); return f ? (f.value || '').trim() : ''; };
    var reach = v('reach'), name = v('full_name'), msg = v('message');
    var src = 'Guest feedback (' + chosen + (chosen === 1 ? ' star)' : ' stars)');
    var lead = {};
    if (name) lead.full_name = name;
    if (/@/.test(reach)) lead.email = reach;
    else if (reach.replace(/\D/g, '').length >= 7) lead.phone = reach;
    else if (reach) lead.contact = reach;
    lead.rating = chosen + ' out of 5';
    lead.estate = house || 'Not named in the link';
    if (msg) lead.message = msg;
    if (contact) lead.guest_contact_id = contact;
    lead.source = src;
    lead.page_url = location.href;
    return { client_id: form.getAttribute('data-client'), source: src, page_url: lead.page_url, lead: lead, crm_fields: {} };
  }

  var btn = form.querySelector('.form-submit'), fail = form.querySelector('.form-fail'), label = btn.textContent;
  function finished() {
    title.textContent = 'Thank you.';
    show('done');
    try { done.focus({ preventScroll: true }); } catch (e) {}
  }
  var GHL_HOOK = 'https://nilsdigital.app.n8n.cloud/webhook/jose-guest-feedback';
  function send() {
    var hp = form.querySelector('input[name="company_url"]');
    if (hp && hp.value) { finished(); return; }   // a bot: pretend it went through
    var p = payload();
    window.__lastFeedback = p;
    if (testMode()) {
      if (window.console) console.info('[feedback] test mode, nothing sent:', p);
      finished();
      return;
    }
    fail.hidden = true; btn.disabled = true; btn.textContent = 'Sending…';
    var over = false, ctl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 12000);   // the function can cold start
    function failed(why) {
      if (over) return; over = true; clearTimeout(timer);
      if (window.console) console.error('[feedback] not delivered:', why);
      btn.disabled = false; btn.textContent = label; fail.hidden = false;
    }
    /* GHL copy (Emilio, 2026-11-11: "tambien lo podemos agregar en Go High Level"): a note, the tags low-rating and
       rating-N and a call-back task for José on the guest's contact, by the n8n webhook "José: low rating from the review
       page into GHL". Fire and forget: the email through lead-notify below is what the guest's Send waits for. */
    try {
      fetch(GHL_HOOK, {
        method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stars: chosen, house: p.lead.estate, message: p.lead.message || '', name: p.lead.full_name || '',
          reach: p.lead.email || p.lead.phone || p.lead.contact || '', contact: contact || '' })
      }).catch(function () {});
    } catch (e) {}
    try {
      fetch(form.getAttribute('data-notify'), {
        method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p), signal: ctl ? ctl.signal : undefined
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (r.ok && j && j.ok) { over = true; clearTimeout(timer); finished(); }
          else failed(r.status + ' ' + JSON.stringify(j).slice(0, 200));
        });
      }, function (err) { failed(err && err.message || 'network'); });
    } catch (err) { failed(err && err.message || 'fetch'); }
  }
  form.addEventListener('submit', function (e) { e.preventDefault(); if (!btn.disabled) send(); });
  form.querySelector('.form-retry').addEventListener('click', send);
})();
