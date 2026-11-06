// IPv4 Subnet Calculator. Port of the GaugeCalc app's ip_subnet.dart.
// Addresses are held as unsigned 32-bit integers so every result is exact.
// Network = address AND mask; broadcast = network OR wildcard; usable hosts =
// 2^(32-prefix) - 2; /31 is a point-to-point link with 2 usable addresses
// (RFC 3021) and /32 is one host. Address kinds follow the IANA special-purpose
// registry (RFC 1918, RFC 6598, RFC 5737 and others). CIDR: RFC 4632.
(function (root) {
  'use strict';

  // "a.b.c.d" (1 to 3 digits per part, 0-255) -> unsigned integer, or null.
  function parse(text) {
    var parts = String(text).trim().split('.');
    if (parts.length !== 4) return null;
    var value = 0;
    for (var i = 0; i < 4; i++) {
      var p = parts[i];
      if (!/^[0-9]{1,3}$/.test(p)) return null;
      var o = parseInt(p, 10);
      if (o > 255) return null;
      value = value * 256 + o;
    }
    return value;
  }

  function format(v) {
    return [Math.floor(v / 16777216) % 256, Math.floor(v / 65536) % 256, Math.floor(v / 256) % 256, v % 256].join('.');
  }

  function maskOf(prefix) { return prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0; }

  // Four groups of eight bits, e.g. "11000000.10101000.00000001.00001010".
  function binary(v) {
    var out = [];
    for (var shift = 24; shift >= 0; shift -= 8) out.push((('00000000' + ((v >>> shift) & 255).toString(2)).slice(-8)));
    return out.join('.');
  }

  var KIND_LABELS = {
    thisNetwork: 'This network (0.0.0.0/8)',
    privateUse: 'Private address (RFC 1918)',
    sharedCgnat: 'Shared address space, carrier-grade NAT (100.64.0.0/10)',
    loopback: 'Loopback (127.0.0.0/8)',
    linkLocal: 'Link-local (169.254.0.0/16)',
    documentation: 'Documentation example (RFC 5737)',
    multicast: 'Multicast (224.0.0.0/4)',
    reserved: 'Reserved or special use',
    publicAddress: 'Public address'
  };

  function kindOf(a) {
    function within(base, prefix) { return ((a & maskOf(prefix)) >>> 0) === parse(base); }
    if (within('0.0.0.0', 8)) return 'thisNetwork';
    if (within('10.0.0.0', 8) || within('172.16.0.0', 12) || within('192.168.0.0', 16)) return 'privateUse';
    if (within('100.64.0.0', 10)) return 'sharedCgnat';
    if (within('127.0.0.0', 8)) return 'loopback';
    if (within('169.254.0.0', 16)) return 'linkLocal';
    if (within('192.0.2.0', 24) || within('198.51.100.0', 24) || within('203.0.113.0', 24)) return 'documentation';
    if (within('224.0.0.0', 4)) return 'multicast';
    if (within('240.0.0.0', 4) || within('192.0.0.0', 24) || within('198.18.0.0', 15)) return 'reserved';
    return 'publicAddress';
  }

  function describe(address, prefix) {
    var mask = maskOf(prefix);
    var wildcard = (~mask) >>> 0;
    var network = (address & mask) >>> 0;
    var broadcast = (network | wildcard) >>> 0;
    var total = Math.pow(2, 32 - prefix);
    var usable = prefix === 32 ? 1 : prefix === 31 ? 2 : total - 2;
    return {
      address: address, prefix: prefix, mask: mask, wildcard: wildcard, network: network, broadcast: broadcast,
      total: total, usableHosts: usable,
      firstHost: prefix >= 31 ? network : network + 1,
      lastHost: prefix >= 31 ? broadcast : broadcast - 1,
      kind: kindOf(address)
    };
  }

  // Equal-sized subnets of newPrefix inside the given subnet, at most `limit` (default 64).
  function split(sub, newPrefix, limit) {
    limit = limit || 64;
    if (newPrefix <= sub.prefix || newPrefix > 32) return [];
    var count = Math.pow(2, newPrefix - sub.prefix), size = Math.pow(2, 32 - newPrefix), out = [];
    for (var i = 0; i < count && i < limit; i++) out.push(describe(sub.network + i * size, newPrefix));
    return out;
  }

  // address text, prefix text (e.g. "24" or "/24") -> result or { error }.
  function calculate(addressText, prefixText) {
    var a = parse(addressText);
    if (a === null) return { error: 'address' };
    var p = String(prefixText).trim().replace(/^\//, '');
    if (!/^[0-9]{1,2}$/.test(p)) return { error: 'prefix' };
    var prefix = parseInt(p, 10);
    if (prefix > 32) return { error: 'prefix' };
    return describe(a, prefix);
  }

  var api = { parse: parse, format: format, maskOf: maskOf, binary: binary, kindOf: kindOf, describe: describe,
    split: split, calculate: calculate, KIND_LABELS: KIND_LABELS };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.GcIpv4 = api;

  /* ---------- page wiring (browser only) ---------- */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
  var form = document.getElementById('v4Form');
  if (!form) return;
  function $(id) { return document.getElementById(id); }

  function setErr(id, inputId, msg) {
    var e = $(id), i = $(inputId);
    e.style.display = msg ? '' : 'none';
    e.textContent = msg || '';
    if (msg) i.setAttribute('aria-invalid', 'true'); else i.removeAttribute('aria-invalid');
  }

  function bitRows(r) {
    function row(label, value, networkBits) {
      var bits = binary(value).replace(/\./g, ''), html = '';
      for (var i = 0; i < 32; i++) {
        html += '<span class="' + (i < networkBits ? 'bit-net' : 'bit-host') + '">' + bits.charAt(i) + '</span>';
        if (i % 8 === 7 && i < 31) html += '<span class="bit-dot">.</span>';
      }
      return '<div class="bits-row"><span class="bits-label">' + label + '</span>' + html + '</div>';
    }
    return row('Address', r.address, r.prefix) + row('Mask', r.mask, r.prefix) + row('Network', r.network, r.prefix);
  }

  function run() {
    var r = calculate($('v4Address').value, $('v4Prefix').value);
    setErr('v4AddressError', 'v4Address', r.error === 'address' ? 'Enter a valid IPv4 address such as 192.168.1.10.' : '');
    setErr('v4PrefixError', 'v4Prefix', r.error === 'prefix' ? 'Enter a prefix length from 0 to 32.' : '');
    $('v4Results').style.display = r.error ? 'none' : '';
    if (r.error) return;
    $('v4Network').textContent = format(r.network) + '/' + r.prefix;
    $('v4Caption').textContent = 'network address';
    $('v4Mask').textContent = format(r.mask);
    $('v4Wildcard').textContent = format(r.wildcard);
    $('v4Broadcast').textContent = format(r.broadcast);
    $('v4Range').textContent = format(r.firstHost) + ' – ' + format(r.lastHost);
    $('v4Hosts').textContent = r.usableHosts.toLocaleString('en-US') + (r.prefix === 31 ? ' (point-to-point, RFC 3021)' : r.prefix === 32 ? ' (single host)' : '');
    $('v4Total').textContent = r.total.toLocaleString('en-US');
    $('v4Kind').textContent = KIND_LABELS[r.kind];
    $('v4Bits').innerHTML = bitRows(r);

    var np = $('v4Split').value.trim().replace(/^\//, '');
    var list = $('v4SplitList'), note = $('v4SplitNote');
    list.innerHTML = '';
    note.textContent = '';
    if (np !== '') {
      var n = parseInt(np, 10);
      if (!/^[0-9]{1,2}$/.test(np) || n <= r.prefix || n > 32) {
        note.textContent = 'Enter a longer prefix than /' + r.prefix + ' (up to /32) to split this network.';
      } else {
        var subs = split(r, n, 64), count = Math.pow(2, n - r.prefix);
        list.innerHTML = subs.map(function (s) {
          return '<div class="result-row"><span class="k">' + format(s.network) + '/' + s.prefix + '</span><span class="v">' +
            format(s.firstHost) + ' – ' + format(s.lastHost) + '</span></div>';
        }).join('');
        note.textContent = count.toLocaleString('en-US') + ' subnets of /' + n + ' fit' + (count > 64 ? '; the first 64 are listed.' : '.');
      }
    }
  }
  window.calculate = run;
  form.addEventListener('input', run);
  form.addEventListener('change', run);
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  run();
})(typeof window !== 'undefined' ? window : this);
