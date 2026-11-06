// dBm / mW converter. Port of the GaugeCalc app's dbm.dart. Plain definitions:
//   dBm = 10 x log10(mW), mW = 10 ^ (dBm / 10), W = mW / 1000, dBW = dBm - 30.
// Accepted range: -200 to +100 dBm.
(function (root) {
  'use strict';

  var MIN_DBM = -200, MAX_DBM = 100;

  // value + unit ('dbm' | 'dbw' | 'mw' | 'w') -> { mw, dbm, dbw, watts } or null.
  function from(value, unit) {
    if (typeof value !== 'number' || !isFinite(value)) return null;
    var dbm;
    if (unit === 'dbm') dbm = value;
    else if (unit === 'dbw') dbm = value + 30;
    else if (unit === 'mw') { if (value <= 0) return null; dbm = 10 * Math.log10(value); }
    else if (unit === 'w') { if (value <= 0) return null; dbm = 10 * Math.log10(value * 1000); }
    else return null;
    if (dbm < MIN_DBM || dbm > MAX_DBM) return null;
    var mw = Math.pow(10, dbm / 10);
    return { mw: mw, dbm: 10 * Math.log10(mw), dbw: 10 * Math.log10(mw) - 30, watts: mw / 1000 };
  }

  // Compact number text without trailing zeros; very small or large values use exponents.
  function fmt(n) {
    if (n === 0) return '0';
    var a = Math.abs(n);
    if (a >= 1e7 || a < 1e-4) return n.toExponential(3).replace(/\.?0+e/, 'e');
    var s = a >= 100 ? n.toFixed(2) : n.toFixed(4);
    return s.replace(/\.?0+$/, '');
  }

  var REFERENCE_DBM = [-30, -10, 0, 10, 20, 30, 36];

  var api = { from: from, fmt: fmt, REFERENCE_DBM: REFERENCE_DBM, MIN_DBM: MIN_DBM, MAX_DBM: MAX_DBM };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.GcDbm = api;

  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
  var form = document.getElementById('dbmForm');
  if (!form) return;
  function $(id) { return document.getElementById(id); }

  var refBody = $('dbmRefs');
  REFERENCE_DBM.forEach(function (d) {
    var lvl = from(d, 'dbm');
    var big = d >= 30;
    var row = document.createElement('div');
    row.className = 'result-row';
    row.innerHTML = '<span class="k">' + fmt(d) + ' dBm</span><span class="v">' + fmt(big ? lvl.watts : lvl.mw) + (big ? ' W' : ' mW') + '</span>';
    refBody.appendChild(row);
  });

  function run() {
    var raw = $('dbmValue').value.trim().replace(',', '.');
    var v = raw === '' ? NaN : Number(raw);
    var lvl = from(v, $('dbmUnit').value);
    var err = $('dbmError'), inp = $('dbmValue');
    err.style.display = lvl ? 'none' : '';
    err.textContent = lvl ? '' : (raw === '' ? 'Enter a value to convert.'
      : 'Enter a power level from -200 to +100 dBm, or a power above zero in mW or W.');
    if (lvl) inp.removeAttribute('aria-invalid'); else inp.setAttribute('aria-invalid', 'true');
    $('dbmResults').style.display = lvl ? '' : 'none';
    if (!lvl) return;
    $('dbmHero').textContent = fmt(lvl.dbm) + ' dBm';
    $('dbmMw').textContent = fmt(lvl.mw) + ' mW';
    $('dbmW').textContent = fmt(lvl.watts) + ' W';
    $('dbmDbw').textContent = fmt(lvl.dbw) + ' dBW';
    $('dbmDbm').textContent = fmt(lvl.dbm) + ' dBm';
  }
  window.calculate = run;
  form.addEventListener('input', run);
  form.addEventListener('change', run);
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  run();
})(typeof window !== 'undefined' ? window : this);
