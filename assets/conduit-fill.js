// Conduit Fill Calculator logic. Kept in a file (not inline) so the site's
// hash-based Content-Security-Policy does not need a new script hash.
(function (root) {
  'use strict';

  // NEC Chapter 9 Table 5: approximate area (sq in) of THHN/THWN-2 insulated conductors.
  var WIRE_AREA = {
    '14': 0.0097, '12': 0.0133, '10': 0.0211, '8': 0.0366, '6': 0.0507, '4': 0.0824,
    '3': 0.0973, '2': 0.1158, '1': 0.1562, '1/0': 0.1855, '2/0': 0.2223,
    '3/0': 0.2679, '4/0': 0.3237
  };
  var WIRE_ORDER = ['14', '12', '10', '8', '6', '4', '3', '2', '1', '1/0', '2/0', '3/0', '4/0'];

  // NEC Chapter 9 Table 4: EMT internal area (sq in) at 100% fill, by trade size.
  var EMT = [
    { size: '1/2"', area: 0.304 }, { size: '3/4"', area: 0.533 }, { size: '1"', area: 0.864 },
    { size: '1-1/4"', area: 1.496 }, { size: '1-1/2"', area: 2.036 }, { size: '2"', area: 3.356 },
    { size: '2-1/2"', area: 5.858 }, { size: '3"', area: 8.846 }, { size: '3-1/2"', area: 11.545 },
    { size: '4"', area: 14.753 }
  ];

  // NEC Chapter 9 Table 1: 1 conductor 53%, 2 conductors 31%, over 2 conductors 40%.
  function fillLimit(count) {
    if (count <= 1) return 0.53;
    if (count === 2) return 0.31;
    return 0.40;
  }

  // groups: [{ size: '12', qty: 6 }, ...]
  function calculate(groups) {
    var out = { error: null };
    var total = 0, count = 0;
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i];
      if (!g.qty || g.qty <= 0) continue;
      var a = WIRE_AREA[g.size];
      if (!a) { out.error = 'Unknown wire size.'; return out; }
      total += a * g.qty;
      count += g.qty;
    }
    if (count === 0) { out.error = 'Enter at least one conductor.'; return out; }
    var limit = fillLimit(count);
    out.totalArea = total;
    out.count = count;
    out.limit = limit;
    out.rows = EMT.map(function (c) {
      return { size: c.size, allowed: c.area * limit, fillPct: total / c.area * 100, pass: total <= c.area * limit };
    });
    var idx = -1;
    for (var k = 0; k < out.rows.length; k++) { if (out.rows[k].pass) { idx = k; break; } }
    if (idx < 0) { out.error = 'This bundle is larger than the biggest EMT size covered (4"). Split it across conduits.'; return out; }
    out.pick = out.rows[idx];
    out.next = out.rows[idx + 1] || null;
    return out;
  }

  var api = { calculate: calculate, fillLimit: fillLimit, WIRE_AREA: WIRE_AREA, EMT: EMT };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.ConduitFill = api;

  /* ---------- page wiring (browser only) ---------- */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
  var form = document.getElementById('cfForm');
  if (!form) return;
  function $(id) { return document.getElementById(id); }

  var tbody = $('cfRows');
  var ROWS = 5;
  var defaults = [['12', 6], ['10', 0], ['14', 0], ['8', 0], ['6', 0]];
  for (var r = 0; r < ROWS; r++) {
    var tr = document.createElement('div');
    tr.className = 'field-row';
    var opts = WIRE_ORDER.map(function (s) { return '<option value="' + s + '">' + s + ' AWG</option>'; }).join('');
    tr.innerHTML =
      '<div class="field"><label for="cfSize' + r + '">Wire size ' + (r + 1) + '</label><select id="cfSize' + r + '">' + opts + '</select></div>' +
      '<div class="field"><label for="cfQty' + r + '">Number of wires</label><input type="number" id="cfQty' + r + '" min="0" max="200" step="1" value="' + defaults[r][1] + '"></div>';
    tbody.appendChild(tr);
    $('cfSize' + r).value = defaults[r][0];
  }

  function run() {
    var groups = [];
    for (var i = 0; i < ROWS; i++) {
      groups.push({ size: $('cfSize' + i).value, qty: parseInt($('cfQty' + i).value, 10) || 0 });
    }
    var res = calculate(groups);
    $('cfError').style.display = res.error ? '' : 'none';
    $('cfResults').style.display = res.error && !res.rows ? 'none' : '';
    if (res.error) { $('cfError').textContent = res.error; if (!res.rows) return; }
    $('cfTotal').textContent = res.totalArea.toFixed(4) + ' sq in (' + res.count + ' wires)';
    $('cfLimit').textContent = Math.round(res.limit * 100) + '%';
    if (res.pick) {
      $('cfSize').textContent = res.pick.size;
      $('cfCaption').textContent = 'smallest EMT trade size that fits';
      $('cfFill').textContent = res.pick.fillPct.toFixed(1) + '% filled (limit ' + Math.round(res.limit * 100) + '%)';
      $('cfNext').textContent = res.next ? res.next.size + ' at ' + res.next.fillPct.toFixed(1) + '%' : 'none';
    } else {
      $('cfSize').textContent = '—';
      $('cfCaption').textContent = '—';
      $('cfFill').textContent = '—';
      $('cfNext').textContent = '—';
    }
  }
  form.addEventListener('input', run);
  form.addEventListener('change', run);
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  run();
})(typeof window !== 'undefined' ? window : this);
