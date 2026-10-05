#!/usr/bin/env node
'use strict';
/*
 * Electrical Box Fill Calculator — calculation + page test harness.
 *
 *   node tests/electrical-box-fill.test.js
 *
 * No dependencies. It extracts the calculation engine from the shipped page
 * (between the @@ENGINE_START@@ / @@ENGINE_END@@ markers) and runs it in a
 * sandbox, so the code under test is the code the site serves. Every expected
 * value below is hard-coded from docs/electrical-box-fill-calculator-spec.md
 * (T1-T32, V1-V15) or from the NFPA 70-2026 development record, not derived
 * from the engine.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
const PAGE = path.join(ROOT, 'tools', 'electrical-box-fill-calculator.html');
const html = fs.readFileSync(PAGE, 'utf8');
const m = /\/\* @@ENGINE_START@@ \*\/([\s\S]*?)\/\* @@ENGINE_END@@ \*\//.exec(html);
if (!m) { console.error('Engine markers not found in page'); process.exit(2); }
const BF = vm.runInNewContext(m[1] + ';BoxFill');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; }
  catch (e) { failed++; console.log('FAIL  ' + name + '\n      ' + String(e.message).split('\n').join('\n      ')); }
}
const eq = assert.strictEqual;
const deq = (a, b, msg) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), msg); // cross-realm safe deep equality

/* ---------- builders ---------- */
function raw(o) {
  return Object.assign({ mode: 'check', cables: [], loose: [], yokes: [], terminals: [], clamp: false, stud: false, hickey: false,
    box: { type: 'dev-3.5', custom: '', addon: '0' } }, o || {});
}
const cond = (size, count) => ({ kind: 'cond', size: String(size), count: String(count) });
const egc = (size, count) => ({ kind: 'egc', size: String(size), count: String(count) });
const yoke = (size, qty, gangs) => ({ size: String(size), qty: String(qty == null ? 1 : qty), gangs: String(gangs == null ? 1 : gangs) });
const cable = (preset, qty, handling) => ({ preset: preset, qty: String(qty), handling: handling || 'terminate' });
const term = (size, count) => ({ size: String(size), count: String(count == null ? 1 : count) });
const box = (type, addon) => ({ type: type, custom: '', addon: addon == null ? '0' : String(addon) });
const custom = (vol, addon) => ({ type: 'custom', custom: String(vol), addon: addon == null ? '0' : String(addon) });
function ev(o) {
  const n = BF.normalize(raw(o));
  assert.ok(n.ok, 'unexpected validation errors: ' + JSON.stringify(n.errors));
  return BF.evaluate(n.model);
}
const R = (o) => BF.fmt(ev(o).requiredUnits);
const ids = (boxes) => boxes.map((b) => b.id);

/* ---------- T1-T32 ---------- */
test('T1 single size with device: 14.00; exact fit in 3x2x2-3/4; short in 3x2x2-1/2', () => {
  const o = { loose: [cond(14, 4), egc(14, 2)], yokes: [yoke(14)] };
  eq(R(o), '14.00');
  let r = ev(Object.assign({}, o, { box: box('dev-2.75') }));
  eq(r.check.pass, true); eq(BF.fmt(r.check.remainingUnits), '0.00');
  r = ev(Object.assign({}, o, { box: box('dev-2.5') }));
  eq(r.check.pass, false); eq(BF.fmt(r.check.shortfallUnits), '1.50');
  eq(r.min.smallestVolume, 140000); assert.ok(ids(r.min.smallestBoxes).includes('dev-2.75'));
});
test('T2 receptacle on two 12/2 cables: 15.75', () => {
  const o = { cables: [cable('12/2', 2)], yokes: [yoke(12)] };
  eq(R(o), '15.75');
  let r = ev(Object.assign({}, o, { box: box('hdy-2.125') }));
  eq(r.check.pass, false); eq(BF.fmt(r.check.shortfallUnits), '1.25');
  r = ev(Object.assign({}, o, { box: box('dev-3.5') }));
  eq(r.check.pass, true); eq(BF.fmt(r.check.remainingUnits), '2.25');
  eq(r.min.smallestVolume, 180000); assert.ok(ids(r.min.smallestBoxes).includes('dev-3.5'));
});
test('T3 exact fit: 7 x #14 = 14.00 in 14.0 box passes at 100%', () => {
  const r = ev({ loose: [cond(14, 7)], box: box('dev-2.75') });
  eq(BF.fmt(r.requiredUnits), '14.00'); eq(r.check.pass, true); eq(r.check.fillPct, 100);
});
test('T4 mixed AWG: 17.50, passes in 18.0 with 0.50 left', () => {
  const r = ev({ loose: [cond(12, 3), cond(14, 2), egc(12, 2)], yokes: [yoke(12)] });
  eq(BF.fmt(r.requiredUnits), '17.50'); eq(BF.fmt(r.check.remainingUnits), '0.50'); eq(r.check.pass, true);
});
test('T5 clamp: 18.00, one allowance regardless of number, exact fit in 18.0', () => {
  const r = ev({ cables: [cable('12/2', 2)], yokes: [yoke(12)], clamp: true });
  eq(BF.fmt(r.requiredUnits), '18.00'); eq(r.check.pass, true); eq(BF.fmt(r.check.remainingUnits), '0.00');
  const clampLines = r.calc.lines.filter((l) => l.cat === 'clamp');
  eq(clampLines.length, 1); eq(BF.fmt(clampLines[0].volumeUnits), '2.25');
});
test('T6 junction box, three 12/3: 22.50; 24.0 is the smallest volume; 4x2-1/8 square passes at 74.3%', () => {
  const o = { cables: [cable('12/3', 3)] };
  const r = ev(Object.assign({}, o, { box: box('sq4-2.125') }));
  eq(BF.fmt(r.requiredUnits), '22.50'); eq(r.check.pass, true); eq(r.check.fillPct, 74.3);
  eq(r.min.smallestVolume, 240000); deq(ids(r.min.smallestBoxes), ['fd-multi']);
  const fam = {}; r.min.perFamily.forEach((p) => { fam[p.family.id] = p.box && p.box.id; });
  eq(fam.square411, 'sq411-1.25'); eq(fam.square4, 'sq4-2.125'); eq(fam.device, null);
});
test('T7 five grounds: 7.3125', () => { eq(R({ loose: [cond(12, 2), egc(12, 5)] }), '7.3125'); });
test('T8 eight grounds: 8.00', () => { eq(R({ loose: [cond(14, 2), egc(14, 8)] }), '8.00'); });
test('T9 luminaire stud: 12.00', () => { eq(R({ loose: [cond(14, 4), egc(14, 2)], stud: true }), '12.00'); });
test('T10 stud + hickey = two allowances: 14.00', () => { eq(R({ loose: [cond(14, 4), egc(14, 2)], stud: true, hickey: true }), '14.00'); });
test('T11 wide device, 2 gangs: 20.25; smallest volume 21.0', () => {
  const r = ev({ loose: [cond(12, 4), egc(12, 2)], yokes: [yoke(12, 1, 2)] });
  eq(BF.fmt(r.requiredUnits), '20.25'); eq(r.min.smallestVolume, 210000);
  eq(BF.fmt(r.calc.lines.filter((l) => l.cat === 'devices')[0].volumeUnits), '9.00');
});
test('T12 two yokes, mixed sizes: 23.50; smallest volume 24.0', () => {
  const r = ev({ loose: [cond(12, 3), cond(14, 3), egc(12, 3)], yokes: [yoke(12), yoke(14)] });
  eq(BF.fmt(r.requiredUnits), '23.50'); eq(r.min.smallestVolume, 240000);
});
test('T13 just over: 31.50; 4x2-1/8 square is short by 1.20; smallest volume 42.0', () => {
  const o = { loose: [cond(12, 12), egc(12, 3)], clamp: true };
  const r = ev(Object.assign({}, o, { box: box('sq4-2.125') }));
  eq(BF.fmt(r.requiredUnits), '31.50'); eq(r.check.pass, false); eq(BF.fmt(r.check.shortfallUnits), '1.20'); eq(r.min.smallestVolume, 420000);
});
test('T14 13 x #12 = 29.25: passes in 30.3 with 1.05 left; smallest volume 29.5', () => {
  const r = ev({ loose: [cond(12, 13)], box: box('sq4-2.125') });
  eq(BF.fmt(r.requiredUnits), '29.25'); eq(r.check.pass, true); eq(BF.fmt(r.check.remainingUnits), '1.05'); eq(r.min.smallestVolume, 295000);
});
test('T15 looped 14/2: 10.00; smallest volume 10.0', () => {
  const r = ev({ cables: [cable('14/2', 1, 'loop')] });
  eq(BF.fmt(r.requiredUnits), '10.00'); eq(r.min.smallestVolume, 100000);
  eq(r.calc.lines.filter((l) => l.cat === 'loops')[0].mult, '×2');
});
test('T16 extreme: 500 x #12 = 1125.00; no standard box; no crash', () => {
  const r = ev({ loose: [cond(12, 200), cond(12, 200), cond(12, 100)] });
  eq(BF.fmt(r.requiredUnits), '1125.00'); eq(r.min.noFit, true);
  assert.ok(!/NaN|Infinity|undefined/.test(JSON.stringify(r, (k, v) => (typeof v === 'number' && !isFinite(v) ? 'BAD' : v))));
});
test('T17 18 AWG: 6.00; smallest volume 7.5', () => {
  const r = ev({ loose: [cond(18, 3), egc(18, 1)] });
  eq(BF.fmt(r.requiredUnits), '6.00'); eq(r.min.smallestVolume, 75000);
});
test('T18 #6 with clamp uses the largest conductor (#6): 22.00', () => {
  const r = ev({ loose: [cond(6, 2), cond(12, 2), egc(10, 1)], clamp: true });
  eq(BF.fmt(r.requiredUnits), '22.00'); eq(BF.fmt(r.calc.lines.filter((l) => l.cat === 'clamp')[0].volumeUnits), '5.00'); eq(r.min.smallestVolume, 240000);
});
test('T19 terminal block on 12/2 cables: 13.50', () => {
  const r = ev({ cables: [cable('12/2', 2)], terminals: [term(12)] });
  eq(BF.fmt(r.requiredUnits), '13.50'); eq(BF.fmt(r.calc.lines.filter((l) => l.cat === 'terminals')[0].volumeUnits), '2.25');
});
test('T20 terminal block sized on the largest terminated conductor: 14.00', () => {
  eq(R({ loose: [cond(10, 3), cond(14, 2)], terminals: [term(10)] }), '14.00');
});
test('T21 grounding: nine #12 grounds = 5.0625 (quarter rule); the rejected full-allowance-per-four rule is never produced', () => {
  const r = ev({ loose: [cond(12, 2), egc(12, 9)] });
  eq(BF.fmt(r.requiredUnits), '9.5625');
  const egcSum = r.calc.lines.filter((l) => l.cat === 'grounds').reduce((a, l) => a + l.volumeUnits, 0);
  eq(BF.fmt(egcSum), '5.0625');
  assert.notStrictEqual(egcSum, 67500, 'rejected variant (6.75) must never be produced');
  assert.notStrictEqual(r.requiredUnits, 112500);
  for (let n = 1; n <= 60; n++) {
    const x = ev({ loose: [cond(12, 1), egc(12, n)] });
    const g = x.calc.lines.filter((l) => l.cat === 'grounds').reduce((a, l) => a + l.volumeUnits, 0);
    const expected = 22500 + Math.max(0, n - 4) * 5625;
    eq(g, expected, 'ground volume for n=' + n);
    if (n > 4 && (n - 4) % 4 !== 0) assert.notStrictEqual(g, 22500 + Math.ceil((n - 4) / 4) * 22500, 'rejected formula for n=' + n);
  }
});
test('T22 twelve #14 grounds only: 6.00', () => { eq(R({ loose: [egc(14, 12)] }), '6.00'); });
test('T23 four grounds = one allowance; the fifth adds a quarter', () => {
  eq(R({ loose: [egc(12, 4)] }), '2.25'); eq(R({ loose: [egc(12, 5)] }), '2.8125');
});
test('T24 two studs are one type: 10.00 (one allowance)', () => { eq(R({ loose: [cond(14, 4)], stud: true }), '10.00'); });
test('T25 GFCI is not special: yoke stays at two allowances (4.50)', () => {
  const r = ev({ cables: [cable('12/2', 2)], yokes: [yoke(12)] });
  eq(BF.fmt(r.requiredUnits), '15.75'); eq(BF.fmt(r.calc.lines.filter((l) => l.cat === 'devices')[0].volumeUnits), '4.50');
});
test('T26 wire connectors, locknuts, bushings add nothing', () => {
  const r = ev({ cables: [cable('12/2', 2)] });
  assert.ok(r.calc.notCounted.join(' ').toLowerCase().includes('splicing connectors'));
  assert.ok(r.calc.notCounted.join(' ').toLowerCase().includes('locknuts'));
  const n = BF.normalize(raw({ cables: [cable('12/2', 2)], connectors: 10, locknuts: 5, bushings: 5 }));
  eq(BF.fmt(BF.evaluate(n.model).requiredUnits), R({ cables: [cable('12/2', 2)] }));
});
test('T27 a pigtail never counts, whatever its length (no length input exists)', () => {
  const base = R({ cables: [cable('12/2', 2)] });
  const n = BF.normalize(raw({ cables: [cable('12/2', 2)], pigtails: [{ length: '3' }, { length: '18' }, { length: '48' }] }));
  eq(BF.fmt(BF.evaluate(n.model).requiredUnits), base);
});
test('T28 pass-through run plus terminating cable: 11.25', () => {
  eq(R({ cables: [cable('12/2', 1, 'terminate'), cable('12/2', 1, 'pass')] }), '11.25');
});
test('T29 marked add-on volume adds to capacity: 21.0 + 3.6 = 24.60', () => {
  const r = ev({ cables: [cable('12/2', 2)], box: box('sq4-1.5', '3.6') });
  eq(BF.fmt(r.check.capacityUnits), '24.60');
});
test('T30 looped 12/2: 11.25', () => { eq(R({ cables: [cable('12/2', 1, 'loop')] }), '11.25'); });
test('T31 6 AWG metric value is 81.9 cm3 (not 82.0)', () => { eq(BF.ALLOWANCE_CM3[6], '81.9'); eq(BF.ALLOWANCE[6], 50000); });
test('T32 derived conductors-only capacity equals the NFPA printed columns for all 24 rows', () => {
  const printed = {
    'dev-1.5': [5, 4, 3, 3, 3, 2, 1], 'dev-2': [6, 5, 5, 4, 4, 3, 2], 'dev-2.25': [7, 6, 5, 4, 4, 3, 2], 'dev-2.5': [8, 7, 6, 5, 5, 4, 2],
    'dev-2.75': [9, 8, 7, 6, 5, 4, 2], 'dev-3.5': [12, 10, 9, 8, 7, 6, 3], 'hdy-1.5': [6, 5, 5, 4, 4, 3, 2], 'hdy-1.875': [8, 7, 6, 5, 5, 4, 2],
    'hdy-2.125': [9, 8, 7, 6, 5, 4, 2], 'rnd-1.25': [8, 7, 6, 5, 5, 4, 2], 'rnd-1.5': [10, 8, 7, 6, 6, 5, 3], 'rnd-2.125': [14, 12, 10, 9, 8, 7, 4],
    'sq4-1.25': [12, 10, 9, 8, 7, 6, 3], 'sq4-1.5': [14, 12, 10, 9, 8, 7, 4], 'sq4-2.125': [20, 17, 15, 13, 12, 10, 6],
    'sq411-1.25': [17, 14, 12, 11, 10, 8, 5], 'sq411-1.5': [19, 16, 14, 13, 11, 9, 5], 'sq411-2.125': [28, 24, 21, 18, 16, 14, 8],
    'msn-2.5': [9, 8, 7, 6, 5, 4, 2], 'msn-3.5': [14, 12, 10, 9, 8, 7, 4], 'fs-single': [9, 7, 6, 6, 5, 4, 2], 'fd-single': [12, 10, 9, 8, 7, 6, 3],
    'fs-multi': [12, 10, 9, 8, 7, 6, 3], 'fd-multi': [16, 13, 12, 10, 9, 8, 4]
  };
  eq(BF.BOXES.length, 24);
  BF.BOXES.forEach((b) => {
    const derived = BF.SIZES.map((s) => Math.floor(b.in3 / BF.ALLOWANCE[s]));
    deq(derived, printed[b.id], b.id);
  });
});

/* ---------- NEC data ---------- */
test('Table 314.16(B)(1) allowances', () => {
  const exp = { 18: '1.50', 16: '1.75', 14: '2.00', 12: '2.25', 10: '2.50', 8: '3.00', 6: '5.00' };
  BF.SIZES.forEach((s) => eq(BF.fmt(BF.ALLOWANCE[s]), exp[s]));
  deq(BF.SIZES, [18, 16, 14, 12, 10, 8, 6]);
});
test('Table 314.16(A) volumes', () => {
  const exp = { 'dev-1.5': '7.50', 'dev-2': '10.00', 'dev-2.25': '10.50', 'dev-2.5': '12.50', 'dev-2.75': '14.00', 'dev-3.5': '18.00', 'hdy-1.5': '10.30',
    'hdy-1.875': '13.00', 'hdy-2.125': '14.50', 'rnd-1.25': '12.50', 'rnd-1.5': '15.50', 'rnd-2.125': '21.50', 'sq4-1.25': '18.00', 'sq4-1.5': '21.00',
    'sq4-2.125': '30.30', 'sq411-1.25': '25.50', 'sq411-1.5': '29.50', 'sq411-2.125': '42.00', 'msn-2.5': '14.00', 'msn-3.5': '21.00',
    'fs-single': '13.50', 'fd-single': '18.00', 'fs-multi': '18.00', 'fd-multi': '24.00' };
  BF.BOXES.forEach((b) => eq(BF.fmt(b.in3), exp[b.id], b.id));
});
test('Quarter allowance is an exact integer for every size', () => {
  BF.SIZES.forEach((s) => eq(BF.ALLOWANCE[s] % BF.EGC_EXTRA_DIVISOR, 0));
});
test('Mixed sizes are kept separate (no collapse to the largest wire)', () => {
  const r = ev({ loose: [cond(12, 1), cond(14, 1), cond(18, 1)] });
  eq(BF.fmt(r.requiredUnits), '5.75');
});
test('Exact boundary: required equals capacity passes; one hundredth less fails', () => {
  const o = { loose: [cond(14, 7)] };
  let r = ev(Object.assign({}, o, { box: custom('14') })); eq(r.check.pass, true);
  r = ev(Object.assign({}, o, { box: custom('13.99') })); eq(r.check.pass, false); eq(BF.fmt(r.check.shortfallUnits), '0.01');
});
test('Custom box and add-on', () => {
  const r = ev({ cables: [cable('12/3', 3)], box: custom('22.0') });
  eq(r.check.pass, false); eq(BF.fmt(r.check.shortfallUnits), '0.50');
  const r2 = ev({ cables: [cable('12/3', 3)], box: custom('20', '2.5') });
  eq(r2.check.pass, true); eq(BF.fmt(r2.check.capacityUnits), '22.50'); eq(BF.fmt(r2.check.remainingUnits), '0.00');
});
test('Cable input equals the same conductors entered loose (V9)', () => {
  const a = R({ cables: [cable('12/2', 2)], yokes: [yoke(12)] });
  const b = R({ loose: [cond(12, 4), egc(12, 2)], yokes: [yoke(12)] });
  eq(a, b);
});
test('Custom cable preset', () => {
  const n = BF.normalize(raw({ cables: [{ preset: 'custom', qty: '2', handling: 'terminate', insulated: '3', size: '10', egc: true, egcSize: '12' }] }));
  assert.ok(n.ok);
  const r = BF.evaluate(n.model);
  eq(BF.fmt(r.requiredUnits), '17.25'); // 6 x 2.50 = 15.00, plus one shared #12 ground allowance 2.25
});
test('Check and Minimum modes agree on the requirement (V10)', () => {
  const a = ev({ cables: [cable('12/3', 3)] });
  const b = ev({ cables: [cable('12/3', 3)], mode: 'min' });
  eq(a.requiredUnits, b.requiredUnits); eq(b.check, undefined);
});
test('Minimum box: smaller boxes listed with shortfalls, nearest first', () => {
  const r = ev({ cables: [cable('12/2', 2)], yokes: [yoke(12)], mode: 'min' });
  assert.ok(r.min.smaller.length > 0);
  eq(r.min.smaller[0].box.in3, 155000); eq(BF.fmt(r.min.smaller[0].shortfall), '0.25');
  for (let i = 1; i < r.min.smaller.length; i++) assert.ok(r.min.smaller[i - 1].box.in3 >= r.min.smaller[i].box.in3);
});

/* ---------- validation / behavior (V1-V15) ---------- */
test('V1 empty input needs input, no verdict', () => {
  const r = ev({}); eq(r.status, 'needs-input'); eq(r.check, undefined);
});
test('V2 invalid counts are rejected', () => {
  ['-1', '1.5', 'abc', '1e3', '0x10', ' 5 5', '+3'].forEach((q) => {
    const n = BF.normalize(raw({ cables: [cable('12/2', q)] }));
    eq(n.ok, false, 'qty ' + q);
  });
  eq(BF.normalize(raw({ cables: [cable('12/2', '')] })).ok, true); // empty = 0
});
test('V3 over-limit values are rejected', () => {
  eq(BF.normalize(raw({ cables: [cable('12/2', 51)] })).ok, false);
  eq(BF.normalize(raw({ loose: [cond(12, 201)] })).ok, false);
  eq(BF.normalize(raw({ yokes: [yoke(12, 11, 1)] })).ok, false);
  eq(BF.normalize(raw({ yokes: [yoke(12, 1, 7)] })).ok, false);
  eq(BF.normalize(raw({ yokes: [yoke(12, 1, 0)] })).ok, false);
  eq(BF.normalize(raw({ terminals: [term(12, 21)] })).ok, false);
  const many = []; for (let i = 0; i < 21; i++) many.push(cable('12/2', 1));
  eq(BF.normalize(raw({ cables: many })).ok, false);
});
test('V4 custom volume validation', () => {
  ['0', '-5', 'abc', '5001', '', '1.234', '1e2'].forEach((v) => eq(BF.normalize(raw({ cables: [cable('12/2', 1)], box: custom(v) })).ok, false, 'custom ' + v));
  eq(BF.normalize(raw({ cables: [cable('12/2', 1)], box: custom('22.5') })).ok, true);
  eq(BF.normalize(raw({ cables: [cable('12/2', 1)], box: custom('22.5', '-1') })).ok, false);
  eq(BF.normalize(raw({ cables: [cable('12/2', 1)], box: custom('22.5', '1001') })).ok, false);
  eq(BF.normalize(raw({ cables: [cable('12/2', 1)], box: { type: 'nope', custom: '', addon: '0' } })).ok, false);
});
test('V6 yoke size not among the conductors gives a warning but still computes as selected', () => {
  const r = ev({ loose: [cond(14, 2)], yokes: [yoke(12)] });
  eq(r.calc.warnings.length, 1); eq(BF.fmt(r.requiredUnits), '8.50'); // 2 x 2.00 + yoke 2 x 2.25
});
test('V7 fittings with no conductors need input', () => {
  ['clamp', 'stud', 'hickey'].forEach((k) => { const r = ev(Object.assign({}, { [k]: true })); eq(r.status, 'needs-input'); });
});
test('V8 4 AWG and larger are rejected with a 314.28 notice', () => {
  ['4', '2', '1', '0', '3', '5', '19', 'x', ''].forEach((s) => {
    const n = BF.normalize(raw({ loose: [cond(s, 1)] }));
    eq(n.ok, false, 'size ' + s);
    if (s === '4') assert.ok(n.errors[0].message.includes('314.28'));
  });
  eq(BF.normalize(raw({ yokes: [yoke(4)] })).ok, false);
  eq(BF.normalize(raw({ terminals: [term(2)] })).ok, false);
});
test('Min mode ignores box fields', () => {
  const n = BF.normalize(raw({ mode: 'min', cables: [cable('12/2', 1)], box: { type: 'custom', custom: 'garbage', addon: 'x' } }));
  eq(n.ok, true);
});
test('V14 fuzz: no NaN / Infinity / undefined in any result, results are finite and ordered', () => {
  let seed = 12345; const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  const presets = ['14/2', '14/3', '12/2', '12/3', '10/2', '10/3'], hs = ['terminate', 'pass', 'loop'], sizes = BF.SIZES;
  for (let i = 0; i < 3000; i++) {
    const o = { mode: rnd(2) ? 'min' : 'check', cables: [], loose: [], yokes: [], terminals: [], clamp: !!rnd(2), stud: !!rnd(2), hickey: !!rnd(2),
      box: rnd(4) ? box(BF.BOXES[rnd(BF.BOXES.length)].id, String(rnd(5))) : custom(String(1 + rnd(60)), String(rnd(4))) };
    for (let k = rnd(4); k > 0; k--) o.cables.push(cable(presets[rnd(6)], rnd(6), hs[rnd(3)]));
    for (let k = rnd(3); k > 0; k--) o.loose.push(rnd(2) ? cond(sizes[rnd(7)], rnd(30)) : egc(sizes[rnd(7)], rnd(12)));
    for (let k = rnd(3); k > 0; k--) o.yokes.push(yoke(sizes[rnd(7)], rnd(4), 1 + rnd(3)));
    for (let k = rnd(2); k > 0; k--) o.terminals.push(term(sizes[rnd(7)], rnd(4)));
    const n = BF.normalize(raw(o)); assert.ok(n.ok, JSON.stringify(n.errors));
    const r = BF.evaluate(n.model);
    const text = JSON.stringify(r, (k, v) => (typeof v === 'number' && !isFinite(v) ? 'BAD' : v));
    assert.ok(!/NaN|Infinity|undefined|BAD/.test(text));
    if (r.status === 'ok') {
      assert.ok(Number.isInteger(r.requiredUnits) && r.requiredUnits > 0);
      assert.ok(/^\d+\.\d{2,4}$/.test(BF.fmt(r.requiredUnits)));
      const sum = r.calc.lines.reduce((a, l) => a + l.volumeUnits, 0); eq(sum, r.requiredUnits);
      eq(r.calc.lines[r.calc.lines.length - 1].subtotalUnits, r.requiredUnits);
      if (r.check) eq(r.check.pass, r.requiredUnits <= r.check.capacityUnits);
    }
  }
});
test('Subtotals accumulate line by line', () => {
  const r = ev({ cables: [cable('12/2', 2)], yokes: [yoke(12)], clamp: true });
  let run = 0; r.calc.lines.forEach((l) => { run += l.volumeUnits; eq(l.subtotalUnits, run); });
});

/* ---------- page checks ---------- */
function decode(s) { return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&'); }
test('Page: title, description, canonical, robots, one H1', () => {
  eq(/<title>([^<]*)<\/title>/.exec(html)[1], 'Electrical Box Fill Calculator (NEC 314.16, Free) — GaugeCalc');
  const d = /<meta name="description" content="([^"]*)"/.exec(html)[1]; assert.ok(d.length >= 90 && d.length <= 160);
  eq(/<link rel="canonical" href="([^"]*)"/.exec(html)[1], 'https://gaugecalc.com/tools/electrical-box-fill-calculator');
  assert.ok(!/name="robots"/.test(html));
  eq((html.match(/<h1[ >]/g) || []).length, 1);
  eq((html.match(/<title>/g) || []).length, 1); eq((html.match(/name="description"/g) || []).length, 1); eq((html.match(/rel="canonical"/g) || []).length, 1);
});
test('Page: AdSense loader once with the new publisher id, meta tag once, GA4 once', () => {
  eq((html.match(/adsbygoogle\.js\?client=ca-pub-5945580588007634/g) || []).length, 1);
  eq((html.match(/name="google-adsense-account" content="ca-pub-5945580588007634"/g) || []).length, 1);
  eq((html.match(/G-T2GSLY1JGK/g) || []).length, 2);
  assert.ok(!html.includes('9125815530210447'));
  eq((html.match(/<ins /g) || []).length, 0);
});
test('Page: JSON-LD parses; FAQPage equals the visible FAQ exactly', () => {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((x) => JSON.parse(x[1]));
  eq(blocks.length, 3);
  const types = blocks.map((b) => b['@type']).sort(); deq(types, ['BreadcrumbList', 'FAQPage', 'SoftwareApplication']);
  const faq = blocks.find((b) => b['@type'] === 'FAQPage');
  const after = html.split('<h2>Frequently asked questions</h2>')[1].split('<h2>')[0];
  const vis = [...after.matchAll(/<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/g)].map((x) => [decode(x[1]), decode(x[2])]);
  eq(vis.length, faq.mainEntity.length); assert.ok(vis.length >= 8);
  vis.forEach((v, i) => { eq(faq.mainEntity[i].name, v[0]); eq(faq.mainEntity[i].acceptedAnswer.text, v[1]); });
  assert.ok(!/aggregateRating|review|ratingValue/i.test(JSON.stringify(blocks)));
});
test('Page: static box table matches the engine data', () => {
  const rows = [...html.matchAll(/<tr><td>([^<]*)<\/td><td class="n">([\d.]+)<\/td><td class="n">(\d+)<\/td>((?:<td class="n">\d+<\/td>){7})<\/tr>/g)];
  eq(rows.length, 24);
  rows.forEach((r, i) => {
    const b = BF.BOXES[i]; eq(decode(r[1]), b.label); eq(r[2], BF.fmt(b.in3)); eq(Number(r[3]), b.cm3);
    const caps = [...r[4].matchAll(/>(\d+)</g)].map((x) => Number(x[1]));
    deq(caps, BF.SIZES.map((s) => Math.floor(b.in3 / BF.ALLOWANCE[s])));
  });
});
test('Page: static allowance table matches the engine data', () => {
  BF.SIZES.forEach((s) => {
    assert.ok(html.includes('<tr><td>' + s + ' AWG</td><td>' + BF.fmt(BF.ALLOWANCE[s]) + '</td><td>' + BF.ALLOWANCE_CM3[s] + '</td></tr>'), 'row ' + s);
  });
});
test('Page: no duplicate static ids; no unsafe APIs in page code', () => {
  const idsFound = [...html.matchAll(/\sid="([^"]+)"/g)].map((x) => x[1]);
  const dup = idsFound.filter((x, i) => idsFound.indexOf(x) !== i);
  deq(dup, []);
  const inline = html.split('<script>')[html.split('<script>').length - 1];
  ['eval(', 'new Function', 'document.write', 'innerHTML', 'outerHTML', 'insertAdjacentHTML'].forEach((bad) => assert.ok(!inline.includes(bad), bad));
});
test('Page: internal links resolve', () => {
  const links = [...html.matchAll(/href="([^"#]+)"/g)].map((x) => x[1]).filter((x) => !/^(https?:|mailto:|data:)/.test(x) && !x.startsWith('/') === true || x.startsWith('/'));
  links.forEach((l) => {
    if (/^(https?:|mailto:)/.test(l)) return;
    let p = l.split('?')[0];
    p = p.startsWith('/') ? path.join(ROOT, p) : path.join(ROOT, 'tools', p);
    p = path.normalize(p);
    const ok = fs.existsSync(p) || fs.existsSync(p + '.html') || (p.endsWith(path.sep) && fs.existsSync(path.join(p, 'index.html'))) || fs.existsSync(path.join(p, 'index.html'));
    assert.ok(ok, 'broken link ' + l);
  });
  assert.ok(!/href="[^"]*\.html/.test(html.replace(/https?:[^"]*/g, '')));
});
test('Integration: sitemap, nav, homepage, protection of internal docs', () => {
  const sm = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  eq((sm.match(/electrical-box-fill-calculator/g) || []).length, 1);
  eq((sm.match(/<loc>/g) || []).length, 21);
  assert.ok(!/\.html<\/loc>/.test(sm));
  const nav = fs.readFileSync(path.join(ROOT, 'assets', 'nav.js'), 'utf8');
  eq((nav.match(/\/tools\/electrical-box-fill-calculator/g) || []).length, 1);
  const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.ok(idx.includes('tools/electrical-box-fill-calculator'));
  const ld = JSON.parse(/"@type": "ItemList"[\s\S]*?<\/script>/.test(idx) ? ('{' + /"@type": "ItemList"[\s\S]*?(?=<\/script>)/.exec(idx)[0]) : '{}');
  eq(ld.itemListElement.length, 10);
  ld.itemListElement.forEach((e, i) => eq(e.position, i + 1));
  eq(ld.itemListElement.filter((e) => /electrical-box-fill-calculator$/.test(e.url)).length, 1);
  const hd = fs.readFileSync(path.join(ROOT, '_headers'), 'utf8');
  assert.ok(/\/docs\/\*\s*\n\s+X-Robots-Tag: noindex/.test(hd));
  assert.ok(/\/tests\/\*\s*\n\s+X-Robots-Tag: noindex/.test(hd));
  const rb = fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8');
  assert.ok(/Disallow: \/docs\//.test(rb) && /Disallow: \/tests\//.test(rb));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
