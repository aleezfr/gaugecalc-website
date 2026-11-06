// Power Budget (EIRP) calculator. Port of the GaugeCalc app's power_budget.dart.
//   cable loss = dB per 100 m x length m / 100
//   connector loss = connectors x dB per connector
//   power at the antenna = Tx - cable loss - connector loss - other loss
//   EIRP = power at the antenna + antenna gain,  mW = 10 ^ (dBm / 10)
// Every loss and gain is the user's own datasheet figure; nothing is assumed.
(function (root) {
  'use strict';

  var LIMITS = {
    txPower: [-60, 60], antennaGain: [-10, 60], cableLossPer100: [0, 100], cableLength: [0, 10000],
    connectorLoss: [0, 5], otherLoss: [0, 60], eirpLimit: [-30, 100]
  };
  var MAX_CONNECTORS = 50;

  function num(text, min, max) {
    var t = String(text).trim().replace(',', '.');
    if (t === '' || !/^[+-]?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
    var v = Number(t);
    return isFinite(v) && v >= min && v <= max ? v : null;
  }

  // Returns the results, or { error: '<field name>' }. Empty cable, connector
  // and other losses mean 0; an empty EIRP limit means no limit check.
  function calculate(o) {
    var tx = num(o.txPower, LIMITS.txPower[0], LIMITS.txPower[1]);
    if (tx === null) return { error: 'txPower' };
    var gain = num(o.antennaGain, LIMITS.antennaGain[0], LIMITS.antennaGain[1]);
    if (gain === null) return { error: 'antennaGain' };
    function optional(text, field) {
      if (String(text == null ? '' : text).trim() === '') return 0;
      var v = num(text, LIMITS[field][0], LIMITS[field][1]);
      return v === null ? undefined : v;
    }
    var perHundred = optional(o.cableLossPer100, 'cableLossPer100');
    if (perHundred === undefined) return { error: 'cableLossPer100' };
    var length = optional(o.cableLength, 'cableLength');
    if (length === undefined) return { error: 'cableLength' };
    var ctext = String(o.connectors == null ? '' : o.connectors).trim();
    var count = 0;
    if (ctext !== '') {
      if (!/^\d+$/.test(ctext)) return { error: 'connectors' };
      count = parseInt(ctext, 10);
      if (count > MAX_CONNECTORS) return { error: 'connectors' };
    }
    var each = optional(o.connectorLoss, 'connectorLoss');
    if (each === undefined) return { error: 'connectorLoss' };
    var other = optional(o.otherLoss, 'otherLoss');
    if (other === undefined) return { error: 'otherLoss' };
    var limit = null;
    if (String(o.eirpLimit == null ? '' : o.eirpLimit).trim() !== '') {
      limit = num(o.eirpLimit, LIMITS.eirpLimit[0], LIMITS.eirpLimit[1]);
      if (limit === null) return { error: 'eirpLimit' };
    }
    var cableLossDb = perHundred * length / 100;
    var connectorsLossDb = count * each;
    var totalLossDb = cableLossDb + connectorsLossDb + other;
    var antennaInputDbm = tx - totalLossDb;
    var eirpDbm = antennaInputDbm + gain;
    return {
      txDbm: tx, antennaGainDbi: gain, cableLossDb: cableLossDb, connectorsLossDb: connectorsLossDb,
      otherLossDb: other, totalLossDb: totalLossDb, antennaInputDbm: antennaInputDbm,
      eirpDbm: eirpDbm, eirpMw: Math.pow(10, eirpDbm / 10),
      eirpLimitDbm: limit, overEirpLimit: limit !== null && eirpDbm > limit
    };
  }

  var api = { calculate: calculate, LIMITS: LIMITS, MAX_CONNECTORS: MAX_CONNECTORS };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.GcEirp = api;

  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
  var form = document.getElementById('pbForm');
  if (!form) return;
  function $(id) { return document.getElementById(id); }

  function round(n, d) { return String(Math.round(n * Math.pow(10, d)) / Math.pow(10, d)); }
  function minus(n) { return '−' + round(n, 2) + ' dB'; }

  var FIELDS = [
    ['txPower', 'pbTx'], ['antennaGain', 'pbGain'], ['cableLossPer100', 'pbCable'], ['cableLength', 'pbLength'],
    ['connectors', 'pbConnectors'], ['connectorLoss', 'pbConnLoss'], ['otherLoss', 'pbOther'], ['eirpLimit', 'pbLimit']
  ];

  function run() {
    var res = calculate({
      txPower: $('pbTx').value, antennaGain: $('pbGain').value, cableLossPer100: $('pbCable').value,
      cableLength: $('pbLength').value, connectors: $('pbConnectors').value, connectorLoss: $('pbConnLoss').value,
      otherLoss: $('pbOther').value, eirpLimit: $('pbLimit').value
    });
    FIELDS.forEach(function (f) {
      var inp = $(f[1]);
      if (res.error === f[0]) inp.setAttribute('aria-invalid', 'true'); else inp.removeAttribute('aria-invalid');
    });
    var err = $('pbError');
    err.style.display = res.error ? '' : 'none';
    if (res.error) err.textContent = 'Enter a valid number in the highlighted field. The allowed range is in its help text.';
    $('pbResults').style.display = res.error ? 'none' : '';
    if (res.error) return;
    $('pbEirp').textContent = round(res.eirpDbm, 2) + ' dBm';
    $('pbEirpMw').textContent = round(res.eirpMw, 1) + ' mW';
    $('pbTxOut').textContent = round(res.txDbm, 2) + ' dBm';
    $('pbCableOut').textContent = minus(res.cableLossDb);
    $('pbConnOut').textContent = minus(res.connectorsLossDb);
    $('pbOtherOut').textContent = minus(res.otherLossDb);
    $('pbTotalOut').textContent = minus(res.totalLossDb);
    $('pbAntennaOut').textContent = round(res.antennaInputDbm, 2) + ' dBm';
    $('pbGainOut').textContent = '+' + round(res.antennaGainDbi, 2) + ' dBi';
    var over = $('pbOver');
    over.style.display = res.overEirpLimit ? '' : 'none';
    if (res.overEirpLimit) over.textContent = 'This EIRP (' + round(res.eirpDbm, 2) + ' dBm) is above the limit you typed (' + round(res.eirpLimitDbm, 2) + ' dBm) by ' + round(res.eirpDbm - res.eirpLimitDbm, 2) + ' dB. Lower the transmit power or the antenna gain.';
  }
  window.calculate = run;
  form.addEventListener('input', run);
  form.addEventListener('change', run);
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  run();
})(typeof window !== 'undefined' ? window : this);
