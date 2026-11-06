#!/usr/bin/env node
'use strict';
/*
 * Network / RF tools: IPv6 subnet, IPv4 subnet, dBm / mW, Power Budget (EIRP), RAID, DNS lookup.
 *
 *   node tests/net-tools.test.js
 *
 * No dependencies. These are the test cases of the GaugeCalc mobile app
 * (ipv6_dbm_test.dart, power_budget_test.dart, raid_calculator_test.dart,
 * ip_power_engine_test.dart) ported one to one, so the website must return the
 * same results as the app for the same inputs.
 */
const assert = require('assert');
const path = require('path');
const A = (f) => require(path.join(__dirname, '..', 'assets', f));
const v6 = A('ipv6.js'), v4 = A('ipv4-subnet.js'), dbm = A('dbm.js'), eirp = A('eirp.js'), raid = A('raid.js'), dns = A('dns-lookup.js');

let passed = 0, failed = 0;
function test(name, fn) {
  const bad = (e) => { failed++; console.log('FAIL  ' + name + '\n      ' + e.message); };
  try {
    const r = fn();
    if (r && typeof r.then === 'function') r.then(() => { passed++; }, bad); else passed++;
  } catch (e) { bad(e); }
}
const close = (a, b, eps) => assert.ok(Math.abs(a - b) <= eps, a + ' is not within ' + eps + ' of ' + b);

/* ---------------- IPv6 ---------------- */
test('IPv6 compresses to the shortest form (RFC 5952)', () => {
  const a = v6.parse('2001:0db8:85a3:0000:0000:8a2e:0370:7334');
  assert.strictEqual(v6.compress(a), '2001:db8:85a3::8a2e:370:7334');
  assert.strictEqual(v6.expand(a), '2001:0db8:85a3:0000:0000:8a2e:0370:7334');
  assert.strictEqual(v6.compress(v6.parse('::')), '::');
  assert.strictEqual(v6.compress(v6.parse('::1')), '::1');
  assert.strictEqual(v6.compress(v6.parse('2001:db8:0:1:1:1:1:1')), '2001:db8:0:1:1:1:1:1');
  assert.strictEqual(v6.compress(v6.parse('2001:0:0:1:0:0:0:1')), '2001:0:0:1::1');
});
test('IPv6 rejects bad text', () => {
  ['', '1::2::3', '12345::1', '1:2:3:4:5:6:7', 'g::1', ':::', '::1%eth0', '::ffff:1.2.3.4'].forEach((b) => assert.strictEqual(v6.parse(b), null, b));
  assert.notStrictEqual(v6.parse('1:2:3:4:5:6:7:8'), null);
  assert.notStrictEqual(v6.parse('1:2:3:4:5:6:7::'), null);
});
test('IPv6 network, last address and total follow the prefix', () => {
  const a = v6.parse('2001:db8:85a3:1234:5678:9abc:def0:1234');
  assert.strictEqual(v6.compress(v6.network(a, 64)), '2001:db8:85a3:1234::');
  assert.strictEqual(v6.compress(v6.last(a, 64)), '2001:db8:85a3:1234:ffff:ffff:ffff:ffff');
  assert.strictEqual(v6.total(64), 1n << 64n);
  assert.strictEqual(v6.total(128), 1n);
  assert.strictEqual(v6.total(0), 1n << 128n);
  assert.strictEqual(v6.network(a, 0), 0n);
  assert.strictEqual(v6.network(a, 128), a);
});
test('IPv6 kinds follow the standard blocks', () => {
  const k = (s) => v6.kind(v6.parse(s));
  assert.strictEqual(k('::'), 'unspecified');
  assert.strictEqual(k('::1'), 'loopback');
  assert.strictEqual(k('::ffff:0:0'), 'ipv4Mapped');
  assert.strictEqual(k('fe80::1'), 'linkLocal');
  assert.strictEqual(k('fd12:3456::1'), 'uniqueLocal');
  assert.strictEqual(k('ff02::1'), 'multicast');
  assert.strictEqual(k('2001:db8::1'), 'documentation');
  assert.strictEqual(k('3fff::1'), 'documentation');
  assert.strictEqual(k('2606:4700::1'), 'globalUnicast');
  assert.strictEqual(k('4000::1'), 'other');
});
test('IPv6 calculate: page result and errors (app screen test)', () => {
  const r = v6.calculate('2001:db8:85a3::8a2e:370:7334', '64');
  assert.strictEqual(r.networkText, '2001:db8:85a3::/64');
  assert.strictEqual(r.expanded, '2001:0db8:85a3:0000:0000:8a2e:0370:7334');
  assert.strictEqual(r.totalText, '18446744073709551616');
  assert.strictEqual(v6.calculate('2001:db8:85a3::8a2e:370:7334', '129').error, 'prefix');
  assert.strictEqual(v6.calculate('2001:db8:85a3::8a2e:370:7334', '').error, 'prefix');
  assert.strictEqual(v6.calculate('1::2::3', '64').error, 'address');
});
test('IPv6 binary view: 2001 is 0010000000000001', () => {
  assert.ok(v6.calculate('2001:db8::1', '64').binary.startsWith('0010000000000001:0000110110111000'));
});

/* ---------------- IPv4 ---------------- */
const sub = (ip, p) => v4.describe(v4.parse(ip), p);
test('IPv4 parse and format', () => {
  assert.strictEqual(v4.format(v4.parse('192.168.1.10')), '192.168.1.10');
  assert.strictEqual(v4.parse('0.0.0.0'), 0);
  assert.strictEqual(v4.parse('255.255.255.255'), 0xFFFFFFFF);
  ['', '1.2.3', '1.2.3.4.5', '256.1.1.1', '1.2.3.-4', 'a.b.c.d', '1.2.3.1000', '1..3.4'].forEach((b) => assert.strictEqual(v4.parse(b), null, b));
});
test('IPv4 binary view', () => {
  assert.strictEqual(v4.binary(v4.parse('192.168.1.10')), '11000000.10101000.00000001.00001010');
});
test('IPv4 /24 and /20 hand checks', () => {
  const s = sub('192.168.1.10', 24);
  assert.strictEqual(v4.format(s.mask), '255.255.255.0');
  assert.strictEqual(v4.format(s.wildcard), '0.0.0.255');
  assert.strictEqual(v4.format(s.network), '192.168.1.0');
  assert.strictEqual(v4.format(s.broadcast), '192.168.1.255');
  assert.strictEqual(v4.format(s.firstHost), '192.168.1.1');
  assert.strictEqual(v4.format(s.lastHost), '192.168.1.254');
  assert.strictEqual(s.total, 256);
  assert.strictEqual(s.usableHosts, 254);
  const t = sub('10.1.2.3', 20);
  assert.strictEqual(v4.format(t.mask), '255.255.240.0');
  assert.strictEqual(v4.format(t.network), '10.1.0.0');
  assert.strictEqual(v4.format(t.broadcast), '10.1.15.255');
  assert.strictEqual(t.usableHosts, 4094);
});
test('IPv4 /30, /31, /32 and /0', () => {
  const s30 = sub('10.0.0.5', 30);
  assert.strictEqual(s30.usableHosts, 2);
  assert.strictEqual(v4.format(s30.firstHost), '10.0.0.5');
  assert.strictEqual(v4.format(s30.lastHost), '10.0.0.6');
  const s31 = sub('10.0.0.4', 31);
  assert.strictEqual(s31.usableHosts, 2);
  assert.strictEqual(v4.format(s31.firstHost), '10.0.0.4');
  assert.strictEqual(v4.format(s31.lastHost), '10.0.0.5');
  const s32 = sub('10.0.0.4', 32);
  assert.strictEqual(s32.usableHosts, 1);
  assert.strictEqual(v4.format(s32.firstHost), '10.0.0.4');
  const s0 = sub('1.2.3.4', 0);
  assert.strictEqual(v4.format(s0.mask), '0.0.0.0');
  assert.strictEqual(s0.total, 4294967296);
  assert.strictEqual(s0.usableHosts, 4294967294);
  assert.strictEqual(v4.format(s0.broadcast), '255.255.255.255');
});
test('IPv4 splitting', () => {
  const s = sub('192.168.1.0', 24);
  assert.deepStrictEqual(v4.split(s, 26).map((p) => v4.format(p.network) + '/' + p.prefix),
    ['192.168.1.0/26', '192.168.1.64/26', '192.168.1.128/26', '192.168.1.192/26']);
  assert.deepStrictEqual(v4.split(s, 24), []);
  assert.strictEqual(v4.split(sub('10.0.0.0', 8), 24, 5).length, 5);
  assert.strictEqual(v4.split(sub('10.0.0.0', 8), 24).length, 64);
});
test('IPv4 kinds', () => {
  const k = (ip) => v4.kindOf(v4.parse(ip));
  assert.strictEqual(k('10.20.30.40'), 'privateUse');
  assert.strictEqual(k('172.16.0.1'), 'privateUse');
  assert.strictEqual(k('172.31.255.255'), 'privateUse');
  assert.strictEqual(k('172.32.0.1'), 'publicAddress');
  assert.strictEqual(k('192.168.0.1'), 'privateUse');
  assert.strictEqual(k('100.64.0.1'), 'sharedCgnat');
  assert.strictEqual(k('127.0.0.1'), 'loopback');
  assert.strictEqual(k('169.254.10.10'), 'linkLocal');
  assert.strictEqual(k('192.0.2.5'), 'documentation');
  assert.strictEqual(k('224.0.0.1'), 'multicast');
  assert.strictEqual(k('255.255.255.255'), 'reserved');
  assert.strictEqual(k('0.0.0.0'), 'thisNetwork');
  assert.strictEqual(k('8.8.8.8'), 'publicAddress');
});
test('IPv4 calculate errors', () => {
  assert.strictEqual(v4.calculate('1.2.3', '24').error, 'address');
  assert.strictEqual(v4.calculate('1.2.3.4', '33').error, 'prefix');
  assert.strictEqual(v4.calculate('1.2.3.4', '').error, 'prefix');
  assert.strictEqual(v4.calculate('1.2.3.4', '/24').prefix, 24);
});

/* ---------------- dBm ---------------- */
test('dBm converts between units', () => {
  const a = dbm.from(20, 'dbm');
  close(a.mw, 100, 1e-9); close(a.watts, 0.1, 1e-12); close(a.dbw, -10, 1e-9);
  close(dbm.from(0, 'dbm').mw, 1, 1e-12);
  close(dbm.from(1, 'w').dbm, 30, 1e-9);
  close(dbm.from(100, 'mw').dbm, 20, 1e-9);
  close(dbm.from(0, 'dbw').dbm, 30, 1e-9);
  close(dbm.from(3, 'dbm').mw, 1.99526, 1e-4);
});
test('dBm rejects values outside the range', () => {
  assert.strictEqual(dbm.from(0, 'mw'), null);
  assert.strictEqual(dbm.from(-1, 'w'), null);
  assert.strictEqual(dbm.from(101, 'dbm'), null);
  assert.strictEqual(dbm.from(-201, 'dbm'), null);
  assert.strictEqual(dbm.from(NaN, 'dbm'), null);
  assert.notStrictEqual(dbm.from(100, 'dbm'), null);
  assert.notStrictEqual(dbm.from(-200, 'dbm'), null);
});
test('dBm number text', () => {
  assert.strictEqual(dbm.fmt(100), '100');
  assert.strictEqual(dbm.fmt(-10), '-10');
  assert.strictEqual(dbm.fmt(1.99526), '1.9953');
  assert.strictEqual(dbm.fmt(0), '0');
});

/* ---------------- Power budget (EIRP) ---------------- */
const plan = (o) => eirp.calculate(Object.assign({ txPower: '20', antennaGain: '15', cableLossPer100: '20', cableLength: '10',
  connectors: '2', connectorLoss: '0.2', otherLoss: '1', eirpLimit: '' }, o || {}));
test('EIRP guide example: 20 dBm, 2 dB cable, 0.4 dB, 1 dB, 15 dBi', () => {
  const p = plan();
  close(p.cableLossDb, 2, 1e-9); close(p.connectorsLossDb, 0.4, 1e-9); close(p.totalLossDb, 3.4, 1e-9);
  close(p.antennaInputDbm, 16.6, 1e-9); close(p.eirpDbm, 31.6, 1e-9); close(p.eirpMw, 1445.4, 0.1);
});
test('EIRP: empty losses mean none and the gain adds straight on', () => {
  const p = eirp.calculate({ txPower: '20', antennaGain: '15' });
  assert.strictEqual(p.totalLossDb, 0); assert.strictEqual(p.eirpDbm, 35); close(p.eirpMw, 3162.28, 0.01);
});
test('EIRP: the limit only warns when the EIRP is above it', () => {
  assert.strictEqual(plan({ eirpLimit: '30' }).overEirpLimit, true);
  assert.strictEqual(plan({ eirpLimit: '31.6' }).overEirpLimit, false);
  assert.strictEqual(plan({ eirpLimit: '36' }).overEirpLimit, false);
  assert.strictEqual(plan().overEirpLimit, false);
});
test('EIRP: names the field that is wrong', () => {
  assert.strictEqual(plan({ txPower: 'x' }).error, 'txPower');
  assert.strictEqual(plan({ txPower: '61' }).error, 'txPower');
  assert.strictEqual(plan({ antennaGain: '' }).error, 'antennaGain');
  assert.strictEqual(plan({ cableLossPer100: '-1' }).error, 'cableLossPer100');
  assert.strictEqual(plan({ cableLength: '20000' }).error, 'cableLength');
  assert.strictEqual(plan({ connectors: '1.5' }).error, 'connectors');
  assert.strictEqual(plan({ connectors: '51' }).error, 'connectors');
  assert.strictEqual(plan({ connectorLoss: '9' }).error, 'connectorLoss');
  assert.strictEqual(plan({ otherLoss: '61' }).error, 'otherLoss');
  assert.strictEqual(plan({ eirpLimit: 'x' }).error, 'eirpLimit');
  assert.strictEqual(plan().error, undefined);
});
test('EIRP: commas work as decimal marks', () => {
  close(plan({ cableLossPer100: '20,5' }).cableLossDb, 2.05, 1e-9);
});

/* ---------------- RAID ---------------- */
const level = (all, l) => all.find((r) => r.level === l);
test('RAID 4 disks of 8 TB, the guide example', () => {
  const four = raid.compare('4', '8', 'tb');
  assert.strictEqual(level(four, 'raid0').usableTb, 32);
  assert.strictEqual(level(four, 'raid1').usableTb, 8);
  assert.strictEqual(level(four, 'raid5').usableTb, 24);
  assert.strictEqual(level(four, 'raid6').usableTb, 16);
  assert.strictEqual(level(four, 'raid10').usableTb, 16);
  assert.strictEqual(level(four, 'raid5').efficiencyPercent, 75);
  assert.strictEqual(level(four, 'raid1').efficiencyPercent, 25);
  assert.strictEqual(level(four, 'raid0').efficiencyPercent, 100);
  close(level(four, 'raid5').usableTib, 21.83, 0.01);
});
test('RAID fault tolerance of each level', () => {
  const four = raid.compare('4', '8', 'tb');
  assert.strictEqual(level(four, 'raid0').failuresSurvived, 0);
  assert.strictEqual(level(four, 'raid1').failuresSurvived, 3);
  assert.strictEqual(level(four, 'raid5').failuresSurvived, 1);
  assert.strictEqual(level(four, 'raid6').failuresSurvived, 2);
  assert.strictEqual(level(four, 'raid10').failuresSurvived, 1);
  assert.strictEqual(level(four, 'raid10').failuresBestCase, 2);
  assert.strictEqual(level(four, 'raid5').failuresBestCase, 1);
});
test('RAID needs its minimum number of disks', () => {
  const two = raid.compare('2', '4', 'tb');
  assert.strictEqual(level(two, 'raid0').available, true);
  assert.strictEqual(level(two, 'raid1').available, true);
  assert.strictEqual(level(two, 'raid5').available, false);
  assert.strictEqual(level(two, 'raid6').available, false);
  assert.strictEqual(level(two, 'raid10').available, false);
  assert.strictEqual(level(two, 'raid5').usableTb, 0);
  assert.ok(raid.compare('1', '4', 'tb').every((r) => !r.available));
});
test('RAID 10 needs an even number of disks', () => {
  assert.strictEqual(level(raid.compare('5', '4', 'tb'), 'raid10').available, false);
  const six = level(raid.compare('6', '4', 'tb'), 'raid10');
  assert.strictEqual(six.available, true); assert.strictEqual(six.usableTb, 12); assert.strictEqual(six.failuresBestCase, 3);
});
test('RAID GB and TB, decimal sizes and comma marks', () => {
  assert.strictEqual(level(raid.compare('3', '8000', 'gb'), 'raid5').usableTb, 16);
  assert.strictEqual(level(raid.compare('2', '0,5', 'tb'), 'raid0').usableTb, 1);
});
test('RAID wrong entries name the field', () => {
  const bad = (d, s, u) => raid.compare(d, s, u || 'tb').error;
  assert.strictEqual(bad('0', '8'), 'disks'); assert.strictEqual(bad('101', '8'), 'disks'); assert.strictEqual(bad('x', '8'), 'disks');
  assert.strictEqual(bad('4', '0'), 'size'); assert.strictEqual(bad('4', '-1'), 'size'); assert.strictEqual(bad('4', 'x'), 'size');
  assert.strictEqual(bad('4', '0.0001'), 'size'); assert.strictEqual(bad('4', '200000'), 'size'); assert.strictEqual(bad('4', '0.5', 'gb'), 'size');
  assert.strictEqual(bad('4', '8'), undefined);
});

/* ---------------- DNS lookup ---------------- */
test('DNS name validation matches the app', () => {
  ['example.com', 'sub.example.co.uk', 'a-b.example.org', 'EXAMPLE.com'].forEach((n) => assert.strictEqual(dns.validName(n), true, n));
  ['', 'localhost', '1.2.3.4', '-a.com', 'a-.com', 'a b.com', 'a..com', 'exa_mple.com', 'http://example.com', 'x'.repeat(64) + '.com'].forEach((n) => assert.strictEqual(dns.validName(n), false, n));
});
test('DNS reply parsing (DoH JSON)', () => {
  const r = dns.parseReply({ Status: 0, Answer: [{ name: 'example.com', type: 15, TTL: 270, data: '10 mail.example.com.' }, { name: 'example.com', type: 16, TTL: 60, data: '"v=spf1 " "-all"' }] });
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.answers.map((a) => a.type), ['MX', 'TXT']);
  assert.strictEqual(r.answers[1].data, 'v=spf1 -all');
  assert.strictEqual(dns.parseReply({ Status: 3 }).statusText, 'The name does not exist (NXDOMAIN)');
  assert.strictEqual(dns.parseReply({ Status: 0 }).answers.length, 0);
  assert.strictEqual(dns.parseReply({}), null);
});
test('DNS lookup falls back to the second resolver and names the one that answered', async () => {
  const urls = [];
  const fakeFetch = (url) => {
    urls.push(url);
    if (url.startsWith('https://cloudflare-dns.com/')) return Promise.reject(new Error('blocked'));
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ Status: 0, Answer: [{ type: 1, TTL: 5, data: '93.184.216.34' }] }) });
  };
  const res = await dns.lookup('example.com', 'A', fakeFetch);
  assert.strictEqual(res.resolver, 'Google');
  assert.strictEqual(res.answers[0].data, '93.184.216.34');
  assert.ok(urls[0].startsWith('https://cloudflare-dns.com/dns-query?name=example.com&type=A'));
  assert.strictEqual(await dns.lookup('example.com', 'A', () => Promise.reject(new Error('x'))), null);
});

// the async DNS test is awaited before the summary
setTimeout(() => {
  console.log(passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}, 50);
