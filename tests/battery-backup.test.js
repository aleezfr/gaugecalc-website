#!/usr/bin/env node
'use strict';
/*
 * Battery Backup Calculator: input validation and unchanged results for valid input.
 *
 *   node tests/battery-backup.test.js
 *
 * No dependencies. The page's inline script runs in a vm against a small fake
 * DOM, so the real code in tools/battery-backup-calculator.html is what is tested.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'tools', 'battery-backup-calculator.html'), 'utf8');
const scripts = html.match(/<script>[\s\S]*?<\/script>/g).map((s) => s.slice(8, -9));
const code = scripts.filter((s) => s.includes('function calculate()')).pop();
assert.ok(code, 'calculator script not found');

const INPUTS = ['standbyMa', 'standbyHours', 'alarmMa', 'alarmMinutes', 'agingFactor'];
const OUT = ['resultAh', 'rStandby', 'rAlarm', 'rSubtotal', 'rBattery'];
const IDS = INPUTS.concat(INPUTS.map((i) => i + 'Error'), OUT, ['voltage', 'year']);
const DASH = '—';

function load() {
  const els = {};
  IDS.forEach((id) => {
    const attrs = {};
    els[id] = {
      id, value: '', textContent: '', style: { display: '' }, attrs,
      addEventListener() {}, setAttribute(k, v) { attrs[k] = v; }, removeAttribute(k) { delete attrs[k]; },
    };
  });
  const start = { standbyMa: '200', standbyHours: '24', alarmMa: '600', alarmMinutes: '5', agingFactor: '20', voltage: '12' };
  Object.keys(start).forEach((k) => { els[k].value = start[k]; });
  INPUTS.forEach((i) => { els[i + 'Error'].style.display = 'none'; });
  const ctx = { document: { getElementById: (id) => els[id] }, Math, Number, parseFloat, String, Array, Infinity };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return { els, calc: () => ctx.calculate() };
}

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { failed++; console.log('FAIL  ' + name + '\n      ' + e.message); }
}
const fmt = (n, d = 2) => n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: d });
const SIZES = [4, 5, 7, 9, 12, 18, 26, 33, 35, 55, 75, 100];
// The formula exactly as it was before validation was added.
function reference(sMa, sH, aMa, aMin, agingPct, v) {
  const standbyAh = (sMa / 1000) * sH;
  const alarmAh = (aMa / 1000) * (aMin / 60);
  const subtotal = standbyAh + alarmAh;
  const finalAh = subtotal * (1 + agingPct / 100);
  const size = SIZES.find((s) => finalAh <= s);
  return {
    resultAh: fmt(finalAh, finalAh < 10 ? 2 : 1),
    rStandby: fmt(standbyAh) + ' Ah',
    rAlarm: fmt(alarmAh) + ' Ah',
    rSubtotal: fmt(subtotal) + ' Ah',
    rBattery: (size ? size + ' Ah' : Math.ceil(finalAh / 25) * 25 + ' Ah (or bank multiple batteries)') + ' @ ' + v + 'V',
  };
}
function set(page, vals) { Object.keys(vals).forEach((k) => { page.els[k].value = String(vals[k]); }); }
function outputs(page) { const o = {}; OUT.forEach((k) => { o[k] = page.els[k].textContent; }); return o; }

test('default values give the documented result and no messages', () => {
  const p = load(); p.calc();
  assert.deepStrictEqual(outputs(p), reference(200, 24, 600, 5, 20, 12));
  INPUTS.forEach((f) => {
    assert.strictEqual(p.els[f + 'Error'].style.display, 'none');
    assert.ok(!('aria-invalid' in p.els[f].attrs));
  });
});

test('valid inputs match the original formula (including zero and decimals)', () => {
  const cases = [[200, 24, 600, 5, 20, 12], [0, 24, 600, 5, 20, 12], [200, 0, 600, 5, 20, 24], [200, 24, 0, 5, 20, 12],
    [200, 24, 600, 0, 20, 12], [200, 24, 600, 5, 0, 12], [0, 0, 0, 0, 0, 12], [1500.5, 72, 2500, 15, 25, 24],
    [50000, 100, 9000, 90, 100, 24], [3.5, 0.5, 10.25, 2.5, 33.3, 12]];
  cases.forEach((c) => {
    const p = load();
    set(p, { standbyMa: c[0], standbyHours: c[1], alarmMa: c[2], alarmMinutes: c[3], agingFactor: c[4], voltage: c[5] });
    p.calc();
    assert.deepStrictEqual(outputs(p), reference.apply(null, c), JSON.stringify(c));
    INPUTS.forEach((f) => assert.strictEqual(p.els[f + 'Error'].style.display, 'none', f));
  });
});

test('zero is accepted for every field', () => {
  INPUTS.forEach((f) => {
    const p = load(); set(p, { [f]: 0 }); p.calc();
    assert.strictEqual(p.els[f + 'Error'].style.display, 'none', f);
    assert.notStrictEqual(p.els.resultAh.textContent, DASH, f);
  });
});

const BAD = ['', '   ', '-1', '-0.5', 'abc', 'NaN', 'Infinity', '-Infinity', '1e999', '1,5'];
test('every field rejects blank, negative and non-finite values: message, no result', () => {
  INPUTS.forEach((f) => BAD.forEach((v) => {
    const p = load(); p.calc(); set(p, { [f]: v }); p.calc();
    assert.strictEqual(p.els[f + 'Error'].style.display, 'block', f + ' [' + v + ']');
    assert.ok(p.els[f + 'Error'].textContent.length > 10, f + ' message');
    assert.strictEqual(p.els[f].attrs['aria-invalid'], 'true', f);
    OUT.forEach((o) => assert.strictEqual(p.els[o].textContent, DASH, f + ' [' + v + '] ' + o));
    INPUTS.filter((x) => x !== f).forEach((x) => assert.strictEqual(p.els[x + 'Error'].style.display, 'none', 'other field ' + x));
  }));
});

test('aging factor above 100 is rejected (the field is limited to 0-100)', () => {
  const p = load(); set(p, { agingFactor: 101 }); p.calc();
  assert.strictEqual(p.els.agingFactorError.style.display, 'block');
  assert.strictEqual(p.els.resultAh.textContent, DASH);
  set(p, { agingFactor: 100 }); p.calc();
  assert.strictEqual(p.els.agingFactorError.style.display, 'none');
});

test('fixing the value clears the message and brings the result back', () => {
  const p = load(); set(p, { alarmMa: '-3' }); p.calc();
  assert.strictEqual(p.els.resultAh.textContent, DASH);
  set(p, { alarmMa: '600' }); p.calc();
  assert.strictEqual(p.els.alarmMaError.style.display, 'none');
  assert.strictEqual(p.els.alarmMaError.textContent, '');
  assert.ok(!('aria-invalid' in p.els.alarmMa.attrs));
  assert.deepStrictEqual(outputs(p), reference(200, 24, 600, 5, 20, 12));
});

test('several invalid fields are all flagged at once', () => {
  const p = load(); set(p, { standbyMa: '', alarmMinutes: '-2' }); p.calc();
  assert.strictEqual(p.els.standbyMaError.style.display, 'block');
  assert.strictEqual(p.els.alarmMinutesError.style.display, 'block');
  assert.strictEqual(p.els.standbyHoursError.style.display, 'none');
});

test('markup: every input has an alert message element it points to', () => {
  INPUTS.forEach((f) => {
    assert.ok(new RegExp('<input[^>]*id="' + f + '"[^>]*aria-describedby="' + f + 'Error"').test(html), f);
    assert.ok(html.includes('<p class="field-error" id="' + f + 'Error" role="alert" style="display:none;"></p>'), f);
  });
});

console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
