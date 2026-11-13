#!/usr/bin/env node
'use strict';
/*
 * Analytics regression test for assets/calc-ux.js (GA4 events).   node tests/calc-analytics.test.js
 *
 * Loads every page in tools/ in jsdom with its real scripts, clicks the real
 * buttons and reads what was pushed to dataLayer.
 *
 * Dependency: jsdom (tested with 24.1.3). The repo has no package.json and the
 * other tests need nothing, so jsdom is installed outside the repo:
 *
 *   npm install --prefix <some folder outside the repo> --no-save jsdom@24.1.3
 *   NODE_PATH=<that folder>/node_modules node tests/calc-analytics.test.js
 *
 * Without jsdom this test FAILS (exit code 2). It never passes by skipping.
 * To skip on purpose, for example on a machine that only runs the other tests,
 * pass --allow-skip: it still prints SKIP and exits 0, so a skip is explicit.
 *
 * Rules under test: only two events (calculator_open, calculation_complete),
 * each with exactly calculator_id and category; every successful Calculate is
 * counted, even with unchanged inputs; invalid input is never counted; the
 * DNS lookup is counted only when a resolver really answered; a late or
 * missing gtag loses nothing and breaks nothing; loading the script twice
 * never doubles an event.
 */
const fs = require('fs');
const path = require('path');

let JSDOM, ResourceLoader, VirtualConsole;
try { ({ JSDOM, ResourceLoader, VirtualConsole } = require('jsdom')); } catch (e) {
  if (process.argv.includes('--allow-skip')) {
    console.log('SKIP  jsdom is not installed; the analytics checks did NOT run (--allow-skip).');
    process.exit(0);
  }
  console.error('FAIL  jsdom is not installed, so the analytics checks could not run.');
  console.error('      npm install --prefix <folder outside the repo> --no-save jsdom@24.1.3');
  console.error('      NODE_PATH=<folder>/node_modules node tests/calc-analytics.test.js');
  process.exit(2);
}

const ROOT = path.join(__dirname, '..');
const CALC_UX = fs.readFileSync(path.join(ROOT, 'assets/calc-ux.js'), 'utf8');
const pages = fs.readdirSync(path.join(ROOT, 'tools')).filter((f) => f.endsWith('.html')).sort();

// url -> category slug, read from the real navigation data in assets/nav.js
const navText = fs.readFileSync(path.join(ROOT, 'assets/nav.js'), 'utf8');
const navCategory = {};
{
  const block = navText.slice(navText.indexOf('categories: ['), navText.indexOf('guidesIndex'));
  let slug = null;
  block.split('\n').forEach((line) => {
    const s = /slug: '([^']+)'/.exec(line); if (s) slug = s[1];
    const u = /url: '(\/tools\/[^']+)'/.exec(line); if (u && slug) navCategory[u[1]] = slug;
  });
}
const redirects = fs.readFileSync(path.join(ROOT, '_redirects'), 'utf8');
// A tools/ page that production redirects (301) to another page is never served.
const retired = {};
redirects.split('\n').forEach((l) => {
  const m = /^\/tools\/(\S+)\s+\/tools\/\S+\s+301/.exec(l.trim());
  if (m) retired[m[1] + '.html'] = true;
});

class Loader extends ResourceLoader {
  fetch(url) {
    const u = new URL(url);
    if (u.hostname === 'gaugecalc.com') {
      const file = path.join(ROOT, decodeURIComponent(u.pathname));
      if (fs.existsSync(file)) return Promise.resolve(fs.readFileSync(file));
    }
    return Promise.resolve(Buffer.from('')); // external scripts (gtag.js, AdSense) are not loaded
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function load(page, opts = {}) {
  let html = fs.readFileSync(path.join(ROOT, 'tools', page), 'utf8');
  if (opts.noGtag) {
    html = html.replace('function gtag(){dataLayer.push(arguments);}', '')
      .replace("gtag('js', new Date());", '').replace(/gtag\('config', '[^']*'\);/, '');
  }
  const errors = [];
  const dom = new JSDOM(html, {
    url: 'https://gaugecalc.com/tools/' + page.replace(/\.html$/, ''),
    runScripts: 'dangerously',
    resources: new Loader(),
    pretendToBeVisual: true,
    virtualConsole: new VirtualConsole(),
    beforeParse(w) {
      w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
      w.Element.prototype.scrollIntoView = function () {};
      w.scrollTo = function () {};
      w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
      // jsdom has no layout: an element counts as visible unless it or an ancestor is display:none.
      w.Element.prototype.getClientRects = function () {
        for (let e = this; e && e.nodeType === 1; e = e.parentElement) {
          if (e.hidden || w.getComputedStyle(e).display === 'none') return [];
        }
        return [{}];
      };
      if (opts.fetch) w.fetch = opts.fetch;
      w.addEventListener('error', (e) => errors.push(String(e.message || e.error)));
    },
  });
  await new Promise((r) => (dom.window.document.readyState === 'complete' ? r() : dom.window.addEventListener('load', r)));
  await wait(50);
  return { w: dom.window, errors };
}

const evs = (w) => (w.dataLayer || []).filter((a) => a && a[0] === 'event').map((a) => ({ name: a[1], params: a[2] }));
const count = (w, name, id) => evs(w).filter((e) => e.name === name && (!id || e.params.calculator_id === id)).length;
const click = (w, el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
const fire = (w, el) => { el.dispatchEvent(new w.Event('input', { bubbles: true })); el.dispatchEvent(new w.Event('change', { bubbles: true })); };
const visibleErrors = (root) => Array.from(root.querySelectorAll('[aria-invalid="true"], .field-error'))
  .filter((e) => e.getClientRects().length && (!e.classList.contains('field-error') || (e.textContent || '').trim()));
const TWO_PARAMS = '["calculator_id","category"]';
// Every event pushed to dataLayer: one of the two allowed names, three gtag
// arguments (command, name, params), exactly the two parameters, and both
// values are plain slugs (so no typed text, hostname or result can be in them).
const ALLOWED = ['calculator_open', 'calculation_complete'];
function eventsClean(w) {
  const raw = (w.dataLayer || []).filter((a) => a && a[0] === 'event');
  return raw.every((a) => a.length === 3 && ALLOWED.includes(a[1]) && a[2] && JSON.stringify(Object.keys(a[2]).sort()) === TWO_PARAMS
    && /^[a-z0-9-]+$/.test(a[2].calculator_id) && /^[a-z0-9-]+$/.test(a[2].category));
}

let passed = 0, failed = 0;
const failures = [];
function check(name, ok, detail) {
  if (ok) { passed++; console.log('PASS  ' + name); }
  else { failed++; failures.push(name); console.log('FAIL  ' + name + (detail ? '   [' + detail + ']' : '')); }
}

// ---- every page: open, parameters, category, repeated Calculate, invalid, duplicate load, gtag late / missing
async function genericPage(page) {
  const slug = page.replace(/\.html$/, '');
  const url = '/tools/' + slug;
  const isDns = page === 'dns-lookup.html';
  const { w, errors } = await load(page);
  const layout = w.document.querySelector('.calc-layout');
  const cta = layout && layout.querySelector('.calc-actions .calc-cta');
  check(page + ': Calculate button is created', !!cta);
  if (!cta) return;

  const opens = evs(w).filter((e) => e.name === 'calculator_open');
  check(page + ': calculator_open fires once', opens.length === 1, String(opens.length));
  if (opens[0]) {
    check(page + ': event parameters are exactly calculator_id and category', JSON.stringify(Object.keys(opens[0].params).sort()) === TWO_PARAMS, JSON.stringify(opens[0].params));
    check(page + ': calculator_id is the page slug', opens[0].params.calculator_id === slug, opens[0].params.calculator_id);
    if (retired[page]) {
      check(page + ': retired page (production 301-redirects it, not in nav): category is uncategorized', opens[0].params.category === 'uncategorized' && !navCategory[url], opens[0].params.category);
    } else {
      check(page + ': category equals the nav.js category', opens[0].params.category === navCategory[url] && !!navCategory[url], opens[0].params.category + ' vs ' + navCategory[url]);
    }
  }

  if (!isDns) {
    const before = count(w, 'calculation_complete');
    click(w, cta); click(w, cta);
    check(page + ': same inputs, two Calculate = two events', count(w, 'calculation_complete') - before === 2, String(count(w, 'calculation_complete') - before));
    const last = evs(w).filter((e) => e.name === 'calculation_complete').pop();
    check(page + ': calculation_complete parameters are exactly calculator_id and category', !!last && JSON.stringify(Object.keys(last.params).sort()) === TWO_PARAMS, last && JSON.stringify(last.params));

    // invalid input: put a value the page rejects, then Calculate
    const panel = layout.querySelector('.panel:not(.result-panel)');
    const inputs = Array.from(panel.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range])')).filter((e) => e.getClientRects().length);
    let forced = false;
    for (const input of inputs) {
      const old = input.value;
      for (const v of ['-5', '0', 'abc', '!!!', '999999999999', '']) {
        input.value = v; fire(w, input);
        if (visibleErrors(layout).length) { forced = true; break; }
      }
      if (forced) break;
      input.value = old; fire(w, input);
    }
    if (forced) {
      const b = count(w, 'calculation_complete');
      click(w, cta);
      check(page + ': invalid input fires no event', count(w, 'calculation_complete') === b, String(count(w, 'calculation_complete') - b));
    } else {
      // battery-backup-calculator clamps bad values to 0 and has no error state, so there is nothing to detect.
      check(page + ': invalid input (page has no error state; values are clamped) - nothing to detect', page === 'battery-backup-calculator.html', 'unexpected: no error state found');
    }
  }

  check(page + ': every event has an allowed name, 3 gtag arguments, exactly the two parameters, slug values only', eventsClean(w));
  w.eval(CALC_UX);
  check(page + ': script loaded twice still gives one calculator_open', count(w, 'calculator_open') === 1, String(count(w, 'calculator_open')));
  check(page + ': no script errors', errors.length === 0, errors.join(' | '));
  w.close();

  const late = await load(page, { noGtag: true });
  const c0 = count(late.w, 'calculator_open');
  late.w.gtag = function () { late.w.dataLayer.push(arguments); };
  await wait(1300);
  const c1 = count(late.w, 'calculator_open');
  check(page + ': gtag appears late: calculator_open is not lost and is sent once', c0 === 0 && c1 === 1, c0 + ' -> ' + c1);
  late.w.eval(CALC_UX);
  await wait(700);
  check(page + ': gtag late + second script load: still one calculator_open', count(late.w, 'calculator_open') === 1, String(count(late.w, 'calculator_open')));
  late.w.close();

  const none = await load(page, { noGtag: true });
  let threw = '';
  try { click(none.w, none.w.document.querySelector('.calc-layout .calc-actions .calc-cta')); } catch (e) { threw = String(e); }
  check(page + ': gtag never available: nothing breaks', threw === '' && none.errors.length === 0, threw || none.errors.join(' | '));
  none.w.close();
}

// ---- amp-hour page: two calculators
async function ampHour() {
  const page = 'amp-hour-calculator.html';
  const { w } = await load(page);
  const A = 'amp-hour-calculator', B = 'amp-hour-battery-sizing';
  const cta1 = w.document.querySelector('.calc-layout .calc-actions .calc-cta');
  const cta2 = w.document.getElementById('sizingCalcBtn');
  check('amp-hour: both Calculate buttons exist', !!cta1 && !!cta2);
  click(w, cta1); click(w, cta1);
  check('amp-hour converter: two Calculate = two events (' + A + ')', count(w, 'calculation_complete', A) === 2, String(count(w, 'calculation_complete', A)));
  click(w, cta2); click(w, cta2);
  check('amp-hour sizing: two Calculate = two events (' + B + ')', count(w, 'calculation_complete', B) === 2, String(count(w, 'calculation_complete', B)));
  const ids = new Set(evs(w).filter((e) => e.name === 'calculation_complete').map((e) => e.params.calculator_id));
  check('amp-hour: exactly the two distinct calculator_ids', ids.size === 2 && ids.has(A) && ids.has(B), [...ids].join(','));
  check('amp-hour: both calculators report the same category', new Set(evs(w).map((e) => e.params.category)).size === 1);
  check('amp-hour: every event has an allowed name, 3 gtag arguments, exactly the two parameters, slug values only', eventsClean(w));

  const sizing = w.document.getElementById('loadValue');
  const panel2 = sizing.closest('.panel');
  let forced = false;
  for (const v of ['-5', 'abc', '']) { sizing.value = v; fire(w, sizing); if (visibleErrors(panel2).length) { forced = true; break; } }
  const b0 = count(w, 'calculation_complete', B);
  click(w, cta2);
  check('amp-hour sizing: invalid input fires no event', forced && count(w, 'calculation_complete', B) === b0, 'forced=' + forced);
  sizing.value = '50'; fire(w, sizing);
  click(w, cta2);
  check('amp-hour sizing: valid again fires one event', count(w, 'calculation_complete', B) === b0 + 1, String(count(w, 'calculation_complete', B) - b0));

  const cur = w.document.getElementById('curValue');
  const panel1 = cur.closest('.panel');
  let forced1 = false;
  for (const v of ['-5', 'abc', '']) { cur.value = v; fire(w, cur); if (visibleErrors(panel1).length) { forced1 = true; break; } }
  const a0 = count(w, 'calculation_complete', A);
  click(w, cta1);
  check('amp-hour converter: invalid input fires no event', forced1 && count(w, 'calculation_complete', A) === a0, 'forced=' + forced1);

  // loading the script a second time must not add a second listener to the sizing button
  cur.value = '5'; fire(w, cur);
  w.eval(CALC_UX);
  const b1 = count(w, 'calculation_complete', B);
  click(w, cta2);
  check('amp-hour sizing: script loaded twice, one Calculate = one event', count(w, 'calculation_complete', B) - b1 === 1, String(count(w, 'calculation_complete', B) - b1));
  w.close();
}

// ---- DNS lookup: counted only when a resolver really answered
const okReply = (status, answers) => () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ Status: status, Answer: answers || [] }) });
const A_ANSWER = [{ type: 1, TTL: 60, data: '93.184.216.34' }];

async function dns() {
  const page = 'dns-lookup.html';
  async function run(fetchFn, name, times = 1, settle = 80) {
    const calls = [];
    const p = await load(page, { fetch: (...a) => { calls.push(a[0]); return fetchFn(...a); } });
    if (name != null) p.w.document.getElementById('dnsName').value = name;
    const cta = p.w.document.querySelector('.calc-layout .calc-actions .calc-cta');
    for (let i = 0; i < times; i++) { click(p.w, cta); await wait(settle); }
    return Object.assign(p, { calls, cta });
  }

  let r = await run(okReply(0, A_ANSWER), 'example.org', 0);
  click(r.w, r.cta);
  check('dns: no event at the moment of the click (the lookup is still running)', count(r.w, 'calculation_complete') === 0, String(count(r.w, 'calculation_complete')));
  await wait(80);
  check('dns: valid name and a resolver answer = one event', count(r.w, 'calculation_complete') === 1, String(count(r.w, 'calculation_complete')));
  const ev = evs(r.w).filter((e) => e.name === 'calculation_complete').pop();
  check('dns: event parameters are exactly calculator_id and category (dns-lookup, networking-poe)', !!ev && JSON.stringify(Object.keys(ev.params).sort()) === TWO_PARAMS && ev.params.calculator_id === 'dns-lookup' && ev.params.category === 'networking-poe', ev && JSON.stringify(ev.params));
  click(r.w, r.cta); await wait(80);
  check('dns: the same lookup again = a second event', count(r.w, 'calculation_complete') === 2, String(count(r.w, 'calculation_complete')));
  r.w.close();

  r = await run(okReply(3, []), 'no-such-name-example.org');
  check('dns: NXDOMAIN (the resolver answered "does not exist") counts as a completed lookup', count(r.w, 'calculation_complete') === 1, String(count(r.w, 'calculation_complete')));
  r.w.close();

  for (const bad of ['!!!', 'localhost', '1.2.3.4', 'a..b.com', 'http://example.com', '']) {
    r = await run(okReply(0, A_ANSWER), bad);
    check('dns: invalid name "' + bad + '" fires no event and sends no request', count(r.w, 'calculation_complete') === 0 && r.calls.length === 0, 'events=' + count(r.w, 'calculation_complete') + ' requests=' + r.calls.length);
    r.w.close();
  }

  r = await run(() => Promise.reject(new Error('network down')), 'example.org');
  check('dns: no resolver reachable (request fails) fires no event', count(r.w, 'calculation_complete') === 0, String(count(r.w, 'calculation_complete')));
  r.w.close();

  r = await run(() => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) }), 'example.org');
  check('dns: HTTP 500 from both resolvers fires no event', count(r.w, 'calculation_complete') === 0, String(count(r.w, 'calculation_complete')));
  r.w.close();

  r = await run(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ nonsense: true }) }), 'example.org');
  check('dns: a reply that is not a DNS answer fires no event', count(r.w, 'calculation_complete') === 0, String(count(r.w, 'calculation_complete')));
  r.w.close();

  // the first resolver fails, the second answers: that is a successful lookup
  let n = 0;
  r = await run(() => (++n === 1 ? Promise.reject(new Error('x')) : okReply(0, A_ANSWER)()), 'example.org');
  check('dns: first resolver fails, second answers = one event', count(r.w, 'calculation_complete') === 1, String(count(r.w, 'calculation_complete')));
  r.w.close();

  // a slow lookup clicked twice: the page runs one lookup, so one event
  let release;
  const slow = () => new Promise((res) => { release = () => res({ ok: true, status: 200, json: () => Promise.resolve({ Status: 0, Answer: A_ANSWER }) }); });
  r = await run(slow, 'example.org', 0);
  click(r.w, r.cta); click(r.w, r.cta);
  release(); await wait(80);
  check('dns: Calculate clicked twice while one lookup runs = one request and one event', r.calls.length === 1 && count(r.w, 'calculation_complete') === 1, 'requests=' + r.calls.length + ' events=' + count(r.w, 'calculation_complete'));
  r.w.close();

  // Enter in the name field goes through the same path
  r = await run(okReply(0, A_ANSWER), 'example.org', 0);
  r.w.document.getElementById('dnsForm').dispatchEvent(new r.w.Event('submit', { bubbles: true, cancelable: true }));
  await wait(80);
  check('dns: Enter in the name field = one event', count(r.w, 'calculation_complete') === 1, String(count(r.w, 'calculation_complete')));
  r.w.close();

  // script loaded twice: still one event per lookup
  r = await run(okReply(0, A_ANSWER), 'example.org', 0);
  r.w.eval(CALC_UX);
  click(r.w, r.cta); await wait(80);
  check('dns: script loaded twice, one lookup = one event', count(r.w, 'calculation_complete') === 1, String(count(r.w, 'calculation_complete')));
  r.w.close();

  // the event the page sends carries no data
  r = await run(okReply(0, A_ANSWER), 'secret-camera-host.example.org');
  check('dns: no hostname or answer data anywhere in dataLayer, and every event is clean', !JSON.stringify(r.w.dataLayer).includes('secret-camera') && !JSON.stringify(r.w.dataLayer).includes('93.184') && eventsClean(r.w));
  r.w.close();
}

(async () => {
  console.log('Pages in tools/: ' + pages.length + ' (' + Object.keys(navCategory).length + ' in nav.js, ' + Object.keys(retired).length + ' redirected by _redirects)');
  check('nav.js does not list a page that production redirects', Object.keys(retired).every((p) => !navCategory['/tools/' + p.replace(/\.html$/, '')]));
  check('every page in tools/ is either in nav.js or redirected by _redirects', pages.every((p) => navCategory['/tools/' + p.replace(/\.html$/, '')] || retired[p]), pages.filter((p) => !navCategory['/tools/' + p.replace(/\.html$/, '')] && !retired[p]).join(','));
  for (const p of pages) { try { await genericPage(p); } catch (e) { check(p + ': harness error', false, String(e && e.stack || e)); } }
  try { await ampHour(); } catch (e) { check('amp-hour harness error', false, String(e && e.stack || e)); }
  try { await dns(); } catch (e) { check('dns harness error', false, String(e && e.stack || e)); }
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  if (failed) { console.log('Failed: ' + failures.join('; ')); process.exit(1); }
  process.exit(0);
})();
