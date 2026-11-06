# Website vs mobile app: gap list (6 November 2026)

Recommendation: **done** = added in this pass, **add** = port next, **improve** = page exists, app version is richer, **app-only** = cannot run in a browser.

## Calculators (app: 20)

| App calculator | Website | Recommendation |
|---|---|---|
| IP Camera Bandwidth | `ip-camera-bandwidth-calculator` | improve: codec comparison |
| CCTV Storage | `cctv-storage-calculator` | improve: retention comparison, total bandwidth |
| PoE Budget | `poe-budget-calculator` | none found |
| CCTV Voltage Drop | `cctv-voltage-drop-calculator` | none found |
| Lens Calculator | only inside `field-of-view-calculator` | add (focal-length comparison, drawing) |
| Viewing Angle | missing | add |
| DORI | missing | add (px/m and px/ft; car and number plate drawing, never faces) |
| FOV and DORI Planner | `field-of-view-calculator` has FOV only | improve: add DORI levels |
| NVR Storage | `nvr-storage-calculator` | none found |
| Battery / UPS Runtime | `battery-backup-calculator` | improve: runtime at several load levels |
| PoE Cable Distance | missing | add |
| Fiber Link Budget | missing | add |
| VLSM Subnet Planner | missing | add |
| Wireless Link Planner | missing | add (FSPL, fade margin, Fresnel, range chart) |
| Switch Uplink Planner | missing | add |
| Camera Tilt | missing | add (side drawing) |
| Cable Run Limits | missing | add |
| DC Power Supply | missing | add |
| NVR Capacity | missing | add |
| Battery Bank Sizing | `battery-amp-hour-calculator` is related, not the same | add |

## Tools (app: 10)

| App tool | Website | Recommendation |
|---|---|---|
| IP / Subnet (IPv4, binary view) | `tools/ipv4-subnet-calculator` | **done** |
| IPv6 Subnet | `tools/ipv6-subnet-calculator` | **done** |
| dBm / mW | `tools/dbm-to-mw-converter` | **done** |
| Power Budget (EIRP) | `tools/eirp-power-budget-calculator` | **done** |
| RAID Calculator | `tools/raid-calculator` | **done** |
| Network Tests: DNS lookup | `tools/dns-lookup` (DNS over HTTPS) | **done** |
| Network Tests: WHOIS | RDAP servers differ per top-level domain, so the CSP cannot allow them | app-only (card on the DNS page) |
| Network Tests: TCP ping, port test, find devices, ONVIF check | a browser cannot open raw sockets or scan the LAN | app-only (card on the DNS page) |
| Screen Ruler | needs the physical screen scale | app-only (card on the DNS page) |
| Unit Converter | missing | add |
| Length / Area | missing | add |
| Power / Data | missing | add |

## Guides (app: 5)

| App guide | Website | Recommendation |
|---|---|---|
| First Login and Reset | `blog/first-login-and-reset-cctv-cameras` | **done** |
| Ports and Protocols | `blog/ports-and-protocols-for-cctv-networks` | **done** |
| RJ45 Cable Wiring | missing | add |
| Terms and Definitions | missing | add |
| Security Assessment | missing | add |

## On the website only (not in the app)

Electrical Box Fill, Wire Size, Conduit Fill, Voltage Drop (general), Amp-Hour, Field of View. Keep.

## Open source questions

- Hikvision "admin / 12345 on firmware 5.2.0 or older": the legacy Hikvision host in the app's source list (`us-legacy.hikvision.com`) did not resolve on 6 Nov 2026, so the value was not copied to the website, only the link. Needs a live Hikvision source.
- Dahua password length rule: the app does not quote it either (search results were ambiguous).
- The app's store link is not in either repo, so the "Get the app" card has no link yet.
