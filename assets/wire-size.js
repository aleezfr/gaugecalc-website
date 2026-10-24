// Wire Size Calculator logic. Kept in a file (not inline) so the site's
// hash-based Content-Security-Policy does not need a new script hash.
(function (root) {
  'use strict';

  // NEC (NFPA 70) Table 310.16 allowable ampacities, 30 C ambient, no more than
  // three current-carrying conductors in a raceway, cable or earth. [60C, 75C, 90C].
  var AMPACITY = {
    copper: {
      '14': [15, 20, 25], '12': [20, 25, 30], '10': [30, 35, 40], '8': [40, 50, 55],
      '6': [55, 65, 75], '4': [70, 85, 95], '3': [85, 100, 115], '2': [95, 115, 130],
      '1': [110, 130, 145], '1/0': [125, 150, 170], '2/0': [145, 175, 195],
      '3/0': [165, 200, 225], '4/0': [195, 230, 260]
    },
    aluminum: {
      '12': [15, 20, 25], '10': [25, 30, 35], '8': [30, 40, 45], '6': [40, 50, 55],
      '4': [55, 65, 75], '3': [65, 75, 85], '2': [75, 90, 100], '1': [85, 100, 115],
      '1/0': [100, 120, 135], '2/0': [115, 135, 150], '3/0': [130, 155, 175],
      '4/0': [150, 180, 205]
    }
  };

  // Ohms per 1000 ft at 20 C (same reference data as the Voltage Drop Calculator).
  var RESISTANCE = {
    copper: {
      '14': 2.525, '12': 1.588, '10': 0.9989, '8': 0.6282, '6': 0.3951, '4': 0.2485,
      '3': 0.1970, '2': 0.1563, '1': 0.1239, '1/0': 0.09827, '2/0': 0.07793,
      '3/0': 0.06180, '4/0': 0.04901
    },
    aluminum: {
      '12': 2.5700, '10': 1.6163, '8': 1.0165, '6': 0.63928, '4': 0.40205, '3': 0.31884,
      '2': 0.25285, '1': 0.20052, '1/0': 0.15902, '2/0': 0.12611, '3/0': 0.10001,
      '4/0': 0.079310
    }
  };

  // NEC 240.4(D) small-conductor overcurrent protection limits (amps).
  var SMALL_CAP = {
    copper: { '14': 15, '12': 20, '10': 30 },
    aluminum: { '12': 15, '10': 25 }
  };

  // Thinnest -> thickest.
  var ORDER = ['14', '12', '10', '8', '6', '4', '3', '2', '1', '1/0', '2/0', '3/0', '4/0'];

  // NEC Table 310.15(B)(1) ambient correction factors, 30 C base. Upper bound C -> [60C, 75C, 90C].
  var AMBIENT = [
    { max: 10, f: [1.29, 1.20, 1.15] }, // 10 C or less
    { max: 15, f: [1.22, 1.15, 1.12] },
    { max: 20, f: [1.15, 1.11, 1.08] },
    { max: 25, f: [1.08, 1.05, 1.04] },
    { max: 30, f: [1.00, 1.00, 1.00] }, // 26-30 C
    { max: 35, f: [0.91, 0.94, 0.96] },
    { max: 40, f: [0.82, 0.88, 0.91] },
    { max: 45, f: [0.71, 0.82, 0.87] },
    { max: 50, f: [0.58, 0.75, 0.82] },
    { max: 55, f: [0.41, 0.67, 0.76] },
    { max: 60, f: [null, 0.58, 0.71] }
  ];

  // NEC 310.15(C)(1) adjustment for more than three current-carrying conductors.
  function bundlingFactor(n) {
    if (n <= 3) return 1;
    if (n <= 6) return 0.8;
    if (n <= 9) return 0.7;
    if (n <= 20) return 0.5;
    if (n <= 30) return 0.45;
    if (n <= 40) return 0.4;
    return 0.35;
  }

  function ambientFactor(tempC, col) {
    for (var i = 0; i < AMBIENT.length; i++) {
      if (tempC <= AMBIENT[i].max) return AMBIENT[i].f[col];
    }
    return null;
  }

  function sizeList(material) {
    return ORDER.filter(function (s) { return AMPACITY[material][s]; });
  }

  // opts: { amps, continuous, material, col (0|1|2), ambientC, conductors, voltage, lengthFt, maxDropPct }
  function calculate(o) {
    var out = { error: null };
    if (!(o.amps > 0)) { out.error = 'Enter a load current greater than 0 A.'; return out; }
    var af = ambientFactor(o.ambientC, o.col);
    if (af === null) { out.error = 'That ambient temperature is outside the range this insulation rating supports.'; return out; }
    var bf = bundlingFactor(o.conductors);
    var required = o.amps * (o.continuous ? 1.25 : 1);
    var factor = af * bf;
    out.required = required;
    out.ambientFactor = af;
    out.bundlingFactor = bf;
    out.combinedFactor = factor;

    var sizes = sizeList(o.material);
    var pick = null;
    for (var i = 0; i < sizes.length; i++) {
      var derated = AMPACITY[o.material][sizes[i]][o.col] * factor;
      var cap = SMALL_CAP[o.material][sizes[i]];
      if (derated >= required && (!cap || cap >= o.amps * (o.continuous ? 1.25 : 1))) { pick = i; break; }
    }
    if (pick === null) {
      out.error = 'Even 4/0 AWG cannot carry this load after derating. Use parallel conductors or a larger size per the NEC.';
      return out;
    }
    out.ampacitySize = sizes[pick];

    var finalIdx = pick;
    var hasRun = o.voltage > 0 && o.lengthFt > 0;
    function dropFor(sizeKey) {
      var r = RESISTANCE[o.material][sizeKey] / 1000;
      var v = o.amps * 2 * r * o.lengthFt;
      return { volts: v, pct: v / o.voltage * 100 };
    }
    if (hasRun) {
      while (finalIdx < sizes.length - 1 && dropFor(sizes[finalIdx]).pct > o.maxDropPct) finalIdx++;
      out.dropLimited = finalIdx > pick;
    }
    out.size = sizes[finalIdx];
    out.baseAmpacity = AMPACITY[o.material][out.size][o.col];
    out.deratedAmpacity = out.baseAmpacity * factor;
    if (hasRun) {
      out.drop = dropFor(out.size);
      out.dropPasses = out.drop.pct <= o.maxDropPct;
    }
    return out;
  }

  var api = {
    calculate: calculate, bundlingFactor: bundlingFactor, ambientFactor: ambientFactor,
    sizeList: sizeList, AMPACITY: AMPACITY, RESISTANCE: RESISTANCE
  };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.WireSize = api;

  /* ---------- page wiring (browser only) ---------- */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
  var form = document.getElementById('wsForm');
  if (!form) return;

  function $(id) { return document.getElementById(id); }
  function num(id) { return parseFloat($(id).value); }
  function show(id, on) { $(id).style.display = on ? '' : 'none'; }

  function run() {
    var basis = $('wsBasis').value;
    var volts = num('wsVoltage');
    var amps = basis === 'watts' ? num('wsLoad') / volts : num('wsLoad');
    show('wsVoltageHint', basis === 'watts');
    var lenUnit = $('wsLenUnit').value;
    var len = num('wsLength');
    var lengthFt = isFinite(len) ? (lenUnit === 'm' ? len * 3.28084 : len) : 0;
    var res = calculate({
      amps: amps,
      continuous: $('wsContinuous').checked,
      material: $('wsMaterial').value,
      col: parseInt($('wsTemp').value, 10),
      ambientC: isFinite(num('wsAmbient')) ? num('wsAmbient') : 30,
      conductors: Math.max(1, parseInt($('wsConductors').value, 10) || 1),
      voltage: volts,
      lengthFt: lengthFt,
      maxDropPct: isFinite(num('wsMaxDrop')) ? num('wsMaxDrop') : 3
    });

    show('wsError', !!res.error);
    show('wsResults', !res.error);
    if (res.error) { $('wsError').textContent = res.error; return; }

    $('wsSize').textContent = res.size;
    $('wsSizeCaption').textContent = res.dropLimited
      ? 'increased from ' + res.ampacitySize + ' AWG to keep voltage drop within your limit'
      : 'smallest size that carries the load after derating';
    $('wsRequired').textContent = res.required.toFixed(1) + ' A';
    $('wsFactor').textContent = res.combinedFactor.toFixed(2) + ' (ambient ' + res.ambientFactor.toFixed(2) + ' × bundling ' + res.bundlingFactor.toFixed(2) + ')';
    $('wsBase').textContent = res.baseAmpacity + ' A';
    $('wsDerated').textContent = res.deratedAmpacity.toFixed(1) + ' A';
    show('wsDropRow', !!res.drop);
    if (res.drop) {
      $('wsDrop').textContent = res.drop.volts.toFixed(2) + ' V (' + res.drop.pct.toFixed(2) + '%)';
    }
    var small = $('wsMaterial').value === 'copper' ? { '14': 15, '12': 20, '10': 30 } : { '12': 15, '10': 25 };
    var note = '';
    if (small[res.size]) {
      note = 'NEC 240.4(D) limits overcurrent protection for ' + res.size + ' AWG ' + $('wsMaterial').value + ' to ' + small[res.size] + ' A, even where the table ampacity is higher.';
    }
    if (res.drop && !res.dropPasses) {
      note = 'Voltage drop is still above your limit at 4/0 AWG. Shorten the run, raise the supply voltage, or use parallel conductors.';
    }
    $('wsNote').textContent = note;
    show('wsNote', !!note);
  }

  form.addEventListener('input', run);
  form.addEventListener('change', run);
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  run();
})(typeof window !== 'undefined' ? window : this);
