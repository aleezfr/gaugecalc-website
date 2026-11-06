// IPv6 Subnet Calculator. Port of the GaugeCalc app's ipv6.dart: exact 128-bit
// integer arithmetic (BigInt). Kept in a file (not inline) so the site's
// hash-based Content-Security-Policy does not need a new script hash.
// Sources: RFC 4291 (loopback, unspecified, link-local, multicast, IPv4-mapped,
// global unicast 2000::/3), RFC 4193 (unique local fc00::/7), RFC 3849
// (documentation 2001:db8::/32), RFC 9637 (documentation 3fff::/20),
// RFC 5952 (shortest text form).
(function (root) {
  'use strict';

  var ALL = (1n << 128n) - 1n;

  // Parses "2001:db8::1" to a BigInt; null when invalid. Zone ids and a trailing
  // IPv4 part are not accepted.
  function parse(text) {
    var s = String(text).trim().toLowerCase();
    if (!s || s.indexOf(':::') >= 0 || !/^[0-9a-f:]+$/.test(s)) return null;
    var halves = s.split('::');
    if (halves.length > 2) return null;
    function groups(part) { return part === '' ? [] : part.split(':'); }
    var head = groups(halves[0]);
    var tail = halves.length === 2 ? groups(halves[1]) : [];
    var all = head.concat(tail);
    for (var i = 0; i < all.length; i++) if (all[i] === '' || all[i].length > 4) return null;
    if (halves.length === 1) {
      if (head.length !== 8) return null;
    } else if (head.length + tail.length > 7) {
      return null;
    }
    var fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
    var full = head.slice();
    for (var f = 0; f < fill; f++) full.push('0');
    full = full.concat(tail);
    var value = 0n;
    for (var g = 0; g < full.length; g++) value = (value << 16n) | BigInt(parseInt(full[g], 16));
    return value;
  }

  function groupsOf(a) {
    var out = [];
    for (var i = 7; i >= 0; i--) out.push(Number((a >> BigInt(16 * i)) & 0xffffn));
    return out;
  }

  function pad4(n) { return ('0000' + n.toString(16)).slice(-4); }

  // Full form: eight groups of four hex digits.
  function expand(a) { return groupsOf(a).map(pad4).join(':'); }

  // Shortest form (RFC 5952): longest run of two or more zero groups (first on
  // a tie) becomes "::"; a single zero group is not shortened.
  function compress(a) {
    var g = groupsOf(a);
    var bestStart = -1, bestLength = 0, i = 0;
    while (i < 8) {
      if (g[i] !== 0) { i++; continue; }
      var j = i;
      while (j < 8 && g[j] === 0) j++;
      if (j - i > bestLength) { bestStart = i; bestLength = j - i; }
      i = j;
    }
    function join(part) { return part.map(function (x) { return x.toString(16); }).join(':'); }
    if (bestLength < 2) return join(g);
    return join(g.slice(0, bestStart)) + '::' + join(g.slice(bestStart + bestLength));
  }

  function maskOf(prefix) { return prefix === 0 ? 0n : (ALL << BigInt(128 - prefix)) & ALL; }
  function network(a, prefix) { return a & maskOf(prefix); }
  function last(a, prefix) { return network(a, prefix) | (ALL ^ maskOf(prefix)); }
  function total(prefix) { return 1n << BigInt(128 - prefix); }
  function inside(a, base, prefix) { return network(a, prefix) === network(base, prefix); }

  var KIND_LABELS = {
    unspecified: 'Unspecified address (::)',
    loopback: 'Loopback (::1)',
    ipv4Mapped: 'IPv4-mapped (::ffff:0:0/96)',
    linkLocal: 'Link-local (fe80::/10)',
    uniqueLocal: 'Unique local, private (fc00::/7)',
    multicast: 'Multicast (ff00::/8)',
    documentation: 'Documentation example (2001:db8::/32 or 3fff::/20)',
    globalUnicast: 'Global unicast (2000::/3)',
    other: 'Other or reserved block'
  };

  function kind(a) {
    if (a === 0n) return 'unspecified';
    if (a === 1n) return 'loopback';
    if (inside(a, 0xffff00000000n, 96)) return 'ipv4Mapped';
    if (inside(a, parse('fe80::'), 10)) return 'linkLocal';
    if (inside(a, parse('fc00::'), 7)) return 'uniqueLocal';
    if (inside(a, parse('ff00::'), 8)) return 'multicast';
    if (inside(a, parse('2001:db8::'), 32) || inside(a, parse('3fff::'), 20)) return 'documentation';
    if (inside(a, parse('2000::'), 3)) return 'globalUnicast';
    return 'other';
  }

  // The 128 bits as eight groups of 16 bits.
  function binary(a) {
    var out = [];
    for (var i = 7; i >= 0; i--) {
      out.push(('0000000000000000' + ((a >> BigInt(16 * i)) & 0xffffn).toString(2)).slice(-16));
    }
    return out.join(':');
  }

  // address text + prefix text -> result object, or { error: 'address' | 'prefix' }.
  function calculate(addressText, prefixText) {
    var a = parse(addressText);
    if (a === null) return { error: 'address' };
    var p = String(prefixText).trim();
    if (!/^[0-9]{1,3}$/.test(p)) return { error: 'prefix' };
    var prefix = parseInt(p, 10);
    if (prefix > 128) return { error: 'prefix' };
    var net = network(a, prefix);
    var k = kind(a);
    return {
      address: a, prefix: prefix,
      compressed: compress(a), expanded: expand(a),
      network: net, networkCompressed: compress(net), networkText: compress(net) + '/' + prefix,
      lastCompressed: compress(last(a, prefix)),
      total: total(prefix), totalText: total(prefix).toString(),
      kind: k, kindLabel: KIND_LABELS[k],
      binary: binary(a)
    };
  }

  var api = { parse: parse, expand: expand, compress: compress, maskOf: maskOf, network: network,
    last: last, total: total, kind: kind, binary: binary, calculate: calculate, KIND_LABELS: KIND_LABELS };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.GcIpv6 = api;

  /* ---------- page wiring (browser only) ---------- */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
  var form = document.getElementById('v6Form');
  if (!form) return;
  function $(id) { return document.getElementById(id); }

  function setErr(id, inputId, msg) {
    var e = $(id), i = $(inputId);
    e.style.display = msg ? '' : 'none';
    e.textContent = msg || '';
    if (msg) i.setAttribute('aria-invalid', 'true'); else i.removeAttribute('aria-invalid');
  }

  function bitsHtml(res) {
    var groups = res.binary.split(':');
    var html = '';
    for (var g = 0; g < 8; g++) {
      var bits = groups[g], out = '';
      for (var b = 0; b < 16; b++) {
        var idx = g * 16 + b;
        out += '<span class="' + (idx < res.prefix ? 'bit-net' : 'bit-host') + '">' + bits.charAt(b) + '</span>';
      }
      html += '<div class="bits-row"><span class="bits-label">' + pad4(parseInt(bits, 2)) + '</span>' + out + '</div>';
    }
    return html;
  }

  function run() {
    var res = calculate($('v6Address').value, $('v6Prefix').value);
    setErr('v6AddressError', 'v6Address', res.error === 'address' ? 'Enter a valid IPv6 address such as 2001:db8::1 (no zone id, no IPv4 ending).' : '');
    setErr('v6PrefixError', 'v6Prefix', res.error === 'prefix' ? 'Enter a prefix length from 0 to 128.' : '');
    $('v6Results').style.display = res.error ? 'none' : '';
    if (res.error) return;
    $('v6Network').textContent = res.networkText;
    $('v6Caption').textContent = 'network (prefix /' + res.prefix + ')';
    $('v6Short').textContent = res.compressed;
    $('v6Full').textContent = res.expanded;
    $('v6Last').textContent = res.lastCompressed;
    $('v6Total').textContent = res.totalText;
    $('v6Kind').textContent = res.kindLabel;
    $('v6Bits').innerHTML = bitsHtml(res);
  }
  window.calculate = run;
  form.addEventListener('input', run);
  form.addEventListener('change', run);
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  run();
})(typeof window !== 'undefined' ? window : this);
