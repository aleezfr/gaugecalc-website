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
  // setIn: type into an input (fires 'input'); pick: change a select (fires 'change', like the browser)
  const setIn = (id, v) => { els[id].value = v; els[id].fire('input'); };
  const pick = (id, v) => { els[id].value = v; els[id].fire('change'); };
  const errOf = (errId, inputId) => ({
    text: els[errId].textContent, shown: els[errId].style.display, writes: els[errId].writes,
    invalid: els[inputId].getAttribute('aria-invalid')
  });
  return { els, set, setIn, pick, errOf, out, err, toFeet: () => feetBtn.click(), toMeters: () => meterBtn.click() };
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

/* =====================================================================
 * Focal length, custom sensor width/height, custom horizontal resolution
 * ===================================================================== */
const MSG = {
  focal: 'Enter a focal length between 0.1 and 1,000 mm.',
  sensorW: 'Enter a sensor width between 0.1 and 100 mm.',
  sensorH: 'Enter a sensor height between 0.1 and 100 mm.',
  res: 'Enter a whole number of horizontal pixels between 1 and 100,000.'
};
const CAP_INPUTS = 'Fix the highlighted inputs above to see a result.';
const CAP_DISTANCE = 'Fix the highlighted distance above to see a result.';
const BASE = load().out(); // default preset case, used as the "valid calculations are preserved" baseline

// Every output key and which of them each input invalidates (all other outputs must equal BASE).
const ALL = ['hfov', 'vfov', 'width', 'density', 'classify', 'maxId', 'maxRec', 'maxObs', 'maxDet'];
const MAXES = ['maxId', 'maxRec', 'maxObs', 'maxDet'];
const DEPENDS = {
  focal: { dash: ['hfov', 'vfov', 'width', 'density', ...MAXES], caption: CAP_INPUTS },
  sensorW: { dash: ['hfov', 'width', 'density', ...MAXES], caption: CAP_INPUTS },
  sensorH: { dash: ['vfov'], caption: null },
  res: { dash: ['density', ...MAXES], caption: CAP_INPUTS }
};
const FIELD = {
  focal: { input: 'focalLength', error: 'focalError', custom: null },
  sensorW: { input: 'customSensorW', error: 'sensorWError', custom: ['sensorFormat', 'custom'] },
  sensorH: { input: 'customSensorH', error: 'sensorHError', custom: ['sensorFormat', 'custom'] },
  res: { input: 'customRes', error: 'resError', custom: ['resolution', 'custom'] }
};
function prepared(key) { // page with the field under test visible (custom selected where needed)
  const p = load(); const f = FIELD[key];
  if (f.custom) p.pick(f.custom[0], f.custom[1]);
  return p;
}
function expectOutputs(p, key) { // dependency matrix for one invalid input
  const o = p.out(), d = DEPENDS[key];
  ALL.forEach((k) => {
    if (d.dash.includes(k)) assert.strictEqual(o[k], '—', key + ' invalid: ' + k + ' must be unavailable, got ' + o[k]);
    else if (k === 'classify' && d.caption) assert.strictEqual(o[k], d.caption, 'classification caption');
    else assert.strictEqual(o[k], BASE[k], key + ' invalid: ' + k + ' must be unchanged');
  });
  noBadNumbers(o);
}

const BAD_NUM = ['', '   ', '\t', '0', '0.0', '-0', '-1', '-0.1', 'abc', '5abc', 'NaN', 'Infinity', '-Infinity', '1e999',
  '0x10', '0b11', '0o7', '1_0', '1,5', '1 5', '1e', '--5', '.', '+', '-'];
const RANGE_CASES = {
  focal: { bad: BAD_NUM.concat(['0.099', '0.09', '0.01', '1000.01', '1001', '1e6']), good: ['0.1', '1000', '2.8', '1e3', '.5', '4'] },
  sensorW: { bad: BAD_NUM.concat(['0.099', '0.09', '0.01', '100.01', '101', '1e6']), good: ['0.1', '100', '4.8', '1e2', '13.2'] },
  sensorH: { bad: BAD_NUM.concat(['0.099', '0.09', '0.01', '100.01', '101', '1e6']), good: ['0.1', '100', '3.6', '1e2', '8.8'] },
  res: { bad: BAD_NUM.concat(['0.5', '0.999', '1920.5', '1920.0001', '100001', '1e6', '1e5000', '1.5e-1']), good: ['1', '100000', '1920', '1920.0', '1.92e3', '+1920', '1e5'] }
};

Object.keys(RANGE_CASES).forEach((key) => {
  const f = FIELD[key];
  RANGE_CASES[key].bad.forEach((v) => {
    test(key + ' rejects ' + JSON.stringify(v) + ' (message, aria-invalid, dependent outputs only)', () => {
      const p = prepared(key); p.setIn(f.input, v);
      const e = p.errOf(f.error, f.input);
      assert.strictEqual(e.text, MSG[key]);
      assert.strictEqual(e.shown, 'block');
      assert.strictEqual(e.invalid, 'true');
      expectOutputs(p, key);
    });
  });
  test(key + ' accepts boundaries and ordinary values: ' + RANGE_CASES[key].good.join(' '), () => {
    const p = prepared(key);
    RANGE_CASES[key].good.forEach((v) => {
      p.setIn(f.input, v);
      const e = p.errOf(f.error, f.input);
      assert.strictEqual(e.invalid, null, v);
      assert.strictEqual(e.shown, 'none', v);
      assert.strictEqual(e.text, '', v);
      noBadNumbers(p.out());
      ALL.forEach((k) => assert.notStrictEqual(p.out()[k], '—', v + ' ' + k));
    });
  });
  test(key + ': correcting an invalid value restores exactly the original results', () => {
    const p = prepared(key); const good = f.input === 'customRes' ? '2592' : p.els[f.input].value;
    p.setIn(f.input, ''); assert.strictEqual(p.errOf(f.error, f.input).invalid, 'true');
    p.setIn(f.input, good);
    assert.deepStrictEqual(p.out(), BASE);
    assert.deepStrictEqual(p.errOf(f.error, f.input), { text: '', shown: 'none', writes: p.errOf(f.error, f.input).writes, invalid: null });
  });
  test(key + ': an unchanged error message is not rewritten on every invalid keystroke', () => {
    const p = prepared(key); p.setIn(f.input, '-');
    const w = p.errOf(f.error, f.input).writes;
    ['0', '', 'abc', '-5', '0x10'].forEach((v) => p.setIn(f.input, v));
    assert.strictEqual(p.errOf(f.error, f.input).writes, w);
    assert.strictEqual(p.errOf(f.error, f.input).invalid, 'true');
  });
});

test('fractional resolution is rejected only for resolution; fractional focal/sensor values are fine', () => {
  const p = prepared('res'); p.setIn('customRes', '1920.5');
  assert.strictEqual(p.errOf('resError', 'customRes').invalid, 'true');
  const q = load(); q.setIn('focalLength', '2.85'); assert.strictEqual(q.errOf('focalError', 'focalLength').invalid, null);
  assert.notStrictEqual(q.out().density, '—');
});

/* ---------- custom values equal to a preset give the same calculation ---------- */
test('custom sensor 4.8 x 3.6 mm and custom 2592 px reproduce the preset results exactly', () => {
  const p = load();
  p.pick('sensorFormat', 'custom'); assert.deepStrictEqual(p.out(), BASE);
  p.pick('resolution', 'custom'); assert.deepStrictEqual(p.out(), BASE);
  assert.strictEqual(p.els.customSensorRow.style.display, 'grid');
  assert.strictEqual(p.els.customResRow.style.display, 'block');
});
test('a custom sensor/resolution changes the right outputs (13.2 x 8.8 mm, 3840 px)', () => {
  const p = load(); p.pick('sensorFormat', '13.2,8.8'); p.pick('resolution', '3840');
  const o = p.out();
  const c = load(); c.pick('sensorFormat', 'custom'); c.setIn('customSensorW', '13.2'); c.setIn('customSensorH', '8.8');
  c.pick('resolution', 'custom'); c.setIn('customRes', '3840');
  assert.deepStrictEqual(c.out(), o);
});

/* ---------- hidden custom fields ---------- */
test('hidden custom sensor / resolution fields are not validated while presets are selected', () => {
  const p = load();
  p.setIn('customSensorW', '-1'); p.setIn('customSensorH', 'abc'); p.setIn('customRes', '0');
  assert.deepStrictEqual(p.out(), BASE);
  ['sensorW:customSensorW', 'sensorH:customSensorH', 'res:customRes'].forEach((s) => {
    const [k, i] = s.split(':'); const e = p.errOf(FIELD[k].error, i);
    assert.strictEqual(e.invalid, null); assert.strictEqual(e.shown, 'none'); assert.strictEqual(e.text, '');
  });
});
test('selecting Custom reveals garbage-field errors; switching back to a preset clears them and recalculates', () => {
  const p = load();
  p.setIn('customSensorW', '-1'); p.setIn('customSensorH', 'abc'); p.setIn('customRes', '0');
  p.pick('sensorFormat', 'custom'); p.pick('resolution', 'custom');
  assert.strictEqual(p.errOf('sensorWError', 'customSensorW').invalid, 'true');
  assert.strictEqual(p.errOf('sensorHError', 'customSensorH').invalid, 'true');
  assert.strictEqual(p.errOf('resError', 'customRes').invalid, 'true');
  assert.strictEqual(p.out().hfov, '—'); assert.strictEqual(p.out().vfov, '—'); assert.strictEqual(p.out().density, '—');
  p.pick('sensorFormat', '4.8,3.6');
  assert.strictEqual(p.errOf('sensorWError', 'customSensorW').invalid, null);
  assert.strictEqual(p.errOf('sensorHError', 'customSensorH').invalid, null);
  assert.strictEqual(p.errOf('sensorWError', 'customSensorW').text, '');
  assert.strictEqual(p.errOf('resError', 'customRes').invalid, 'true', 'resolution still custom + invalid');
  assert.strictEqual(p.out().hfov, BASE.hfov); assert.strictEqual(p.out().vfov, BASE.vfov); assert.strictEqual(p.out().density, '—');
  p.pick('resolution', '2592');
  assert.strictEqual(p.errOf('resError', 'customRes').invalid, null);
  assert.deepStrictEqual(p.out(), BASE);
});
test('an invalid focal length is always visible (never hidden) so it always blocks results', () => {
  const p = load(); p.setIn('focalLength', '0');
  assert.strictEqual(p.errOf('focalError', 'focalLength').invalid, 'true');
  assert.strictEqual(p.out().hfov, '—');
});

/* ---------- combined invalid inputs and captions ---------- */
test('distance is the only invalid input: existing distance-only caption is preserved', () => {
  const p = load(); p.set('0');
  assert.strictEqual(p.out().classify, CAP_DISTANCE);
});
test('a single non-distance invalid input uses the generic inputs caption when it blocks the classification', () => {
  const p = prepared('res'); p.setIn('customRes', '0');
  assert.strictEqual(p.out().classify, CAP_INPUTS);
  const q = prepared('sensorH'); q.setIn('customSensorH', '0');
  assert.ok(q.out().classify.startsWith('Recognition-grade'), 'sensor height does not affect classification');
});
test('multiple invalid inputs flag every field and use the inputs caption', () => {
  const p = load(); p.pick('sensorFormat', 'custom'); p.pick('resolution', 'custom');
  p.setIn('focalLength', '0'); p.setIn('customSensorW', ''); p.setIn('customSensorH', '-1'); p.setIn('customRes', '1.5'); p.set('abc');
  ['focalError:focalLength', 'sensorWError:customSensorW', 'sensorHError:customSensorH', 'resError:customRes', 'distError:distance']
    .forEach((s) => { const [e, i] = s.split(':'); assert.strictEqual(p.els[i].getAttribute('aria-invalid'), 'true', i); assert.strictEqual(p.els[e].style.display, 'block', e); });
  const o = p.out();
  ALL.filter((k) => k !== 'classify').forEach((k) => assert.strictEqual(o[k], '—', k));
  assert.strictEqual(o.classify, CAP_INPUTS);
  noBadNumbers(o);
});
test('distance + one other invalid input: inputs caption; fixing the other leaves the distance-only caption', () => {
  const p = load(); p.setIn('focalLength', '0'); p.set('0');
  assert.strictEqual(p.out().classify, CAP_INPUTS);
  p.setIn('focalLength', '4');
  assert.strictEqual(p.out().classify, CAP_DISTANCE);
  assert.strictEqual(p.out().hfov, BASE.hfov); assert.strictEqual(p.out().maxId, BASE.maxId);
});
test('invalid sensor height + invalid resolution: VFOV, density, classification and max distances unavailable; HFOV and width kept', () => {
  const p = load(); p.pick('sensorFormat', 'custom'); p.pick('resolution', 'custom');
  p.setIn('customSensorH', '0'); p.setIn('customRes', '0');
  const o = p.out();
  assert.strictEqual(o.hfov, BASE.hfov); assert.strictEqual(o.width, BASE.width);
  ['vfov', 'density', ...MAXES].forEach((k) => assert.strictEqual(o[k], '—', k));
  assert.strictEqual(o.classify, CAP_INPUTS);
});

/* ---------- units, distance regression, reset ---------- */
test('unit switching keeps focal/sensor/resolution errors and still revalidates the distance', () => {
  const p = prepared('res'); p.setIn('customRes', '0'); p.setIn('distance', '0');
  p.toFeet();
  assert.strictEqual(p.errOf('resError', 'customRes').invalid, 'true');
  assert.strictEqual(p.err().text, 'Enter a distance between 0.1 and 10,000 ft.');
  p.setIn('customRes', '2592'); p.set('15');
  assert.strictEqual(p.out().density, '472 px/m');
});
test('existing distance validation is unchanged by the new fields (bounds, message, outputs)', () => {
  const p = load();
  ['0.1', '10000', '15'].forEach((v) => { p.set(v); assert.strictEqual(p.err().invalid, null, v); });
  ['0.099', '10000.01', '', '-5', '0x10'].forEach((v) => {
    p.set(v);
    assert.strictEqual(p.err().invalid, 'true', v);
    assert.strictEqual(p.err().text, 'Enter a distance between 0.1 and 10,000 m.');
    assert.strictEqual(p.out().hfov, BASE.hfov); assert.strictEqual(p.out().vfov, BASE.vfov);
    assert.strictEqual(p.out().maxId, BASE.maxId);
  });
});
test('Reset sequence (restore every field to its page default) clears all errors and restores the exact defaults', () => {
  const p = load();
  p.pick('sensorFormat', 'custom'); p.pick('resolution', 'custom'); p.toFeet();
  p.setIn('focalLength', '0'); p.setIn('customSensorW', '-1'); p.setIn('customSensorH', ''); p.setIn('customRes', '1.5'); p.set('abc');
  assert.notDeepStrictEqual(p.out(), BASE);
  // calc-ux Reset: toggles first, then fields back to their loaded values (selects fire 'change', inputs 'input')
  p.toMeters();
  p.pick('sensorFormat', DEFAULTS.sensorFormat); p.pick('resolution', DEFAULTS.resolution);
  ['focalLength', 'customSensorW', 'customSensorH', 'customRes', 'distance'].forEach((id) => p.setIn(id, DEFAULTS[id]));
  assert.deepStrictEqual(p.out(), BASE);
  [['focalError', 'focalLength'], ['sensorWError', 'customSensorW'], ['sensorHError', 'customSensorH'], ['resError', 'customRes'], ['distError', 'distance']]
    .forEach(([e, i]) => { assert.strictEqual(p.els[i].getAttribute('aria-invalid'), null, i); assert.strictEqual(p.els[e].style.display, 'none', e); assert.strictEqual(p.els[e].textContent, '', e); });
});

/* ---------- page contract for the new fields ---------- */
test('page wires accessible errors and max attributes for every new field', () => {
  [['focalLength', 'focalError', 'max="1000"'], ['customSensorW', 'sensorWError', 'max="100"'],
    ['customSensorH', 'sensorHError', 'max="100"'], ['customRes', 'resError', 'max="100000"']].forEach(([i, e, max]) => {
    assert.ok(new RegExp('<input[^>]*id="' + i + '"[^>]*' + max + '[^>]*aria-describedby="' + e + '"').test(html), i);
    assert.ok(new RegExp('<p[^>]*class="field-error"[^>]*id="' + e + '"[^>]*role="alert"[^>]*display:none').test(html), e);
  });
});
test('custom sensor width and height errors sit directly below their own input, inside the same field', () => {
  [['customSensorW', 'sensorWError'], ['customSensorH', 'sensorHError']].forEach(([i, e]) => {
    const re = new RegExp('<div class="field">\\s*<label for="' + i + '">[^<]*</label>\\s*<input[^>]*id="' + i + '"[^>]*aria-describedby="' + e +
      '">\\s*<p class="field-error" id="' + e + '" role="alert" style="display:none;"></p>\\s*</div>');
    assert.ok(re.test(html), i + ' / ' + e);
  });
});
test('no silent fallbacks remain in the calculator script', () => {
  assert.ok(!/\|\|\s*(4|4\.8|3\.6|1920|0\.01)\)/.test(source), 'default fallback via || found');
  assert.ok(!/Math\.max\(/.test(source), 'clamp via Math.max found');
  assert.ok(!/parseFloat\((focalLengthInput|customSensorW|customSensorH|customRes|distanceInput)/.test(source), 'lenient parseFloat on a validated input');
});

console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
