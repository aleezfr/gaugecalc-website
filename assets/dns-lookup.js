// DNS Lookup over HTTPS (DoH). Runs in the visitor's browser: no backend, no key.
// The name the visitor types is sent to Cloudflare (cloudflare-dns.com) and, only
// if that fails, to Google Public DNS (dns.google). Nothing is stored.
// Record types: A, AAAA, MX, NS, TXT, CNAME (RFC 1035 / RFC 3596 type numbers).
// WHOIS is not offered: it needs TCP port 43, which a browser cannot open, and
// RDAP servers differ per top-level domain so they cannot all be allowed by the
// site's Content-Security-Policy.
(function (root) {
  'use strict';

  var TYPES = { A: 1, NS: 2, CNAME: 5, MX: 15, TXT: 16, AAAA: 28 };
  var TYPE_NAMES = {};
  Object.keys(TYPES).forEach(function (k) { TYPE_NAMES[TYPES[k]] = k; });
  var STATUS = { 0: 'No error', 1: 'The query was malformed', 2: 'The resolver could not answer (SERVFAIL)', 3: 'The name does not exist (NXDOMAIN)', 5: 'The resolver refused the query' };

  var RESOLVERS = [
    { name: 'Cloudflare', url: 'https://cloudflare-dns.com/dns-query' },
    { name: 'Google', url: 'https://dns.google/resolve' }
  ];

  var LABEL = /^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;

  // A plain ASCII domain name such as example.com.
  function validName(text) {
    var t = String(text).trim();
    if (!t || t.length > 253) return false;
    var labels = t.split('.');
    if (labels.length < 2) return false;
    if (/^[0-9.]+$/.test(t)) return false; // an address, not a domain
    return labels.every(function (l) { return LABEL.test(l); });
  }

  function typeLabel(code) { return TYPE_NAMES[code] || ('TYPE' + code); }

  // DoH JSON reply -> { ok, status, statusText, answers: [{ type, ttl, data }] }.
  function parseReply(json) {
    if (!json || typeof json.Status !== 'number') return null;
    var answers = (json.Answer || []).map(function (a) {
      var data = String(a.data == null ? '' : a.data);
      if (a.type === 16) data = data.replace(/^"|"$/g, '').replace(/"\s+"/g, '');
      return { type: typeLabel(a.type), ttl: a.TTL, data: data };
    });
    return { ok: json.Status === 0, status: json.Status, statusText: STATUS[json.Status] || ('DNS status ' + json.Status), answers: answers };
  }

  function queryUrl(resolver, name, type) {
    return resolver.url + '?name=' + encodeURIComponent(name) + '&type=' + encodeURIComponent(type);
  }

  function lookup(name, type, fetchFn) {
    var f = fetchFn || (typeof fetch === 'function' ? fetch : null);
    if (!f) return Promise.reject(new Error('fetch is not available'));
    function ask(i) {
      if (i >= RESOLVERS.length) return Promise.resolve(null);
      return f(queryUrl(RESOLVERS[i], name, type), { headers: { Accept: 'application/dns-json' } })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (j) { var p = parseReply(j); if (!p) throw new Error('bad reply'); p.resolver = RESOLVERS[i].name; return p; })
        .catch(function () { return ask(i + 1); });
    }
    return ask(0);
  }

  var api = { validName: validName, parseReply: parseReply, queryUrl: queryUrl, lookup: lookup, typeLabel: typeLabel,
    TYPES: TYPES, RESOLVERS: RESOLVERS };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.GcDns = api;

  /* ---------- page wiring (browser only) ---------- */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
  var form = document.getElementById('dnsForm');
  if (!form) return;
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var busy = false;
  function run() {
    var name = $('dnsName').value.trim().replace(/\.$/, '');
    var err = $('dnsError'), input = $('dnsName');
    if (!validName(name)) {
      err.style.display = '';
      err.textContent = 'Enter a domain name such as example.com (letters, digits and hyphens, with at least one dot).';
      input.setAttribute('aria-invalid', 'true');
      $('dnsResults').style.display = 'none';
      return;
    }
    err.style.display = 'none';
    input.removeAttribute('aria-invalid');
    if (busy) return;
    busy = true;
    var status = $('dnsStatus');
    $('dnsResults').style.display = '';
    status.textContent = 'Looking up…';
    $('dnsRows').innerHTML = '';
    lookup(name, $('dnsType').value).then(function (res) {
      busy = false;
      if (!res) { status.textContent = 'No public resolver could be reached from this browser. Check your connection or a blocker, then try again.'; return; }
      status.textContent = res.statusText + ' — answered by ' + res.resolver + '.' +
        (res.ok && !res.answers.length ? ' The name exists but has no ' + $('dnsType').value + ' record.' : '');
      $('dnsRows').innerHTML = res.answers.map(function (a) {
        return '<div class="result-row"><span class="k">' + esc(a.type) + ' <span class="hint">TTL ' + esc(a.ttl) + ' s</span></span><span class="v dns-data">' + esc(a.data) + '</span></div>';
      }).join('');
      // Tells the analytics layer (calc-ux.js) that a valid lookup really
      // finished with an answer from a resolver. Carries no data.
      try { document.dispatchEvent(new Event('gc:calculation-success')); } catch (e) { /* never affects the lookup */ }
    }).catch(function () { busy = false; status.textContent = 'The lookup failed. Try again.'; });
  }
  window.calculate = run;
  // This calculation finishes later, after the network answers, so calc-ux.js
  // must wait for 'gc:calculation-success' instead of counting the click.
  window.__gcAsyncCalculation = true;
  // Enter in the name field behaves like the Calculate button (which also reveals the result panel).
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var cta = document.querySelector('.calc-cta');
    if (cta) cta.click(); else run();
  });
})(typeof window !== 'undefined' ? window : this);
