#!/usr/bin/env node
'use strict';
/*
 * Voltage Drop Calculator page: unchanged results, and the SEO markup.
 *
 *   node tests/voltage-drop.test.js
 *
 * No dependencies. The calculation part runs the page's own engine (the code
 * before the DOM wiring) in a vm, so the numbers printed in the page's worked
 * examples and FAQ are checked against the real formulas.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'tools', 'voltage-drop-calculator.html'), 'utf8');

const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { failed++; console.log('FAIL  ' + name + '\n      ' + e.message); }
}
const close = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, (msg || '') + ' ' + a + ' is not within ' + eps + ' of ' + b);

/* ---------- engine (no DOM) ---------- */
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const main = scripts.filter((s) => s.includes('CONDUCTOR_DATA')).pop();
const body = main.slice(main.indexOf("document.getElementById('year')"));
const engineSrc = body.slice(body.indexOf('\n') + 1, body.indexOf('var elecModeToggle'));
const ctx = { console: { assert() {}, log() {}, warn() {}, error() {} }, Math, Number, Object, Array, String, isFinite, parseFloat, Error };
vm.createContext(ctx);
vm.runInContext(engineSrc, ctx);
// The page formats numbers with the visitor's locale; fix it to en-US so the checks do not depend on this machine.
vm.runInContext('Number.prototype.toLocaleString = function (l, o) { return new Intl.NumberFormat("en-US", o).format(this); };', ctx);
const fmt = (n, d) => ctx.fmtNum(n, d);
const T9 = vm.runInContext('CONDUCTOR_DATA.ac.necTable9', ctx);
const dc = (p) => ctx.calculateDCVoltageDrop(p);

test('DC worked examples on the page are unchanged', () => {
  const e1 = dc({ vSource: 12, current: 0.5, lengthFt: 150, rPerFt: 6.385 / 1000 });
  close(e1.vDrop, 0.9577, 0.0005); close(e1.vEnd, 11.04, 0.005); close(e1.dropPercent, 7.98, 0.005);
  const e2 = dc({ vSource: 24, current: 1, lengthFt: 250, rPerFt: 4.016 / 1000 });
  close(e2.vDrop, 2.008, 0.0005); close(e2.vEnd, 21.99, 0.005); close(e2.dropPercent, 8.37, 0.005);
});

test('AWG resistance values are unchanged', () => {
  const t = vm.runInContext('CONDUCTOR_DATA.awg.copper', ctx);
  const v = t.values || t;
  close(v['18'], 6.385, 1e-9); close(v['16'], 4.016, 1e-9); close(v['14'], 2.525, 1e-9); close(v['12'], 1.588, 1e-9);
});

const ac1 = (v, i, l, size, conduit, pf) => { const r = T9.copper[conduit].values[size]; return ctx.calculateACSinglePhaseVoltageDrop({ vSource: v, current: i, lengthFt: l, r: r.R / 1000, x: r.X / 1000, pf }); };
const ac3 = (v, i, l, size, conduit, pf) => { const r = T9.copper[conduit].values[size]; return ctx.calculateACThreePhaseVoltageDrop({ vLL: v, current: i, lengthFt: l, r: r.R / 1000, x: r.X / 1000, pf }); };

/* Worked examples: everything is read from the example's own heading, intro line and table. */
const plainText = (s) => s.replace(/<[^>]+>/g, '').replace(/&times;/g, '×').replace(/&radic;/g, '√').replace(/&minus;/g, '−')
  .replace(/&sup2;/g, '²').replace(/&deg;/g, '°').replace(/&mdash;/g, '—').replace(/&nbsp;/g, ' ').replace(/&Omega;/g, 'Ω')
  .replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
function exampleSection(n) {
  const start = html.indexOf('<h3>Example ' + n + ' &mdash;');
  assert.ok(start >= 0, 'Example ' + n + ' heading');
  const rest = html.slice(start + 5);
  const end = rest.search(/<h[23]>/);
  const block = html.slice(start, start + 5 + end);
  const intro = /<\/h3>\s*<p>([\s\S]*?)<\/p>/.exec(block);
  const table = /<table>([\s\S]*?)<\/table>/.exec(block);
  assert.ok(intro && table, 'Example ' + n + ' intro and table');
  const rows = {};
  [...table[1].matchAll(/<tr><td>([\s\S]*?)<\/td><td>([\s\S]*?)<\/td><\/tr>/g)].forEach((m) => { rows[plainText(m[1])] = plainText(m[2]); });
  return { intro: plainText(intro[1]), rows };
}
const num = (re, text) => { const m = re.exec(text); assert.ok(m, String(re) + ' in: ' + text); return parseFloat(m[1]); };

test('Example 3 table (240 V single-phase): inputs from its intro, every figure from its table', () => {
  const ex = exampleSection(3);
  const v = num(/(\d+(?:\.\d+)?)V AC supply/, ex.intro), i = num(/, (\d+(?:\.\d+)?)A,/, ex.intro), l = num(/(\d+) ft one-way/, ex.intro);
  const R = num(/R = (\d+(?:\.\d+)?)/, ex.intro), X = num(/X = (\d+(?:\.\d+)?)/, ex.intro), pf = num(/power factor (\d+(?:\.\d+)?)/, ex.intro);
  assert.deepStrictEqual([v, i, l, R, X, pf], [240, 30, 100, 1.2, 0.05, 0.9]);
  assert.ok(/10 AWG copper in PVC conduit/.test(ex.intro));
  const r = ctx.calculateACSinglePhaseVoltageDrop({ vSource: v, current: i, lengthFt: l, r: R / 1000, x: X / 1000, pf });
  const ze = R * pf + X * Math.sqrt(1 - pf * pf);
  assert.strictEqual(ex.rows['Effective impedance Ze'].split('= ').pop(), fmt(ze, 3) + ' Ω/1000 ft');
  assert.strictEqual(ex.rows['Voltage drop'].split('= ').pop(), fmt(r.vDrop, 2) + ' V');
  assert.strictEqual(ex.rows['Voltage at load'].split('= ').pop(), fmt(r.vEnd, 2) + ' V');
  assert.strictEqual(ex.rows['Drop percentage'].split('= ').pop(), fmt(r.dropPercent, 1) + '%');
  assert.ok(/^PASS against the 10% allowable drop/.test(ex.rows['Status']) && r.dropPercent <= 10);
  // the arithmetic printed in the table, with its own rounded Ze, gives the printed drop
  close(2 * i * l * parseFloat(fmt(ze, 3)) / 1000, parseFloat(fmt(r.vDrop, 2)), 0.005);
  // independent of the page's engine: drop from the formula, then percent and end voltage from their definitions
  const drop = 2 * i * l * ze / 1000;
  assert.strictEqual(ex.rows['Voltage drop'].split('= ').pop(), fmt(drop, 2) + ' V');
  assert.strictEqual(ex.rows['Drop percentage'].split('= ').pop(), fmt(drop / v * 100, 1) + '%');
  assert.strictEqual(ex.rows['Voltage at load'].split('= ').pop(), fmt(v - drop, 2) + ' V');
  assert.deepStrictEqual([fmt(drop / v * 100, 1), fmt(v - drop, 2)], [fmt(r.dropPercent, 1), fmt(r.vEnd, 2)]);
  assert.deepStrictEqual([T9.copper.pvc.values['10'].R, T9.copper.pvc.values['10'].X], [R, X]);
});
test('Example 4 table (208 V three-phase): inputs from its intro, every figure from its table', () => {
  const ex = exampleSection(4);
  const v = num(/(\d+(?:\.\d+)?)V line-to-line/, ex.intro), i = num(/, (\d+(?:\.\d+)?)A,/, ex.intro), l = num(/(\d+) ft one-way/, ex.intro);
  const R = num(/R = (\d+(?:\.\d+)?)/, ex.intro), X = num(/X = (\d+(?:\.\d+)?)/, ex.intro), pf = num(/power factor (\d+(?:\.\d+)?)/, ex.intro);
  assert.deepStrictEqual([v, i, l, R, X, pf], [208, 50, 150, 0.49, 0.064, 0.9]);
  assert.ok(/6 AWG copper in steel conduit/.test(ex.intro));
  const r = ctx.calculateACThreePhaseVoltageDrop({ vLL: v, current: i, lengthFt: l, r: R / 1000, x: X / 1000, pf });
  const ze = R * pf + X * Math.sqrt(1 - pf * pf);
  assert.strictEqual(ex.rows['Effective impedance Ze'].split('= ').pop(), fmt(ze, 3) + ' Ω/1000 ft');
  assert.strictEqual(ex.rows['Voltage drop'].split('= ').pop(), fmt(r.vDrop, 2) + ' V');
  assert.strictEqual(ex.rows['Voltage at load'].split('= ').pop(), fmt(r.vEnd, 2) + ' V');
  assert.strictEqual(ex.rows['Drop percentage'].split('= ').pop(), fmt(r.dropPercent, 1) + '%');
  assert.ok(/^PASS against the 10% allowable drop/.test(ex.rows['Status']) && r.dropPercent <= 10);
  close(Math.sqrt(3) * i * l * parseFloat(fmt(ze, 3)) / 1000, parseFloat(fmt(r.vDrop, 2)), 0.005);
  // independent of the page's engine: drop from the formula, then percent and end voltage from their definitions
  const drop = Math.sqrt(3) * i * l * ze / 1000;
  assert.strictEqual(ex.rows['Voltage drop'].split('= ').pop(), fmt(drop, 2) + ' V');
  assert.strictEqual(ex.rows['Drop percentage'].split('= ').pop(), fmt(drop / v * 100, 1) + '%');
  assert.strictEqual(ex.rows['Voltage at load'].split('= ').pop(), fmt(v - drop, 2) + ' V');
  assert.deepStrictEqual([fmt(drop / v * 100, 1), fmt(v - drop, 2)], [fmt(r.dropPercent, 1), fmt(r.vEnd, 2)]);
  assert.deepStrictEqual([T9.copper.steel.values['6'].R, T9.copper.steel.values['6'].X], [R, X]);
});
test('the example steps use the printed formula: 3-phase uses sqrt(3), single-phase uses 2', () => {
  assert.ok(/^2 × 30A × 100 ft × 1\.102 \/ 1000 = 6\.61 V$/.test(exampleSection(3).rows['Voltage drop']));
  assert.ok(/^√3 × 50A × 150 ft × 0\.469 \/ 1000 = 6\.09 V$/.test(exampleSection(4).rows['Voltage drop']));
});

/* Display rounding: the page's own fmtNum (the function behind every result field). */
test('display rounding: volts 2 decimals, percent 1 decimal, impedance 4 decimals', () => {
  assert.strictEqual(fmt(6.61076696830622, 2), '6.61');
  assert.strictEqual(fmt(233.38923303169378, 2), '233.39');
  assert.strictEqual(fmt(2.7544862367942584, 1), '2.8');
  assert.strictEqual(fmt(2.928437547561085, 1), '2.9');
  assert.strictEqual(fmt(0.2203589, 4), '0.2204');  // "Effective loop impedance" of Example 3
  assert.strictEqual(fmt(0.1218, 4), '0.1218');     // ... of Example 4
});
test('display formatting: trailing zeros dropped, thousands separated, halves round up', () => {
  assert.strictEqual(fmt(6.1, 2), '6.1');
  assert.strictEqual(fmt(5, 2), '5');
  assert.strictEqual(fmt(3108.8, 1), '3,108.8');
  assert.strictEqual(fmt(1234567.891, 2), '1,234,567.89');
  assert.strictEqual(fmt(0.125, 2), '0.13');
  assert.strictEqual(fmt(0, 2), '0');
  assert.strictEqual(fmt(6.385, 4), '6.385');
});
test('the DC examples shown on the page round the same way', () => {
  const e1 = dc({ vSource: 12, current: 0.5, lengthFt: 150, rPerFt: 6.385 / 1000 });
  assert.deepStrictEqual([fmt(e1.vDrop, 3), fmt(e1.vEnd, 2), fmt(e1.dropPercent, 2)], ['0.958', '11.04', '7.98']);
  const e2 = dc({ vSource: 24, current: 1, lengthFt: 250, rPerFt: 4.016 / 1000 });
  assert.deepStrictEqual([fmt(e2.vDrop, 3), fmt(e2.vEnd, 2), fmt(e2.dropPercent, 2)], ['2.008', '21.99', '8.37']);
});

/* mm² is a DC-only feature: stated on the page, and enforced in the page's code. */
test('mm² DC-only limit is explained in the mm² section and in the FAQ', () => {
  const sec = html.slice(html.indexOf('<h3>Voltage drop with mm&sup2; cable</h3>'));
  const para = plainText(sec.slice(0, sec.indexOf('</p>')));
  assert.ok(/DC voltage drop, maximum cable length and thinnest passing size all work with mm²/.test(para), para);
  assert.ok(/AC mode is AWG-only/.test(para) && /not calculated here/.test(para), para);
  assert.ok(/not converted from AWG/.test(plainText(html.slice(html.indexOf('<h3>Can I calculate voltage drop for mm&sup2; cable?</h3>')))));
  const faq = ld[2].mainEntity.find((q) => /mm² cable/.test(q.name));
  assert.ok(faq && /^Yes, in DC mode\./.test(faq.acceptedAnswer.text) && /AC mode is AWG-only/.test(faq.acceptedAnswer.text));
});
test('mm² and custom resistance are locked out when an AC mode is selected (page code)', () => {
  assert.ok(main.includes("if (b.dataset.value === 'mm2' || b.dataset.value === 'custom') {"));
  assert.ok(main.includes('b.disabled = isAc;'));
  assert.ok(main.includes("if (isAc && conductorSystem !== 'awg') {"));
});
test('Table 9 values quoted in the page match the data', () => {
  assert.deepStrictEqual([T9.copper.pvc.values['10'].R, T9.copper.pvc.values['10'].X], [1.2, 0.05]);
  assert.deepStrictEqual([T9.copper.steel.values['6'].R, T9.copper.steel.values['6'].X], [0.49, 0.064]);
});
test('three-phase / single-phase ratio is sqrt(3)/2 at PF 1', () => {
  const a = ac1(480, 20, 100, '8', 'pvc', 1), b = ac3(480, 20, 100, '8', 'pvc', 1);
  close(b.vDrop / a.vDrop, Math.sqrt(3) / 2, 1e-12);
});

/* ---------- SEO markup ---------- */
const one = (re) => { const m = re.exec(html); assert.ok(m, String(re)); return m[1]; };
const title = one(/<title>([^<]*)<\/title>/);
const desc = one(/<meta name="description" content="([^"]*)"/);

test('title and description: intent keywords, within length', () => {
  assert.ok(title.length <= 60, 'title ' + title.length);
  assert.ok(/^Voltage Drop Calculator/.test(title));
  assert.ok(/DC/.test(title) && /AC/.test(title) && /3-Phase/.test(title) && /mm²/.test(title));
  assert.ok(desc.length >= 120 && desc.length <= 160, 'description ' + desc.length);
  assert.ok(/single-phase/.test(desc) && /three-phase/.test(desc) && /AWG/.test(desc) && /mm²/.test(desc));
});
test('description states the conductor limit: AWG for AC, AWG or mm² for DC only', () => {
  assert.ok(desc.includes('Enter AWG for AC or AWG/mm² for DC'), desc);
  assert.ok(!/mm²[^.]*(single-phase|three-phase|AC)\b/.test(desc.replace('AWG for AC or AWG/mm² for DC', '')), 'mm² must not be tied to AC');
});
test('canonical, og and twitter tags agree with the title and description', () => {
  assert.strictEqual(one(/<link rel="canonical" href="([^"]*)"/), 'https://gaugecalc.com/tools/voltage-drop-calculator');
  assert.strictEqual(one(/<meta property="og:title" content="([^"]*)"/), title);
  assert.strictEqual(one(/<meta name="twitter:title" content="([^"]*)"/), title);
  assert.strictEqual(one(/<meta property="og:description" content="([^"]*)"/), desc);
  assert.strictEqual(one(/<meta name="twitter:description" content="([^"]*)"/), desc);
  assert.strictEqual(one(/<meta property="og:url" content="([^"]*)"/), 'https://gaugecalc.com/tools/voltage-drop-calculator');
});
test('one h1 and the headings for the supported systems', () => {
  assert.strictEqual((html.match(/<h1[\s>]/g) || []).length, 1);
  ['How voltage drop is calculated', 'DC voltage drop', 'AC voltage drop', 'Single-phase voltage drop (for example 240 V)',
    'Three-phase voltage drop (for example 208 V or 480 V)', 'Voltage drop with mm&sup2; cable', 'Frequently asked questions'
  ].forEach((h) => assert.ok(new RegExp('<h[23]>' + h.replace(/[()]/g, '\\$&') + '</h[23]>').test(html), h));
});

test('structured data parses: SoftwareApplication, BreadcrumbList, FAQPage', () => {
  assert.deepStrictEqual(ld.map((x) => x['@type']), ['SoftwareApplication', 'BreadcrumbList', 'FAQPage']);
});
test('every FAQ question is also visible on the page with the same answer text', () => {
  const faq = ld[2].mainEntity;
  assert.strictEqual(faq.length, 11);
  const plain = (s) => s.replace(/<[^>]+>/g, '').replace(/&times;/g, '×').replace(/&radic;/g, '√').replace(/&minus;/g, '−').replace(/&sup2;/g, '²')
    .replace(/&deg;/g, '°').replace(/&mdash;/g, '—').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  const visible = plain(html.slice(html.indexOf('<h2>Frequently asked questions</h2>'), html.indexOf('<h2>Related tools</h2>')));
  faq.forEach((q) => {
    assert.ok(visible.includes(plain(q.name)), 'question missing: ' + q.name);
    assert.ok(visible.includes(plain(q.acceptedAnswer.text)), 'answer differs: ' + q.name);
  });
});
test('related-tool links point to real calculators', () => {
  const related = html.slice(html.indexOf('<h2>Related tools</h2>'));
  const hrefs = [...related.matchAll(/<a href="([a-z-]+)">/g)].map((m) => m[1]);
  ['poe-budget-calculator', 'battery-backup-calculator', 'amp-hour-calculator', 'cctv-storage-calculator',
    'ip-camera-bandwidth-calculator', 'wire-size-calculator', 'conduit-fill-calculator'].forEach((h) => {
    assert.ok(hrefs.includes(h), h);
    assert.ok(fs.existsSync(path.join(ROOT, 'tools', h + '.html')), h + '.html');
  });
});
test('no executable script was added: inline scripts are only the existing ones', () => {
  assert.strictEqual(scripts.length, 3); // theme, gtag, calculator
});

console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
