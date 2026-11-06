// RAID Calculator. Port of the GaugeCalc app's raid_levels.dart. Standard
// definitions for n equal disks:
//   RAID 0: n x disk, no failure survived          RAID 1: 1 x disk, n-1 failures
//   RAID 5: (n-1) x disk, 1 failure, from 3 disks  RAID 6: (n-2) x disk, 2 failures, from 4 disks
//   RAID 10: n/2 x disk, from 4 disks, even count; 1 failure always, up to 1 per mirrored pair
(function (root) {
  'use strict';

  var LEVELS = ['raid0', 'raid1', 'raid5', 'raid6', 'raid10'];
  var NAMES = { raid0: 'RAID 0', raid1: 'RAID 1', raid5: 'RAID 5', raid6: 'RAID 6', raid10: 'RAID 10' };
  var MIN = { raid0: 2, raid1: 2, raid5: 3, raid6: 4, raid10: 4 };
  var MAX_DISKS = 100, MIN_DISK_TB = 0.001, MAX_DISK_TB = 100000;

  function isAvailable(level, disks) {
    return disks >= MIN[level] && (level !== 'raid10' || disks % 2 === 0);
  }

  function dataDisks(level, n) {
    switch (level) {
      case 'raid0': return n;
      case 'raid1': return 1;
      case 'raid5': return n - 1;
      case 'raid6': return n - 2;
      default: return n / 2;
    }
  }

  function failures(level, n) {
    switch (level) {
      case 'raid0': return 0;
      case 'raid1': return n - 1;
      case 'raid5': return 1;
      case 'raid6': return 2;
      default: return 1;
    }
  }

  // disks text, size text, unit 'gb'|'tb' -> array of results, or { error: 'disks'|'size' }.
  function compare(disksText, sizeText, unit) {
    var d = String(disksText).trim();
    if (!/^\d+$/.test(d)) return { error: 'disks' };
    var n = parseInt(d, 10);
    if (n < 1 || n > MAX_DISKS) return { error: 'disks' };
    var s = String(sizeText).trim().replace(',', '.');
    if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return { error: 'size' };
    var value = Number(s);
    if (!isFinite(value) || value <= 0) return { error: 'size' };
    var tb = unit === 'tb' ? value : value / 1000;
    if (tb < MIN_DISK_TB || tb > MAX_DISK_TB) return { error: 'size' };
    return LEVELS.map(function (level) {
      var ok = isAvailable(level, n);
      var usable = ok ? dataDisks(level, n) * tb : 0;
      var raw = n * tb;
      return {
        level: level, name: NAMES[level], disks: n, diskTb: tb, available: ok, minimumDisks: MIN[level],
        usableTb: usable, rawTb: raw,
        efficiencyPercent: raw > 0 ? usable / raw * 100 : 0,
        failuresSurvived: ok ? failures(level, n) : 0,
        failuresBestCase: ok && level === 'raid10' ? n / 2 : (ok ? failures(level, n) : 0),
        usableTib: usable * 1e12 / 1099511627776
      };
    });
  }

  var api = { compare: compare, isAvailable: isAvailable, LEVELS: LEVELS, NAMES: NAMES };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.GcRaid = api;

  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
  var form = document.getElementById('raidForm');
  if (!form) return;
  function $(id) { return document.getElementById(id); }
  function r(n, d) { return String(Math.round(n * Math.pow(10, d)) / Math.pow(10, d)); }

  function run() {
    var res = compare($('raidDisks').value, $('raidSize').value, $('raidUnit').value);
    var err = $('raidError');
    ['raidDisks', 'raidSize'].forEach(function (id) { $(id).removeAttribute('aria-invalid'); });
    err.style.display = res.error ? '' : 'none';
    if (res.error) {
      $(res.error === 'disks' ? 'raidDisks' : 'raidSize').setAttribute('aria-invalid', 'true');
      err.textContent = res.error === 'disks' ? 'Enter a whole number of disks from 1 to 100.'
        : 'Enter a disk size above zero (0.001 TB to 100000 TB).';
    }
    $('raidResults').style.display = res.error ? 'none' : '';
    if (res.error) return;
    var max = 0;
    res.forEach(function (x) { if (x.usableTb > max) max = x.usableTb; });
    var html = '';
    res.forEach(function (x) {
      if (!x.available) {
        var why = x.level === 'raid10' && x.disks >= 4 ? 'needs an even number of disks' : 'needs at least ' + x.minimumDisks + ' disks';
        html += '<div class="raid-card is-off"><h3>' + x.name + '</h3><p class="raid-big">Not possible</p><p class="hint">' + x.name + ' ' + why + '.</p></div>';
        return;
      }
      var fail = x.failuresBestCase > x.failuresSurvived ? x.failuresSurvived + '–' + x.failuresBestCase : String(x.failuresSurvived);
      html += '<div class="raid-card"><h3>' + x.name + '</h3><p class="raid-big">' + r(x.usableTb, 2) + ' TB</p>' +
        '<div class="raid-bar" aria-hidden="true"><span style="width:' + (max > 0 ? Math.max(2, x.usableTb / max * 100) : 0) + '%"></span></div>' +
        '<div class="result-row"><span class="k">Efficiency</span><span class="v">' + r(x.efficiencyPercent, 1) + ' %</span></div>' +
        '<div class="result-row"><span class="k">Disks that can fail</span><span class="v">' + fail + '</span></div>' +
        '<div class="result-row"><span class="k">Windows shows about</span><span class="v">' + r(x.usableTib, 2) + ' TiB</span></div></div>';
    });
    $('raidCards').innerHTML = html;
    $('raidRaw').textContent = r(res[0].rawTb, 2) + ' TB raw (' + res[0].disks + ' × ' + r(res[0].diskTb, 3) + ' TB)';
  }
  window.calculate = run;
  form.addEventListener('input', run);
  form.addEventListener('change', run);
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  run();
})(typeof window !== 'undefined' ? window : this);
