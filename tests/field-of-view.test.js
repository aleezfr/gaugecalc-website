#!/usr/bin/env node
'use strict';
/*
 * Field of View Calculator - distance validation + default-case regression.
 *
 *   node tests/field-of-view.test.js
 *
 * No dependencies. It runs the page's own inline calculator script (the one that
 * defines calculate()) in a vm sandbox against a minimal DOM stub, so the code
 * under test is the code the site serves. Expected values are hard-coded.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const html = fs.readFileSync(path.join(__dirname, '..', 'tools', 'field-of-view-calculator.html'), 'utf8');
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)]
  .filter((m) => !/ld\+json/.test(m[1])).map((m) => m[2]);
const pageSource = scripts.find((s) => /function calculate\(\)/.test(s));
assert.ok(pageSource, 'calculator script not found in page');
// The page formats numbers with the visitor's locale (toLocaleString(undefined, ...)). Pin en-US for the
// run so every expected string below is exact and does not depend on the machine running the tests.
assert.ok(pageSource.includes('toLocaleString(undefined'), 'number formatting call changed; update the test');
const source = pageSource.replace('toLocaleString(undefined', "toLocaleString('en-US'");

const DEFAULTS = {
  sensorFormat: '4.8,3.6', focalLength: '4', customSensorW: '4.8', customSensorH: '3.6',
  resolution: '2592', customRes: '2592', distance: '15'
};

function makeEl(id) {
  const listeners = {};
  const attrs = {};
  let text = '';
  const el = {
    id, value: DEFAULTS[id] === undefined ? '' : DEFAULTS[id], style: {}, dataset: {}, writes: 0,
    get textContent() { return text; },
    set textContent(v) { text = v; el.writes++; },
    classList: { add() {}, remove() {}, contains() { return false; } },
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    fire(type) { (listeners[type] || []).forEach((fn) => fn({})); },
    setAttribute(k, v) { attrs[k] = String(v); },
    removeAttribute(k) { delete attrs[k]; },
    getAttribute(k) { return k in attrs ? attrs[k] : null; },
    click() { el.fire('click'); }
  };
  return el;
}

function load() {
  const els = {};
  const meterBtn = Object.assign(makeEl('btnM'), { dataset: { value: 'm' } });
  const feetBtn = Object.assign(makeEl('btnFt'), { dataset: { value: 'ft' } });
  const document = {
    getElementById(id) { return els[id] || (els[id] = makeEl(id)); },
    querySelectorAll() { return []; }
  };
  els.unitToggle = Object.assign(makeEl('unitToggle'), { querySelectorAll() { return [meterBtn, feetBtn]; } });
  const ctx = vm.createContext({ document, Math, Number, parseFloat, Date, console });
  vm.runInContext(source, ctx);
  const set = (v) => { els.distance.value = v; els.distance.fire('input'); };
  const out = () => ({
    hfov: els.resultHfov.textContent, vfov: els.rVfov.textContent,
    width: els.rSceneWidth.textContent, density: els.rDensity.textContent, classify: els.rClassify.textContent,
    maxId: els.rMaxId.textContent, maxRec: els.rMaxRec.textContent, maxObs: els.rMaxObs.textContent, maxDet: els.rMaxDet.textContent
  });
  const err = () => ({
    text: els.distError.textContent, shown: els.distError.style.display, writes: els.distError.writes,
    invalid: els.distance.getAttribute('aria-invalid')
  });
  return { els, set, out, err, toFeet: () => feetBtn.click(), toMeters: () => meterBtn.click() };
}

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { failed++; console.log('FAIL  ' + name + '\n      ' + String(e.message).split('\n').join('\n      ')); }
}
const noBadNumbers = (o) => Object.values(o).forEach((t) => assert.ok(!/NaN|Infinity|undefined/.test(t), 'bad output: ' + t));
const DEP = ['width', 'density']; // distance-dependent numeric outputs

/* ---------- static page contract ---------- */
test('page wires an accessible distance error (role=alert, aria-describedby)', () => {
  assert.ok(/<input[^>]*id="distance"[^>]*aria-describedby="distError"/.test(html));
  assert.ok(/<p[^>]*class="field-error"[^>]*id="distError"[^>]*role="alert"[^>]*display:none/.test(html));
});
test('DORI thresholds unchanged (250/125/63/25)', () => {
  assert.ok(/density >= 250\) return 'Identification-grade/.test(source));
  assert.ok(/density >= 125\) return 'Recognition-grade/.test(source));
  assert.ok(/density >= 63\) return 'Observation-grade/.test(source));
  assert.ok(/density >= 25\) return 'Detection-grade/.test(source));
});

/* ---------- default regression ---------- */
test('default 4 mm / 2592 px / 15 m: 144 px/m, Recognition, max distances 8.6/17.3/34.3/86.4 m', () => {
  const p = load(); const o = p.out();
  assert.strictEqual(o.hfov, '61.9');
  assert.strictEqual(o.width, '18 m');
  assert.strictEqual(o.density, '144 px/m');
  assert.ok(o.classify.startsWith('Recognition-grade'), o.classify);
  assert.strictEqual(o.maxId, '8.6 m');
  assert.strictEqual(o.maxRec, '17.3 m');
  assert.strictEqual(o.maxObs, '34.3 m');
  assert.strictEqual(o.maxDet, '86.4 m');
  assert.strictEqual(p.err().shown, 'none');
  assert.strictEqual(p.err().invalid, null);
  noBadNumbers(o);
});
test('default value in feet: 15 ft -> 472 px/m, Identification, 18 ft wide, max id 28.3 ft', () => {
  const p = load(); p.toFeet(); const o = p.out();
  assert.strictEqual(o.width, '18 ft');
  assert.strictEqual(o.density, '472 px/m');
  assert.ok(o.classify.startsWith('Identification-grade'), o.classify);
  assert.strictEqual(o.maxId, '28.3 ft');
  assert.strictEqual(o.maxRec, '56.7 ft');
  assert.strictEqual(p.err().invalid, null);
  noBadNumbers(o);
});
test('classification across distances (metric)', () => {
  const p = load();
  [['3', 'Identification-grade'], ['8', 'Identification-grade'], ['30', 'Observation-grade'], ['60', 'Detection-grade'], ['100', 'Below detection grade']]
    .forEach(([d, g]) => { p.set(d); assert.ok(p.out().classify.startsWith(g), d + ' m -> ' + p.out().classify); });
});

/* ---------- invalid distances ---------- */
const INVALID = ['', '   ', '\t', '0', '0.0', '-0', '-5', '-0.1', 'abc', '5abc', 'NaN', 'Infinity', '-Infinity', '1e999',
  '0.09', '0.099', '10000.01', '10001', '1e5',
  '0x10', '0b11', '0o7', '0X1F', '1_0', '1,5', '1 5', '1e', '1e+', '--5', '5-', '.', '+', '-', 'e5'];
INVALID.forEach((v) => {
  test('rejects ' + JSON.stringify(v) + ' (metric)', () => {
    const p = load(); p.set(v);
    const o = p.out(), e = p.err();
    assert.strictEqual(e.invalid, 'true');
    assert.strictEqual(e.shown, 'block');
    assert.strictEqual(e.text, 'Enter a distance between 0.1 and 10,000 m.');
    DEP.forEach((k) => assert.strictEqual(o[k], '—', k));
    assert.ok(/Fix the highlighted distance/.test(o.classify), o.classify);
    noBadNumbers(o);
    // distance-independent outputs are preserved
    assert.strictEqual(o.hfov, '61.9');
    assert.strictEqual(o.maxId, '8.6 m');
    assert.strictEqual(o.maxRec, '17.3 m');
    assert.strictEqual(o.maxObs, '34.3 m');
    assert.strictEqual(o.maxDet, '86.4 m');
  });
});
test('invalid distance in feet names the unit', () => {
  const p = load(); p.toFeet(); p.set('0');
  assert.strictEqual(p.err().text, 'Enter a distance between 0.1 and 10,000 ft.');
  assert.strictEqual(p.out().density, '—');
});

/* ---------- boundaries ---------- */
test('exact bounds are valid and finite: 0.1 and 10000 (m and ft)', () => {
  [false, true].forEach((feet) => {
    const p = load(); if (feet) p.toFeet();
    ['0.1', '10000'].forEach((v) => {
      p.set(v);
      assert.strictEqual(p.err().invalid, null, v + (feet ? ' ft' : ' m'));
      assert.strictEqual(p.err().shown, 'none');
      noBadNumbers(p.out());
      assert.notStrictEqual(p.out().density, '—');
    });
  });
});
test('0.1 m density = 21,600 px/m; 10,000 m density rounds to 0 px/m, Below detection', () => {
  const p = load(); p.set('0.1');
  assert.strictEqual(p.out().density, '21,600 px/m');
  p.set('10000');
  assert.strictEqual(p.out().density, '0 px/m');
  assert.ok(p.out().classify.startsWith('Below detection grade'));
});
test('leading/trailing whitespace around a valid number is accepted', () => {
  const p = load(); p.set(' 15 ');
  assert.strictEqual(p.out().density, '144 px/m');
  assert.strictEqual(p.err().invalid, null);
});

/* ---------- accepted numeric notation ---------- */
['15', '15.0', '+15', '15.', '1.5e1', '1.5E1', '150e-1', '0.15e2', '015'].forEach((v) => {
  test('accepts ordinary decimal / exponent notation ' + JSON.stringify(v), () => {
    const p = load(); p.set(v);
    assert.strictEqual(p.err().invalid, null);
    assert.strictEqual(p.out().density, '144 px/m');
  });
});
test('accepts .5 (0.5 m is within bounds)', () => {
  const p = load(); p.set('.5');
  assert.strictEqual(p.err().invalid, null);
  assert.strictEqual(p.out().density, '4,320 px/m');
});
test('1e1 is 10 m, 1e4 is exactly the 10,000 maximum, 1.0001e4 is over it', () => {
  const p = load();
  p.set('1e1'); assert.strictEqual(p.err().invalid, null);
  p.set('1e4'); assert.strictEqual(p.err().invalid, null);
  p.set('1e4 '); assert.strictEqual(p.err().invalid, null);
  p.set('1.0001e4'); assert.strictEqual(p.err().invalid, 'true');
});

/* ---------- alert is not rewritten while its message is unchanged ---------- */
test('repeated invalid keystrokes do not rewrite an unchanged error message', () => {
  const p = load(); const base = p.err().writes;
  p.set('-'); const w1 = p.err().writes;
  assert.strictEqual(w1, base + 1, 'first invalid value writes the message once');
  ['-5', '-50', '0', '', 'abc', '0.01'].forEach((v) => p.set(v));
  assert.strictEqual(p.err().writes, w1, 'same message must not be rewritten');
  assert.strictEqual(p.err().invalid, 'true');
  assert.strictEqual(p.err().shown, 'block');
});
test('the message is rewritten when the unit changes and cleared once on recovery', () => {
  const p = load(); p.set('0'); const w = p.err().writes;
  p.toFeet(); assert.strictEqual(p.err().writes, w + 1);
  assert.strictEqual(p.err().text, 'Enter a distance between 0.1 and 10,000 ft.');
  p.set('15'); assert.strictEqual(p.err().text, ''); assert.strictEqual(p.err().writes, w + 2);
  p.set('16'); p.set('17'); assert.strictEqual(p.err().writes, w + 2, 'valid keystrokes do not touch the alert');
});

/* ---------- recovery and unit switching ---------- */
test('correcting an invalid value clears the error and restores the exact results', () => {
  const p = load(); const before = p.out();
  p.set('-5'); assert.strictEqual(p.err().invalid, 'true');
  p.set('15');
  assert.deepStrictEqual(p.out(), before);
  assert.strictEqual(p.err().invalid, null);
  assert.strictEqual(p.err().shown, 'none');
  assert.strictEqual(p.err().text, '');
});
test('unit switching revalidates: 5000 stays valid; error text follows the unit', () => {
  const p = load(); p.set('5000');
  assert.strictEqual(p.err().invalid, null);
  p.toFeet();
  assert.strictEqual(p.err().invalid, null);
  p.set('20000'); assert.strictEqual(p.err().text, 'Enter a distance between 0.1 and 10,000 ft.');
  p.toMeters(); assert.strictEqual(p.err().text, 'Enter a distance between 0.1 and 10,000 m.');
  assert.strictEqual(p.err().invalid, 'true');
  p.set('15'); assert.strictEqual(p.err().invalid, null);
  assert.strictEqual(p.out().density, '144 px/m');
});
test('switching unit with the default value restores metric default after returning', () => {
  const p = load(); const m = p.out();
  p.toFeet(); p.toMeters();
  assert.deepStrictEqual(p.out(), m);
});

console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
