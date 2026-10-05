#!/usr/bin/env node
'use strict';
/*
 * Content-Security-Policy static check.   node tests/csp.test.js
 *
 * The site is static with no nonces, so every inline <script> must be allowed by
 * its SHA-256 in the CSP in _headers. If you edit an inline script, this test
 * fails until the hash in _headers is updated (print the expected value with
 * `node tests/csp.test.js --print`). Inline <script type="application/ld+json">
 * is data, not executed, so it needs no hash.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
const sha = (s) => "'sha256-" + crypto.createHash('sha256').update(s).digest('base64') + "'";

const headers = fs.readFileSync(path.join(ROOT, '_headers'), 'utf8').replace(/\r\n/g, '\n');
const star = /^\/\*\n((?:[ \t]+.*\n)+)/m.exec(headers);
assert.ok(star, '_headers has no /* block');
const line = star[1].split('\n').find((l) => /^\s+Content-Security-Policy(-Report-Only)?:/i.test(l));
assert.ok(line, 'no Content-Security-Policy header in the /* block');
const csp = line.replace(/^\s+[^:]+:\s*/, '').trim();
const dir = {};
csp.split(';').forEach((d) => { const p = d.trim().split(/\s+/); if (p[0]) dir[p[0]] = p.slice(1); });

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { failed++; console.log('FAIL  ' + name + '\n      ' + e.message); }
}

function pages() {
  const out = [];
  (function walk(d) {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (/node_modules|\.git$/.test(p)) continue;
      if (fs.statSync(p).isDirectory()) walk(p); else if (p.endsWith('.html')) out.push(p);
    }
  })(ROOT);
  return out;
}

if (process.argv.includes('--print')) {
  const s = new Set();
  pages().forEach((p) => {
    const h = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
    for (const m of h.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)) if (!/ld\+json/.test(m[1])) s.add(sha(m[2]));
  });
  console.log([...s].join(' ')); process.exit(0);
}

test('header line stays under the Cloudflare Pages 2000-character limit', () => {
  assert.ok(line.length < 2000, 'header line is ' + line.length + ' characters');
});

test('every inline script on every page is allowed by a SHA-256 hash', () => {
  const allowed = new Set(dir['script-src']);
  const missing = [];
  pages().forEach((p) => {
    const h = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
    for (const m of h.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)) {
      if (/ld\+json/.test(m[1])) continue;
      if (!allowed.has(sha(m[2]))) missing.push(path.relative(ROOT, p) + ' ' + sha(m[2]));
    }
  });
  assert.deepStrictEqual(missing, [], 'inline script hash missing from _headers CSP');
});

test('no stale script hashes (each hash matches some inline script)', () => {
  const live = new Set();
  pages().forEach((p) => {
    const h = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
    for (const m of h.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)) live.add(sha(m[2]));
  });
  const stale = dir['script-src'].filter((s) => s.startsWith("'sha256-") && !live.has(s));
  assert.deepStrictEqual(stale, []);
});

test('font stylesheet onload handler is allowed by hash, not unsafe-inline', () => {
  assert.ok(dir['script-src-attr'].includes("'unsafe-hashes'"));
  assert.ok(dir['script-src-attr'].includes(sha("this.media='all'")));
  assert.ok(!dir['script-src-attr'].includes("'unsafe-inline'"));
});

test('scripts: no unsafe-inline, unsafe-eval, bare scheme or bare wildcard', () => {
  [dir['script-src'], dir['script-src-attr']].forEach((v) => v.forEach((s) => {
    assert.ok(!/^'unsafe-(inline|eval)'$/.test(s), s);
    assert.ok(!/^(https?:|data:|blob:|\*)$/.test(s), s);
  }));
});

test('no directive allows a bare scheme or bare wildcard source', () => {
  Object.keys(dir).forEach((k) => dir[k].forEach((s) => assert.ok(!/^(https?:|data:|blob:|ws:|wss:|\*)$/.test(s) || (k === 'img-src' && s === 'data:'), k + ' ' + s)));
});

test('wildcard hosts are limited to the Google/ad-quality subdomains in use', () => {
  const ok = new Set(['https://*.google-analytics.com', 'https://*.adtrafficquality.google']);
  Object.values(dir).flat().filter((s) => s.includes('*')).forEach((s) => assert.ok(ok.has(s), 'unexpected wildcard ' + s));
});

test('baseline restrictive directives', () => {
  assert.deepStrictEqual(dir['default-src'], ["'self'"]);
  assert.deepStrictEqual(dir['object-src'], ["'none'"]);
  assert.deepStrictEqual(dir['base-uri'], ["'self'"]);
  assert.deepStrictEqual(dir['form-action'], ["'self'"]);
  assert.deepStrictEqual(dir['frame-ancestors'], ["'none'"]);
});

test('required third parties are allowed', () => {
  assert.ok(dir['script-src'].includes('https://pagead2.googlesyndication.com'));
  assert.ok(dir['script-src'].includes('https://www.googletagmanager.com'));
  assert.ok(dir['style-src'].includes('https://fonts.googleapis.com'));
  assert.ok(dir['font-src'].includes('https://fonts.gstatic.com'));
  assert.ok(dir['connect-src'].includes('https://*.google-analytics.com'));
  assert.ok(dir['frame-src'].includes('https://googleads.g.doubleclick.net'));
});

test('other security headers kept; X-XSS-Protection stays absent', () => {
  assert.ok(/X-Frame-Options:\s*DENY/i.test(star[1]));
  assert.ok(/Permissions-Policy:/i.test(star[1]));
  assert.ok(!/X-XSS-Protection/i.test(headers));
});

test('no page loads a script or stylesheet from an origin the CSP does not allow', () => {
  const allowedHosts = new Set([...dir['script-src'], ...dir['style-src'], ...dir['font-src']].filter((s) => s.startsWith('https://')));
  const bad = [];
  pages().forEach((p) => {
    const h = fs.readFileSync(p, 'utf8');
    for (const m of h.matchAll(/<(?:script|link rel="stylesheet")[^>]*?(?:src|href)="(https:\/\/[^/"]+)/g)) {
      if (!allowedHosts.has(m[1])) bad.push(path.relative(ROOT, p) + ' ' + m[1]);
    }
  });
  assert.deepStrictEqual(bad, []);
});

console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
