# Electrical Box Fill Calculator (NEC 314.16) — Implementation Specification

Status: RESEARCH / SPECIFICATION ONLY (revision 2, 2026-10-05). No calculator page, asset, nav entry, sitemap entry or homepage entry has been created or changed.
Proposed URL: `/tools/electrical-box-fill-calculator`
Publication warning: GaugeCalc deploys the repo as-is, so this `docs/` folder would be publicly reachable at `/docs/...`. See section 23, item 2, before the first commit of this file.

---

## 0. Revision 2 change log and evidence labels

### 0.1 What changed since revision 1
| Change | Why |
|---|---|
| **Primary NFPA code-development records were obtained and read** (CMP-8 First Draft public-input responses, First Revisions, Second Draft output). Revision 1 had only secondary sources. | Section 3A. Raises most gates from "multi-source" to "NFPA-record verified". |
| 6 AWG metric value corrected **82.0 → 81.9 cm³** (5.00 in³ unchanged). | NFPA draft table prints 81.9; an older NEC reproduction also prints 81.9. Competitors' 82.0 is wrong. |
| Table 314.16(B) is captioned **"Table 314.16(B)(1)"** in the NFPA record; the claim of "Table 314.16(B)(4)" is **not supported** and must not be used. | Section 3A.3. |
| Terminal blocks moved **v1.1 → V1** (rule text is verbatim in the NFPA record). | Section 6. |
| Wide devices / multiple gangs: **V1** (verbatim). Barriered boxes: **V1.1** with a defined model and a v1 notice. | Section 6.9. |
| Masonry, FS and FD boxes added to the picker (all 24 Table 314.16(A) rows), no longer "unverified". | Section 6.3. Every printed max-conductor count matches `floor(V ÷ allowance)`. |
| The proposed 2026 grounding change ("one full allowance per additional four") is documented as **proposed and rejected**; the ¼ rule stays. Regression test added. | Section 3A.4. |
| 4 AWG and larger wording corrected: such boxes "shall **also** comply with 314.28" — 314.16 still applies to ≤ 6 AWG contents but the table cannot size ≥ 4 AWG. | Section 6.8. |
| New gate table "2026 NEC Verification Gate" (section 7). | Requested. |
| Receipt model now Input → Rule → Qty → Allowance → Multiplier → Volume → Subtotal → Total → Capacity → Result. | Sections 8, 11. |

### 0.2 Evidence labels (applied to every critical rule)
| Label | Meaning in this document |
|---|---|
| **CONFIRMED** | Verbatim in an **official NFPA code-development record for the 2026 edition cycle** (First Revision or the public-input record that reproduces the current text), with no contrary Second Revision, and not contradicted by any other source. |
| **CORROBORATED** | Not read verbatim in a 2026-cycle NFPA record, but supported by verbatim older-edition code text and/or 2023–2026-labelled training/trade sources that agree, and no 2026-cycle revision to that text was found. |
| **INTERPRETATION** | A GaugeCalc implementation decision where the code text leaves room. Must be disclosed in the UI. |
| **UNVERIFIED — DO NOT IMPLEMENT** | Not confirmed. Must not ship. |
| UI/PRODUCT | Product decision, not a code requirement. |

### 0.3 Honest limits that remain
- The **printed NFPA 70-2026 book** (final adopted text) was not read. The NFPA free-access reader is JavaScript-only and was not reachable. The evidence is NFPA's own development records for the 2026 cycle plus corroboration. Section 21 lists the one remaining non-blocking spot check.
- NFPA public-comment responses for CMP-8 were not read in full; only the Second Draft working output (which lists Second Revisions) was read.
- No keyword volume, difficulty or ranking data exist in this document.

---

## 1. Executive summary

- **Demand and fit.** "Box fill" is a recurring electrician/inspector/DIY task with a bounded formula. It extends GaugeCalc's "Electrical & Wiring" category (today only Voltage Drop). No existing GaugeCalc page overlaps.
- **Competition is crowded** (25+ tools observed) but uneven. No reviewed tool combines cable-based input, a check mode and minimum-box mode with a "why smaller boxes fail" ladder, a rule-referenced receipt, and a diagram driven by the user's own inputs.
- **Methodology is now substantially verified.** NFPA's own 2026-cycle records reproduce the device, grounding, terminal-block and general-clause text; confirm that the proposed grounding change was **rejected**; and confirm the new "splicing connectors" language. Table 314.16(A) and Table 314.16(B) values are reproduced in NFPA's record and are internally consistent.
- **Edition.** NFPA lists **NFPA 70, 2026 edition** as its current NEC product, and NFPA issued 2026-edition TIAs in April 2026 (section 3A.1). The calculator targets the 2026 NEC. For every implemented rule, 2020/2023/2026 give identical results.
- **Scope is not artificially simplified.** V1 includes conductors #18–#6, cables and loose conductors, pass-throughs, loops, EGCs with the ¼ rule, clamps, support fittings by type, yokes with wide-device gangs, terminal blocks, marked and add-on volume, all 24 standard boxes, check and minimum-box modes, receipt and live diagram. Barriered boxes follow in V1.1 with a v1 notice.
- **Decision: BUILD** (section 22). No hard blocker remains; one non-blocking printed-book spot check is required before the page claims "reviewed against NFPA 70-2026".

---

## 2. Repository findings (read-only inspection)

| Area | Finding |
|---|---|
| Stack | Plain static HTML/CSS/JS, no build step, no `package.json`, no test runner. `CLAUDE.md` forbids bundlers/frameworks. |
| Calculator pattern | One self-contained HTML file per tool in `tools/`. Head: AdSense loader + `google-adsense-account` meta, theme bootstrap, viewport, `<title>`, description, self-canonical, OG/Twitter, favicons, Google Fonts (Archivo, IBM Plex Sans, IBM Plex Mono), `../assets/style.css?v=…`. |
| Shared assets | `assets/style.css` (~2,030 lines, tokens incl. `--brand`, `--accent`, `--accent-light`, `--surface`, `--border`, `--warn-*`; dark mode via `prefers-color-scheme` and `[data-theme="dark"]`), `theme.js`, `nav.js` (single model for sidebar/menu/search), `calc-ux.js` (Calculate / Reset / Recalculate, jump to result). |
| Page skeleton | `section.hero` (H1, lead, byline) → `div.calc-layout` with `div.panel` (inputs; `.field`, `.field-row`, `.field-error role="alert"`) and `.result-panel` (`role="status"` `aria-live="polite"`) → `article` (formula explanation, worked examples, Assumptions and limitations, Common mistakes, FAQ H3s, Related tools, feedback link). |
| Schema pattern | `SoftwareApplication` (`UtilitiesApplication`, free `Offer`, publisher), `BreadcrumbList`, `FAQPage` matching the visible FAQ. No ratings/reviews. |
| Visual pattern | Hand-written inline SVG in `<figure>` with `role="img"`, `<title>`, `<desc>`, `aria-labelledby`, theme variables, `width:100%;max-width:460px;height:auto`, `<figcaption>` (Battery Backup and Analog vs IP pages). Earlier audit note: text in a 360-wide viewBox renders ~9 px at 320 px — design this diagram for ≥ 11 px rendered. |
| Navigation | `nav.js` category `electrical-wiring` has 1 calculator. Adding a tool = nav entry + `index.html` card + homepage `ItemList` position + `sitemap.xml` (currently 20 URLs → 21). |
| Overlap / cannibalization | Repo contains no NEC 314.16, box-fill or junction-box content. None. Voltage Drop is the natural link partner. |
| Testing | No test harness in the repo. Prior audits used throwaway Node scripts and headless browser checks. A reference model for this spec (section 19) and a Table 314.16(A) consistency check were run from scratch files outside the repo. |
| Ads | AdSense site-wide loader + meta tag; ad-slot markup only as HTML comments. The new page copies the same head; no ad units. |

---

## 3. Competitor analysis

### 3.1 Method and honesty notes
- 9 tools were fetched and read as text: boxfillcalculator.com, calcshed.com, electricalcalctools.com, elecalculator.com, intrysys.com, calcexp.com, electricalsuite.com, electricianprep.co, turn2engineering.com. onlycalculators.com and getlicenseready.com returned HTTP 429. Competitor pages were used **only as secondary corroboration** in revision 2.
- Text extraction is not interactive testing; live features may be under-reported. Some summarizer-generated "weaknesses" were factually wrong about the NEC and were discarded.

### 3.2 Competitor matrix (condensed)
| # | Tool | Modes | Inputs | Devices | Grounds | Clamp / fittings | Pigtail / pass / loop | Boxes | Min-box | Breakdown | Visual | Edition |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | boxfillcalculator.com | check | AWG+count | count | single field; no >4 rule | clamp field; fittings per type (text) | not covered | presets + custom | no | itemised | none | 2023 |
| 2 | calcshed.com | std / auto / advanced | per AWG, mixed | per gang | edition-aware ¼ rule | clamp; fittings by type | pigtail excluded; loops (advanced) | table picker + marked | **auto smallest** | in article | static component map | 2026/23/20/17 |
| 3 | electricalcalctools.com | check | rows by AWG | 2× | pooled | clamp only | manual | ~11 presets | no | category table | minimal | unpinned |
| 4 | elecalculator.com | check / size / max | single largest AWG | numeric | checkbox | clamp binary | absent | none | claimed | formula | none | none |
| 5 | intrysys.com | check + suggest next | count+AWG | per yoke | ≤4 pooled + ¼ | clamp; fittings documented | pigtail excluded | ~30 + custom | when over | "source receipt" | fill % bar | 2023 |
| 6 | calcexp.com | check | 18–6 | multi-gang | ¼ rule | clamp + stud | pass-through once | table | implicit | proportional | n/a | 2023 |
| 7 | electricalsuite.com | check | 18–6 | 2× | pooled | clamp only | "pigtails under 4 in" (myth) | 19+ | no | itemised | none | "2026" |
| 8 | electricianprep.co | check | #14–#6 | 2× | 0.25 for isolated | clamp; fitting unexplained | excluded | presets | no | simple | none | none |
| 9 | turn2engineering.com | check | mixed AWG | multi-yoke | edition ¼ rule | clamp; fittings by type | internal pigtails excluded; loops | check | no | chart | none | 2020/23/26 |

### 3.3 Strengths to match
Per-AWG mixed sizes; edition awareness; rule-cited receipt (intry); smallest-box suggestion (calcshed, intry); wide-device handling; substantial FAQ/glossary/limitations (turn2engineering).

### 3.4 Gaps GaugeCalc can exploit
1. **Manual conductor counting is the main error source.** No tool reads cables (14/2, 12/3 …) and derives conductors and grounds.
2. **No "why smaller boxes fail".** Auto modes return one answer.
3. **No input-driven diagram.** At most a static map or fill bar.
4. **Myths in the wild**, e.g. "pigtails under 4 inches are not counted" (appears on at least one tool). Verified wording (section 7, G-3) has no length rule: a conductor "no part of which leaves the box" is not counted, whatever its length.
5. **Edition ambiguity** (unpinned or stale).
6. **314.16 vs 314.28 confusion** in "junction box size" results.
7. **Thin explanation**; few replayable worked examples.
8. **No "fix it" guidance** when over capacity.

---

## 3A. NFPA primary-source findings (new in revision 2)

Official documents read (downloaded from `docinfofiles.nfpa.org`, converted to text): NEC Code-Making Panel 8 (**CMP-8 handles Article 314 in the 2026 cycle; it is not CMP-9**), cycle designation "A2025":
- `70_A2025_NEC_P08_FD_PIResponses.pdf` — First Draft public inputs and panel resolutions.
- `70_A2025_NEC_P08_FD_PrelimFR.pdf` — First Revisions (working draft).
- `70_A2025_NEC_P08_SD_PrelimSR.pdf` — Second Draft Second Revisions.
- `TIA_70_26_1 … 10` — 2026-edition Tentative Interim Amendments (none touch Article 314).

### 3A.1 Current edition — CONFIRMED
- NFPA's product page lists "NFPA 70, 2026 edition", and NFPA's "Understanding NFPA 70" page refers to the 2026 edition as the edition to use ("most current edition"). NFPA's 2026-edition TIAs state they were issued by the Standards Council in April 2026 (for example TIA 26-8: issued April 15, 2026, effective May 5, 2026).
- Adoption by a jurisdiction lags; the UI must say so.

### 3A.2 What the panel did to 314.16 in the 2026 cycle
| Item | NFPA record | Outcome |
|---|---|---|
| 314.16(B) general clause | First Revision 7529 | Text: "The volumes in 314.16(B)(1) through (B)(6), as applicable, shall be added together. No allowance shall be required for small fittings such as locknuts, **splicing connectors**, and bushings. Each space within a box installed with a barrier shall be calculated separately." Committee statement: "splicing connectors" added to clarify they are not counted; the term is used in 110.14. |
| 314.16(B)(4) Device or Equipment Fill | First Revision 7525 | Text unchanged in substance; **adds an informational note** pointing to 314.24(B) for minimum box depth. Public inputs to raise the allowance for GFCI/"smart" devices (to triple, to ×4) were **rejected**; panel kept the double allowance and explained the history. |
| 314.16(B)(5) EGC fill | Public Inputs 1466 and 1580 | Both **rejected**: "insufficient technical substantiation to increase the volume allowance." |
| 314.16(B)(6) Terminal Block Fill | First Revision 7527 | Editorial cleanup only; rule retained. Inputs seeking a separate grounding-terminal-block rule were resolved because the allowance applies to **all** terminal blocks. |
| 314.16(A), Table 314.16(A) | Public Input 3972 (restructuring, rejected) | The PI reproduces the full current table; no revision to its values. |
| Second Draft | Second Revisions list | The only 314.16 item is conduit bodies, 314.16(C)(2)/(C)(3) (adds "wiring" before "devices"). **No second revision to 314.16(A) or 314.16(B).** |

### 3A.3 Numbering — CORROBORATED
- The sub-paragraphs are **(B)(1) Conductor Fill, (B)(2) Clamp Fill, (B)(3) Support Fittings Fill, (B)(4) Device or Equipment Fill, (B)(5) Equipment Grounding Conductor Fill, (B)(6) Terminal Block Fill**. The Second Draft cross-reference in 314.27(E) cites "314.16(B)(4)" for device fill.
- The allowance table is captioned **"Table 314.16(B)(1) Volume Allowance Required per Conductor"** in the NFPA record, and (B)(4), (B)(5), (B)(6) each say "in accordance with Table 314.16(B)(1)". The assertion that 2026 sources call it "Table 314.16(B)(4)" found **no support** in any NFPA record. **UNVERIFIED — DO NOT USE "Table 314.16(B)(4)".**
- Older editions captioned the table "Table 314.16(B)". The implementation must keep the table name and sub-paragraph numbers in **one constant block** so a printed-book spot check can change them in one place.

### 3A.4 The grounding proposal — resolved
The proposal to replace "first four = one allowance, each additional = ¼" with "first four = one allowance, each additional four or fraction = a full allowance" was submitted and **rejected** (above). **It must not be implemented.** The ¼ rule is the baseline text shown verbatim in the NFPA record:

> "Where up to four equipment grounding conductors enter a box, a single volume allowance in accordance with Table 314.16(B)(1) shall be made based on the largest equipment grounding conductor entering the box. A 1/4 volume allowance shall be made for each additional equipment grounding conductor that enters the box, based on the largest equipment grounding conductor entering the box."

(The 2020-edition NEC text, seen verbatim in a training source, adds "or equipment bonding jumper" to each phrase.)

---

## 4. SERP / search-intent analysis

### 4.1 What was actually checked
Searches run: "electrical box fill calculator NEC 314.16", "junction box fill calculator", "electrical box sizing calculator what size electrical box do I need", "how many 12 gauge wires in a 4x4 box 30.3 cubic inches single gang 18 cubic inches how many wires can fit", "box fill calculator NEC what is box fill how many wires in electrical box". **No ranking, People-Also-Ask, volume or difficulty data were available. None is stated.**

### 4.2 Landscape
- Single-purpose calculator pages dominate, many small template-like sites, plus an app listing and a few explainers (trade magazines, a home-improvement publisher, a municipal inspection handout, training sites).
- "Junction box" and "box size" phrasing mixes **314.16 volume** tools with **314.28 pull-box** tools.
- Many titles state "NEC 2026" or "2023": edition currency is a visible signal.
- Judgment: **crowded but beatable on quality**; no difficulty score is claimed.

### 4.3 Intent groups
| Group | Query forms observed in result titles/snippets | Page job |
|---|---|---|
| A. Primary calculator | electrical box fill calculator; box fill calculator; NEC box fill calculator; NEC 314.16 calculator | Calculator first |
| B. Box sizing | electrical box sizing calculator; electrical box size calculator; junction box fill calculator; junction box size calculator | Mode B + scope notice for 314.28 |
| C. NEC technical | NEC 314.16; NEC box fill calculation; Table 314.16(A)/(B) | Methodology, receipt, edition section |
| D. Problem/question | how many wires fit in an electrical box; how many 12 gauge wires in a 4x4 box; do ground wires count; do wire nuts count | FAQ + derived capacity table |
| E. Educational | how to calculate electrical box fill; what is box fill | Short explainer + worked examples |

### 4.4 Cannibalization
None in the repo. A future 314.28 pull-box calculator or conduit-fill calculator must be separate URLs.

---

## 5. Keyword map (no volume or difficulty claimed)

| Role | Term | Basis |
|---|---|---|
| Primary | **Electrical Box Fill Calculator** | Matches observed result titles and the project's request. |
| Related (use naturally) | box fill calculator; NEC box fill calculator; NEC 314.16 calculator; electrical box sizing calculator; electrical box size calculator; junction box fill calculator | Each appeared as a tool name or result title in the searches above. |
| Question forms | how to calculate electrical box fill; how many wires fit in an electrical box; NEC box fill calculation | Observed in editorial result titles (Angi, ECMAG, Allied Moulded) and tool pages. |
| Supporting questions | Do ground wires count? Do wire nuts count? Does a device count as two wires? Does a pigtail count? What box do I need? What about 4 AWG and larger? | One FAQ item each. |
| Not targeted | conduit fill; pull box sizing (314.28); cubic-inch conversions | Different intents. |

Rule: each term appears where natural (title, H1, first paragraph, one H2, FAQ). No repetition for density.

---

## 6. NEC technical methodology (revision 2)

### 6.1 Scope split
- 314.16 sizes boxes and conduit bodies containing **18 AWG through 6 AWG** conductors using the allowance table. Older NEC text (verbatim, CORROBORATED): "Boxes and conduit bodies enclosing conductors 4 AWG or larger shall **also** comply with the provisions of 314.28."
- Consequence: a box containing any 4 AWG or larger conductor needs 314.28 **in addition**; Table 314.16(B)(1) has no row for those sizes, so the required volume **cannot be computed**. v1 does not accept #4 or larger and shows a notice. (OUT OF SCOPE — separate tool.)

### 6.2 Box volume — 314.16(A) (CONFIRMED text, NFPA PI record; unchanged by any revision)
- Volume of a box = total volume of the assembled sections plus the space provided by plaster rings, domed covers, extension rings, etc., that are **marked with their volume** or are made from boxes listed in Table 314.16(A).
- Barriers: where a box has one or more securely installed barriers, the volume is **apportioned** to each resulting space; a barrier **not marked with its volume** is considered to take up **8.2 cm³ (½ in³) if metal and 16.4 cm³ (1.0 in³) if nonmetallic**.
- Standard boxes not marked with a volume use Table 314.16(A). **Other boxes** of 1650 cm³ (100 in³) or less (not in the table) and **nonmetallic boxes** must be durably and legibly marked with their volume. Table boxes that have a larger volume than the table may be marked with that volume.
- Marked volume therefore overrides the table, and rings/covers add their marked volume — the reason for the custom-volume and add-on fields.

### 6.3 Table 314.16(A) — all 24 standard metal box rows (CORROBORATED)
Source: the full table reproduced in NFPA's public-input record (identical, unchanged lineage), cross-checked against two independent lists and against the printed maximum-conductor columns: **every printed count in all 24 rows equals `floor(box volume ÷ allowance)`** (verified by script).

| Box (mm / in) | in³ | cm³ | | Box | in³ | cm³ |
|---|---|---|---|---|---|---|
| 75×50×38 (3×2×1½) device | 7.5 | 123 | | 100×32 (4×1¼) round/octagonal | 12.5 | 205 |
| 75×50×50 (3×2×2) device | 10.0 | 164 | | 100×38 (4×1½) round/octagonal | 15.5 | 254 |
| 75×50×57 (3×2×2¼) device | 10.5 | 172 | | 100×54 (4×2⅛) round/octagonal | 21.5 | 353 |
| 75×50×65 (3×2×2½) device | 12.5 | 205 | | 100×32 (4×1¼) square | 18.0 | 295 |
| 75×50×70 (3×2×2¾) device | 14.0 | 230 | | 100×38 (4×1½) square | 21.0 | 344 |
| 75×50×90 (3×2×3½) device | 18.0 | 295 | | 100×54 (4×2⅛) square | 30.3 | 497 |
| 100×54×38 (4×2⅛×1½) device | 10.3 | 169 | | 120×32 (4-11/16×1¼) square | 25.5 | 418 |
| 100×54×48 (4×2⅛×1⅞) device | 13.0 | 213 | | 120×38 (4-11/16×1½) square | 29.5 | 484 |
| 100×54×54 (4×2⅛×2⅛) device | 14.5 | 238 | | 120×54 (4-11/16×2⅛) square | 42.0 | 689 |
| 95×50×65 (3¾×2×2½) masonry box/gang | 14.0 | 230 | | FS single cover/gang (min depth 1¾) | 13.5 | 221 |
| 95×50×90 (3¾×2×3½) masonry box/gang | 21.0 | 344 | | FD single cover/gang (min depth 2⅜) | 18.0 | 295 |
| FS multiple cover/gang (min depth 1¾) | 18.0 | 295 | | FD multiple cover/gang (min depth 2⅜) | 24.0 | 395 |

Footnote in the table (CORROBORATED): the "maximum number of conductors" columns apply "where no volume allowances are required by 314.16(B)(2) through (B)(6)" — i.e. conductors only.

An unverified web claim that the 2026 edition "strengthened marking requirements for non-standard boxes" was found and is **UNVERIFIED — DO NOT IMPLEMENT**; no NFPA record shows a revision to 314.16(A)(2).

### 6.4 Allowance table (CONFIRMED values; CORROBORATED numbering)
Source: the table reproduced in the NFPA record (identical in First Draft public inputs and the First Revision) and in an older NEC reproduction.

| AWG | in³ | cm³ as printed by NFPA |
|---|---|---|
| 18 | 1.50 | 24.6 |
| 16 | 1.75 | 28.7 |
| 14 | 2.00 | 32.8 |
| 12 | 2.25 | 36.9 |
| 10 | 2.50 | 41.0 |
| 8 | 3.00 | 49.2 |
| 6 | 5.00 | **81.9** |

Table name in the UI: "Table 314.16(B)(1)" (section 3A.3). Metric values are display-only; computation is in in³.

### 6.5 Counting rules, 314.16(B)

| Item | Rule | Evidence | Status |
|---|---|---|---|
| General clause | Add (B)(1)–(B)(6) as applicable. **No allowance** for small fittings such as locknuts, **splicing connectors** and bushings. **Each space within a barriered box is calculated separately.** | NFPA First Revision 7529 verbatim | **CONFIRMED** |
| (B)(1) Conductors | Each conductor that originates outside the box and terminates or is spliced inside counts **once**; each conductor that passes through without splice or termination counts **once**. | Older-edition verbatim + 2023-labelled training quote; no 2026 revision | CORROBORATED |
| (B)(1) Loops | A looped, unbroken conductor not less than twice the minimum length required for free conductors in 300.14 counts **twice**. 300.14 requires 150 mm (6 in) of free conductor, so a loop threshold of **300 mm (12 in)**; a trade source phrases it "300 mm (12 in.) or longer". | Verbatim older edition + secondary | CORROBORATED |
| (B)(1) Not counted | "A conductor, no part of which leaves the box, shall not be counted." **No length limit.** | Verbatim older edition + 2023 secondary quotes | CORROBORATED |
| (B)(1) Exception | An EGC(s) or not more than four fixture wires smaller than 14 AWG, or both, may be omitted where they enter from a domed luminaire or similar canopy and terminate in the box. | Verbatim older edition only; 2026 wording not read | **V1.1; UNVERIFIED — DO NOT IMPLEMENT until the 2026 wording is read** |
| (B)(2) Clamps | Where one or more internal cable clamps, whether factory or field supplied, are present, a **single** allowance based on the **largest conductor present in the box**. No allowance for a cable connector whose clamping mechanism is outside the box. | Verbatim older edition + 2023 quote | CORROBORATED |
| (B)(3) Support fittings | Where one or more luminaire studs or hickeys are present, a single allowance **for each type of fitting** based on the largest conductor present in the box (stud and hickey together = two allowances). | Verbatim older edition + secondary | CORROBORATED |
| (B)(4) Devices/equipment | For each yoke or strap containing one or more devices or equipment, a **double** allowance per yoke or strap based on the **largest conductor connected to a device(s) or equipment supported by that yoke or strap**. A device or utilization equipment wider than a single 50 mm (2 in) device box as described in Table 314.16(A) has **double allowances for each gang required for mounting**. Informational note: see 314.24(B) for minimum box depth. | NFPA First Revision 7525 verbatim; triple-allowance proposals rejected | **CONFIRMED** |
| (B)(5) EGC | Up to four EGCs (or equipment bonding jumpers) entering the box: **one** allowance on the largest EGC. **Each additional** EGC/bonding jumper: **¼ allowance** on the largest EGC. Proposed "full allowance per additional four" change **rejected**. | NFPA PI record verbatim (baseline); PIs 1466/1580 resolutions | **CONFIRMED** (baseline and rejection); final-book match CORROBORATED |
| (B)(6) Terminal blocks | Where a terminal block is present, a single allowance for **each terminal block assembly**, based on the largest conductor(s) terminated to the assembly. Applies to all terminal blocks (including grounding terminal blocks). | NFPA First Revision 7527 verbatim; PI resolutions | **CONFIRMED** |
| Marked volume / rings / covers | Box volume includes marked volume of rings, covers and extensions. | 314.16(A) verbatim in NFPA PI record | **CONFIRMED** |
| Barrier volume | 8.2 cm³ (½ in³) metal / 16.4 cm³ (1.0 in³) nonmetallic if unmarked. | 314.16(A) verbatim in NFPA PI record | **CONFIRMED** |

### 6.6 Myths — explicitly NOT rules
| Myth | Status |
|---|---|
| "Pigtails under 4 inches do not count" | **Not a rule.** The text has no length test; the rule is "no part of which leaves the box". UNVERIFIED — DO NOT IMPLEMENT the 4-inch claim. |
| "All grounds always count as one regardless of quantity" | **Wrong since the 2020 NEC.** One allowance for up to four, ¼ each beyond. (The older all-grounds-as-one rule is pre-2020.) |
| "Each support fitting counts separately" | **Wrong.** One allowance **per type** (stud, hickey), not per piece. |
| "All devices simply count twice" | **Incomplete.** Two allowances **per yoke/strap** (not per device on the yoke), sized on the largest conductor connected to that yoke, and **per gang** for devices wider than 2 in. |
| "2026 changed grounding to one full allowance per four additional grounds" | **Proposed and rejected.** |

### 6.7 Implementation interpretations (disclose in the UI)
1. "Largest conductor present in the box" = the lowest AWG number among **all** conductors counted, including EGCs, terminal-block conductors and yoke-connected conductors.
2. A cable that **passes through** unspliced contributes each insulated conductor once, and its EGC as **one** entering EGC (matters only for the four-ground threshold).
3. The yoke allowance uses the size the user selects as the largest conductor connected to that yoke; a warning appears if that size is not among the conductors entered.
4. Quarter allowances are exact (0.25 × 1.75 = 0.4375); no rounding before summing.
5. Loops apply to insulated conductors only. EGC loops: **UNVERIFIED — DO NOT IMPLEMENT**.
6. "Terminal block assembly" is counted as the user states it; the UI explains the term but does not infer assemblies.
7. Internal clamps are a single yes/no (one allowance regardless of number), as the rule says.

### 6.8 Relationships
- 314.28 (4 AWG and larger): out of scope, see 6.1.
- 314.24 (box depth): out of scope; the informational note in (B)(4) points to it. The result is a **volume** result only.
- 314.16(C) conduit bodies: **OUT OF SCOPE** (separate minimum-volume/marked-volume rules; Second Draft touches (C)(2)/(C)(3) wording).
- 300.14: referenced for the loop threshold.

### 6.9 Scope classification of every relevant case
| Case | Class | Reason |
|---|---|---|
| Conductors #18–#6, mixed | **V1** | Core. |
| Cables with ground, pass-through runs | **V1** | Reduces the #1 user error. |
| Loops/coils ≥ 12 in | **V1** | Rule text corroborated; uncommon but checkbox-simple. |
| EGC with ¼ rule | **V1** | Confirmed. |
| Internal clamps | **V1** | Corroborated. |
| Support fittings by type | **V1** | Corroborated. |
| Yokes, wide devices, multi-gang | **V1** | Confirmed. |
| Terminal blocks | **V1** | Confirmed verbatim. |
| All 24 standard boxes, marked and add-on volume | **V1** | Confirmed/corroborated. |
| Barriered boxes (separate spaces) | **V1.1** | Rule confirmed; needs a "spaces" model (section 8.9). v1 shows a notice: calculate each space separately; unmarked barrier 0.5/1.0 in³. |
| Domed-luminaire exception | **V1.1 / UNVERIFIED** | Read 2026 wording first. |
| EGC loops | **UNVERIFIED — DO NOT IMPLEMENT** | Not in any source. |
| Conduit bodies (314.16(C)) | **OUT OF SCOPE** | Separate rule set. |
| 4 AWG and larger / 314.28 | **OUT OF SCOPE** | Separate calculation. |
| Pre-2020 grounding rules / edition selector | **V1.1 (optional)** | Not needed for 2026; may add as an "older edition" notice only. |

---

## 7. 2026 NEC Verification Gate

Legend: C = CONFIRMED, CO = CORROBORATED, I = INTERPRETATION, U = UNVERIFIED.

| Gate | Rule | Evidence | Status | Implementation decision |
|---|---|---|---|---|
| **G-0** | Current edition is NFPA 70-2026 | NFPA product page ("NFPA 70, 2026 edition"); NFPA "Understanding NFPA 70" page; NFPA 2026-edition TIAs issued April 2026 | **C** | Target 2026. State that adoption varies by jurisdiction. |
| **G-1** | Table 314.16(A) standard box volumes (24 rows) | Full table in NFPA PI record (PI 3972); no revision to 314.16(A); all printed max-conductor columns equal `floor(V÷allowance)` (24/24); two independent lists match | **CO** | Implement all 24 rows (section 6.3). Printed-book spot check recommended (non-blocking). |
| **G-2a** | Allowance values 18–6 AWG | NFPA PI record and First Revision tables (1.50/1.75/2.00/2.25/2.50/3.00/5.00 in³; 24.6/28.7/32.8/36.9/41.0/49.2/81.9 cm³); older NEC reproduction | **C** | Implement. Use 81.9 cm³ for 6 AWG. |
| **G-2b** | Table caption and sub-paragraph numbers | NFPA record: "Table 314.16(B)(1)"; (B)(1)–(B)(6) headings; Second Draft cross-reference to (B)(4). "Table 314.16(B)(4)" claim: no support | **CO** (numbering); "(B)(4) table" = **U — DO NOT USE** | Cite "314.16(B)(n)" and "Table 314.16(B)(1)" from one constants block. |
| **G-3a** | Entering/terminating/spliced conductors count once | Verbatim older edition; 2023 secondary quote; not in any 2026 revision | **CO** | Implement. |
| **G-3b** | Pass-through conductors count once | Same | **CO** | Implement. |
| **G-3c** | Conductor wholly inside the box (pigtail/jumper) is not counted, any length | Verbatim older edition ("no part of which leaves the box"); "under 4 in" claim has no support | **CO** (rule); **U — DO NOT IMPLEMENT** (4-inch claim) | Implement "adds 0". Add a pigtail help note without the 4-inch myth. |
| **G-3d** | Looped unbroken conductor ≥ 2 × 300.14 length counts twice (12 in) | Verbatim older edition; trade source "300 mm (12 in.) or longer" | **CO** | Implement as a "Loop/coil" handling. |
| **G-3e** | Domed-luminaire exception; EGC loops | Older-edition verbatim only for the exception; none for EGC loops | **U** | Not in v1. |
| **G-4** | Internal clamps: single allowance, largest conductor in box; none for clamp outside box | Verbatim older edition; 2023 training quote | **CO** | Implement as a single checkbox. |
| **G-5** | Support fittings: one allowance per type, largest conductor in box | Verbatim older edition; secondary | **CO** | Implement as stud / hickey checkboxes. |
| **G-6** | Yoke/strap: double allowance per yoke on largest connected conductor; wide devices: double per gang | NFPA First Revision 7525 verbatim; PI 1452/1485/3374 proposals to triple/×4 rejected with the panel's history statement | **C** | Implement per yoke with a gang count; GFCI/smart devices are not special. |
| **G-7** | EGC: ≤ 4 one allowance; each additional ¼, largest EGC | NFPA PI record baseline text verbatim; PI 1466/1580 rejected; Second Draft has no revision | **C** (text and rejection); final-book match **CO** | Implement ¼ rule. Regression-test against the rejected variant. |
| **G-8a** | Terminal blocks: one allowance per assembly, largest conductor terminated | NFPA First Revision 7527 verbatim | **C** | Implement (V1). |
| **G-8b** | Small fittings (locknuts, splicing connectors, bushings) need no allowance | NFPA First Revision 7529 verbatim; committee statement; a 2023-vs-2026 comparison from a training provider | **C** | Implement as "adds 0"; list in receipt footnote. |
| **G-8c** | Barriered boxes: each space calculated separately; unmarked barrier 0.5 / 1.0 in³ | First Revision 7529 verbatim; 314.16(A) verbatim | **C** | v1 notice; V1.1 spaces model (section 8.9). |
| **G-8d** | Marked box volume; plaster/extension rings, domed covers add marked volume; marked volume permitted for larger-than-table boxes | 314.16(A) verbatim in NFPA PI record | **C** | Implement custom marked volume and add-on volume. |
| **G-8e** | 4 AWG and larger: also comply with 314.28 | Verbatim older edition | **CO** | Block ≥ 4 AWG with a notice. |

Remaining non-blocking item: spot-check the printed NFPA 70-2026 for the table caption/numbering and for (B)(1)–(B)(3) unchanged wording (section 21).

---

## 8. Calculation model

All arithmetic is exact. Store values as integers in units of **1/10 000 in³** (2.25 in³ = 22 500; 0.25 × 1.75 = 4 375). Display with trailing zeros trimmed to at most 4 decimals; never show a verdict that contradicts the exact comparison.

### 8.1 Definitions
- `A(s)` = allowance for AWG `s` ∈ {18,16,14,12,10,8,6} (section 6.4).
- `largest` = lowest AWG number among all counted insulated conductors, EGCs, terminal-block conductors and yoke-connected conductors (interpretation 6.7-1).
- `V_box` = box volume (table or marked) **+** marked add-on volume.

### 8.2 Required volume
```
R = Σ_s n_s × A(s)                                   (B)(1), n_s includes loop doubling
  + [n_egc ≥ 1] × ( A(e) + max(0, n_egc − 4) × ¼ × A(e) )         (B)(5), e = largest EGC
  + [clamp]     × A(largest)                         (B)(2)
  + Σ_types [present] × A(largest)                   (B)(3), types ∈ {luminaire stud, hickey}
  + Σ_yokes 2 × A(y_k) × gangs_k                     (B)(4)
  + Σ_terminal blocks A(t_k)                         (B)(6), t_k = largest conductor terminated
```
Locknuts, bushings, splicing connectors, and conductors that never leave the box add 0.

### 8.3 Counting cables → conductors
For a cable row with `q` runs, `k` insulated conductors, and an EGC flag:
- **Terminates/spliced in box:** `q × k` conductors at the cable's size; `q` EGCs (if flagged).
- **Passes through unspliced (one run enters twice):** `q × k` conductors once; `q` EGCs.
- **Unbroken loop ≥ 12 in:** `2 × q × k` conductors; EGCs counted `q` (EGC loop doubling is UNVERIFIED).
Loose conductors add `n_s` directly. A pigtail with both ends inside the box adds 0.

### 8.4 Check (Mode A)
```
fill % = R ÷ V_box × 100,   remaining = V_box − R
PASS if R ≤ V_box (an exact fit passes);  TOO SMALL otherwise, shortfall = R − V_box
```
If R = 0: no verdict ("Add at least one conductor or device").

### 8.5 Minimum box (Mode B)
Sort the 24 standard boxes by volume. Return (a) the smallest box with V ≥ R; (b) the smallest passing box **per family** (device 3×2, handy 4×2⅛, round/octagonal, square 4", square 4-11/16", masonry, FS/FD); (c) the **ladder** of every smaller box with its shortfall. The largest standard row is 42.0 in³ (4-11/16 × 2⅛ square); if R exceeds it, say "exceeds the largest standard box; choose a box or ring with marked volume ≥ R". Always label **calculated requirement** versus **box capacity selected**.

### 8.6 Capacity helper
`floor(V ÷ A(s))` equals the table's printed conductors-only counts (verified 24/24); shown in the FAQ table, labelled "conductors only".

### 8.7 Receipt model (breakdown — Input → Rule → Quantity → Allowance → Volume → Subtotal → Total → Capacity → Result)
Each receipt row carries: **Input** (what the user entered, in plain words) · **Rule** (NEC 314.16(B)(n) badge) · **Quantity** · **Basis** (size used, e.g. "#12 largest in box") · **Allowance each** (in³) · **Multiplier** (×1, ×2 yoke, ×2 loop, ×¼ extra EGC) · **Volume** · **Running subtotal**. Footer rows: **Total required**, **Box capacity** (`box + add-on`, with formula), **Margin** (remaining or shortfall), **Result** (PASS / TOO SMALL). A "Why" sentence under the table names the largest contributor and the margin. Rows with 0 appear in a collapsed "Not counted" list (wire connectors, pigtails, locknuts, bushings) so users see why those add nothing.

### 8.8 Input flow summary
Cables → loose conductors (advanced) → fittings (clamp, stud, hickey) → yokes (size, gangs) → terminal blocks (count, largest conductor) → box (standard or marked + add-on) → mode.

### 8.9 V1.1 barriered-box model (defined now, built later)
A box with N barriers has N+1 spaces. Each space has its own contents and its own volume (marked, or the user-apportioned volume of the whole box minus unmarked barriers at 0.5 in³ metal / 1.0 in³ nonmetallic). The calculator runs the same model per space and reports each space PASS/TOO SMALL independently (rule: "each space … calculated separately", First Revision 7529).

---

## 9. Calculator modes

### Mode A — Check my box
Contents + box → required, available, fill %, remaining, PASS/TOO SMALL, shortfall, receipt, and "how to fix" suggestions (next larger standard box; remove N conductors of the largest contributor; add an extension ring with marked volume ≥ shortfall).

### Mode B — Find minimum box
Same contents → required, smallest passing box, per-family minimum, **ladder with shortfalls**, caution that marked volumes can exceed table values and that depth (314.24) is separate.

### Mode C — Calculation breakdown
Always visible in both modes: the receipt (8.7) and the live diagram share one calculation object. It is not a separate screen.

UI: one input panel; a two-option segmented control (Check my box / Find minimum box).

---

## 10. Input specification

| Section | Field | Type / range | Default | Notes |
|---|---|---|---|---|
| Box | Box type | select of the 24 rows (grouped by family) or "Marked / custom volume" | 3 × 2 × 3½ device | Mode A only. |
| Box | Marked volume | number > 0 and ≤ 5000 in³ (step 0.1) | empty | Required when custom selected; label "Volume stamped on the box (in³)". |
| Box | Add-on marked volume | number ≥ 0 and ≤ 1000 | 0 | Plaster ring, extension ring, domed cover. |
| Cables | Rows (max 20) | cable type, size, quantity, handling | one row 14/2 ×2 terminates | Presets: 14/2, 14/3, 12/2, 12/3, 10/2, 10/3, 8/3, 6/3 with ground; "Custom cable" (1–12 insulated, size, EGC yes/no, EGC size). |
| Cables | Handling | terminates/spliced in box · passes through unspliced (runs) · unbroken loop ≥ 12 in | terminates | Pass-through is entered as **runs**, not entries. |
| Loose conductors (advanced) | Rows by AWG | size #18–#6, count 0–200 | none | Individual wires leaving the box. |
| Fittings | Internal cable clamps | checkbox | off | Single allowance regardless of number. |
| Fittings | Luminaire stud | checkbox | off | One allowance per type. |
| Fittings | Hickey | checkbox | off | One allowance per type. |
| Devices | Yoke rows (max 10) | largest connected conductor (size), gangs 1–6 | none | Gangs > 1 for a device wider than a single 2 in device box. |
| Terminal blocks | Rows (max 10) | assemblies 1–20, largest conductor terminated (size) | none | Terminated conductors are also entered in cables/loose conductors. |

Validation: counts are whole numbers; empty = 0; negative, fractional, NaN or over-limit values show an inline error (`role="alert"`, `aria-describedby`, `aria-invalid`) and suppress the verdict. Sizes outside #18–#6 are not selectable; a visible notice covers 4 AWG and larger (6.1). Fittings, yokes or terminal blocks with no conductors produce a warning, not a verdict.

---

## 11. Output / result specification

1. **Headline status** (PASS / TOO SMALL / needs input) with fill % — icon plus text, never colour alone.
2. **Key numbers:** Required · Available · Remaining or Shortfall · Fill %.
3. **Receipt table** (8.7) with running subtotal, rule badges, "Not counted" list.
4. **Mode B ladder** and per-family minimums.
5. **Fix suggestions** when TOO SMALL.
6. **Why** sentence.
7. **Copy summary** (plain text receipt).
8. Result container `role="status" aria-live="polite"`; Calculate/jump behavior from `calc-ux.js`.

---

## 12. Premium visual specification (not implemented)

### 12.1 Concept — "Fill cutaway"
A lightweight inline SVG built with `createElementNS`, driven by the same calculation object as the receipt.
- **Cutaway box** representing available volume (box + add-on). Stacked **volume bands** fill from the bottom in receipt order: conductors by size, EGC, clamp, luminaire stud/hickey, yokes (with a ×2 hatch), terminal blocks. Band height = subtotal ÷ available volume.
- **Capacity line** at 100 %; remaining space hatched and labelled "Remaining 2.25 in³".
- **Overfilled state:** bands continue above the rim as a hatched overflow stack labelled "+1.20 in³ over", rim in the warning colour, text "TOO SMALL". Overflow never clips.
- **Allowance strip** below with the same colours and amounts; icons identify each item (wire, ground, clamp, stud, device, terminal).
- **Mode B:** a small ladder chart of standard box volumes with the requirement as a vertical line; passing boxes highlighted.

### 12.2 Explains, not decorates
Every band maps to a receipt row (shared `data-key`); hover/focus/tap on a band highlights the row and vice versa. The diagram answers "where did my volume go?" and "how far over am I?". No decorative-only elements.

### 12.3 Mobile and motion
`viewBox`-based, `width:100%; max-width:460px; height:auto`; source text sized so rendered text is ≥ 11 px at 320 px; no horizontal overflow at 320 px. Transitions ≤ 200 ms and disabled under `prefers-reduced-motion`.

### 12.4 Accessibility
`role="img"` with `<title>`; `<desc>` rewritten on each calculation via `textContent` (e.g. "Box 18 in³. Required 15.75 in³ (87.5 %): conductors 9, grounds 2.25, device 4.5. Remaining 2.25 in³."). Keyboard access is through the receipt rows (`tabindex="0"`), not the SVG. Patterns plus labels so colour is never the only code. Light and dark use CSS variables from `style.css`.

### 12.5 State mapping and empty state
One result object feeds receipt, summary text and SVG. Empty state: dashed empty box with "Add cables to see how they fill the box."

### 12.6 Supporting static illustrations (article)
1. "What counts and what doesn't" (cable ends ×1, loop ×2, pigtail 0, wire connector 0, clamp, yoke ×2, terminal block ×1).
2. "Counting a cable" (terminate vs pass-through vs loop).
3. "Wide device = one double allowance per gang".
4. "314.16 vs 314.28" decision graphic.
Hand-written SVG, same accessibility treatment, no stock imagery.

---

## 13. Content / page structure

1. **H1** Electrical Box Fill Calculator (NEC 314.16) · lead · byline (existing pattern).
2. **Quick answer** (answer-first, 40–60 words).
3. **Calculator** (modes) + result + receipt + fill cutaway.
4. **How to read your result.**
5. **What electrical box fill means.**
6. **How NEC 314.16 works** ((A) volume, (B) allowances).
7. **Conductor volume allowances** (Table 314.16(B)(1), in³ and cm³).
8. **How to count a cable** (terminate, pass-through, loop; pigtails; connectors).
9. **Equipment grounding conductors** (four, then ¼; why 2026 did not change it).
10. **Clamps and support fittings.**
11. **Devices, yokes and wide devices.**
12. **Terminal blocks.**
13. **Standard box volumes** and **how many wires fit** (derived, conductors only).
14. **Worked examples** (three, from section 19).
15. **Minimum box sizing** (ladder; required vs selected).
16. **Common mistakes.**
17. **Assumptions and limitations.**
18. **NEC edition and scope** (2026; where older editions differ; 4 AWG and larger; barriers; AHJ).
19. **References.**
20. **FAQ.**
21. **Related tools** + feedback link.

No filler: every section supports a decision the calculator makes.

---

## 14. SEO specification
| Item | Spec |
|---|---|
| URL / canonical | `https://gaugecalc.com/tools/electrical-box-fill-calculator` (extensionless, self-canonical) |
| Title | `Electrical Box Fill Calculator (NEC 314.16, Free) — GaugeCalc` (61 chars; fallback `Box Fill Calculator (NEC 314.16, Free) — GaugeCalc`) |
| H1 | `Electrical Box Fill Calculator (NEC 314.16)` |
| Meta description (~145) | `Free NEC 314.16 box fill calculator. Check if your electrical box is big enough or find the minimum box, with a line-by-line allowance breakdown.` |
| Robots | indexable |
| OG / Twitter | same pattern as other tools |
| Headings | one H1; H2 per section above; H3 for FAQ and examples |
| Internal links in | Homepage grid + ItemList position 10; `nav.js` `electrical-wiring`; one sentence in Voltage Drop "Related tools" |
| Internal links out | Voltage Drop Calculator (conductor sizing context) |
| SVG alt strategy | `<title>` + `<desc>` describe the mechanism; `figcaption` states the takeaway |
| Sitemap | Add the URL (21st) with real `lastmod`, monthly, priority 0.9 |

Structured data — **add:** `SoftwareApplication`, `BreadcrumbList`, `FAQPage` identical to the visible FAQ. **Do not add:** `AggregateRating`/`Review`, `HowTo`, `Product`, `Article`/dates unless a dated guide exists, any claim of certification or expertise the byline does not already support.

## 15. AEO / GEO specification
Answer-first blocks (each begins with the answer):
1. *How do you calculate box fill?* — Add one Table 314.16(B)(1) allowance per conductor, one for grounds (¼ each beyond four), one for clamps, one per support-fitting type, two per device yoke, and one per terminal block; the total must not exceed the box volume.
2. *How many 12 AWG wires fit in a 4-inch square box?* — A 4 × 2⅛ square box is 30.3 in³, so 13 conductors at 2.25 in³ each, **with no devices, clamps or grounds**; those reduce the number.
3. *Do ground wires count?* — Yes: one allowance for up to four, then ¼ allowance for each additional.
4. *Do wire nuts count?* — No: small fittings including splicing connectors need no allowance (2026 text names splicing connectors).
5. *Does a pigtail count?* — A conductor with no part leaving the box is not counted, regardless of length; the cable conductors entering the box still count.
6. *Does a receptacle count as two wires?* — Two allowances per yoke on the largest connected conductor; a device wider than 2 in counts two per gang.
7. *What about terminal blocks?* — One allowance per assembly on the largest conductor terminated.
8. *What about 4 AWG and larger?* — Box fill does not size them; they must also comply with 314.28.
GEO: state edition and the date the page was last checked; show formulas, units and the origin of every number; clear assumptions; FAQ identical to schema; no unverifiable authority claims.

## 16. Accessibility specification
Visible `<label>` on every control; `fieldset`/`legend` groups; fully keyboard-operable add/remove rows with named buttons ("Add cable", "Remove cable 2"); visible focus; segmented control as `radiogroup` with arrow keys; result `role="status"` `aria-live="polite"` announcing one short sentence, throttled; inline errors with `aria-invalid`/`aria-describedby` and focus to the first error; ≥ 44 px targets; contrast per tokens in light/dark; receipt as a real `<table>` with `<caption>` and `<th scope>`, scrolling inside its container; `prefers-reduced-motion` respected.

## 17. Performance specification
Single HTML file; reuse shared CSS/JS; no libraries or network calls; O(rows) synchronous calculation; node reuse in SVG updates; inline SVG ≤ 12 KB, static illustrations ≤ 6 KB each; reserve heights to avoid layout shift; no ad units or new analytics events.

## 18. Security specification
No `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval` or `new Function` with any input-derived value; build DOM with `createElement`/`createElementNS` and `textContent`; strict numeric parsing (`Number`, `Number.isFinite`, integer checks, clamps); select values validated against whitelists; no reflection into URLs, storage or markup (any future share-link must whitelist keys); clipboard text built from validated numbers only; no inline event-handler attributes; no new third-party scripts; AdSense loader and meta tag copied exactly from other tool pages.

---

## 19. Test matrix

Expected values were computed independently with a throwaway reference script (scratch file outside the repo) using section 8. "Req" = required volume (in³). Boxes are from section 6.3.

### 19.1 Core cases
| ID | Scenario | Contents | Req | Expected |
|---|---|---|---|---|
| T1 | Single size, device | 4 × #14, 2 EGC #14, 1 yoke #14 | 14.00 | 3×2×2¾ (14.0) PASS exact fit, remaining 0; 3×2×2½ (12.5) TOO SMALL, shortfall 1.50; smallest box 3×2×2¾ |
| T2 | Receptacle, two 12/2 | 4 × #12, 2 EGC #12, yoke #12 | 15.75 | 4×2⅛×2⅛ (14.5) TOO SMALL by 1.25; smallest box 3×2×3½ (18.0), remaining 2.25 |
| T3 | Exact fit | 7 × #14 | 14.00 | 3×2×2¾ PASS 100 % |
| T4 | Mixed AWG | 3 × #12, 2 × #14, 2 EGC #12, yoke #12 | 17.50 | 3×2×3½ PASS, remaining 0.50 |
| T5 | Clamp | T2 + clamps | 18.00 | clamp 2.25; 3×2×3½ PASS exact; two clamps still one allowance |
| T6 | Junction, three 12/3 | 9 × #12, 3 EGC #12 | 22.50 | smallest overall FD multiple-cover (24.0), smallest 4-11/16 square 4-11/16×1¼ (25.5); 4×2⅛ sq (30.3) PASS 74.3 % (revised after the 24-row table was adopted) |
| T7 | Five grounds | 2 × #12 + 5 EGC #12 | 7.3125 | 4.50 + 2.25 + 0.5625; 3×2×1½ (7.5) PASS |
| T8 | Eight grounds | 2 × #14 + 8 EGC #14 | 8.00 | 4.00 + 2.00 + 4 × 0.50 |
| T9 | Luminaire stud | 4 × #14, 2 EGC #14, stud | 12.00 | stud 2.00; 3×2×2½ (12.5) PASS |
| T10 | Stud + hickey | T9 + hickey | 14.00 | two types = two allowances |
| T11 | Wide device | 4 × #12, 2 EGC #12, yoke #12 × 2 gangs | 20.25 | yoke 9.00; smallest 4 sq 1½ (21.0) |
| T12 | Two yokes mixed | 3 × #12, 3 × #14, 3 EGC #12, yoke #12, yoke #14 | 23.50 | smallest volume 24.0 (FD multiple-cover) |
| T13 | Just over | 12 × #12, 3 EGC #12, clamps | 31.50 | 4×2⅛ sq (30.3) TOO SMALL by 1.20; smallest 4-11/16×2⅛ sq (42.0) |
| T14 | Exact-fit style boundary | 13 × #12 | 29.25 | 4×2⅛ sq (30.3) PASS remaining 1.05; smallest by volume 4-11/16×1½ sq (29.5) — shows the per-family list |
| T15 | Loop | one 14/2 looped (2 conductors ×2) + EGC | 10.00 | 8.00 + 2.00; smallest 3×2×2 |
| T16 | Extreme | 500 × #12 | 1125.00 | no standard box; message; no crash; fill % shown as capped text |
| T17 | 18 AWG | 3 × #18, 1 EGC #18 | 6.00 | smallest 3×2×1½ (7.5) |
| T18 | #6 and clamp | 2 × #6, 2 × #12, EGC #10, clamp | 22.00 | clamp uses #6 (5.00); smallest volume 24.0 |

### 19.2 New in revision 2 (gates G-6, G-7, G-8 and myths)
| ID | Scenario | Contents | Req | Expected |
|---|---|---|---|---|
| T19 | **Terminal block** | 2 × 12/2 terminating (4 × #12, 2 EGC #12) + 1 terminal block (#12) | 13.50 | 9.00 + 2.25 + 2.25; 3×2×3½ (18.0) PASS |
| T20 | Terminal block, larger terminated conductor | 3 × #10, 2 × #14, 1 terminal block (#10) | 14.00 | 7.50 + 4.00 + 2.50 |
| T21 | **EGC regression vs rejected rule** | 2 × #12 + 9 EGC #12 | 9.5625 | Conductors 4.50; EGC fill = 2.25 + 5 × 0.5625 = **5.0625**; total **9.5625**. The rejected "full allowance per additional four" would give an EGC term of 2.25 + 2 × 2.25 = 6.75 (total 11.25) → **the test must fail if an EGC term of 6.75 is produced** |
| T22 | Twelve grounds | 12 EGC #14 only | 6.00 | 2.00 + 8 × 0.50 = 6.00 |
| T23 | Four grounds boundary | 4 EGC #12 | 2.25 | one allowance; fifth EGC adds 0.5625 → 2.8125 |
| T24 | Two luminaire studs, one type | 2 studs + 4 × #14 | 10.00 | one stud allowance only (2.00) |
| T25 | GFCI is not special | 2 × 12/2 + GFCI yoke | 15.75 | yoke is 4.50 (×2), not 6.75 |
| T26 | Wire connectors | add 10 wire connectors to any case | unchanged | adds 0 |
| T27 | Long pigtail | pigtail 18 in both ends inside | unchanged | adds 0 (no length rule) |
| T28 | Pass-through 12/2 + terminating 12/2 | 4 insulated + 2 EGC | 11.25 | 9.00 + 2.25 |
| T29 | Add-on volume | 4 sq 1½ (21.0) + ring 3.6 | — | available 24.6 |
| T30 | Looped 12/2 | one 12/2 loop ≥ 12 in | 11.25 | 4 × 2.25 + 2.25 |
| T31 | 6 AWG cm³ display | 6 AWG allowance | — | shows 81.9 cm³ (not 82.0) |
| T32 | Derived capacity table | 24 rows × 7 sizes | — | equals NFPA printed max-conductor columns |

### 19.3 Behaviour and validation
| ID | Case | Expected |
|---|---|---|
| V1 | All zero/empty | No verdict; prompt to add items |
| V2 | Negative, 1.5, "abc", 1e3 | Inline error; verdict suppressed |
| V3 | Over limits (loose > 200, qty > 50) | Error with limit |
| V4 | Marked volume 0, negative, NaN, > 5000 | Error |
| V5 | Marked 22.0 vs T6 (22.5) | TOO SMALL, shortfall 0.50 |
| V6 | Yoke size not present among conductors | Warning, computes as selected |
| V7 | Stud/clamp/terminal block with no conductors | Message, no verdict |
| V8 | #4 or larger | Not selectable; 314.28 notice |
| V9 | Cable input equals loose-conductor input for the same conductors | Identical R |
| V10 | Check ↔ Minimum switching | Same R, no stale state |
| V11 | Reset | Defaults restored, errors and SVG cleared |
| V12 | Light/dark, 320–1440 px | No page overflow; diagram text ≥ 11 px; overflow stack visible |
| V13 | Screen reader | Announcement matches visible summary; table caption/headers present |
| V14 | No `NaN`/`Infinity`/`undefined` anywhere | Required |
| V15 | Barriered-box notice (v1) | Notice shown; no per-space calculation |

---

## 20. Differentiation summary
| Gap | GaugeCalc answer |
|---|---|
| Manual wire counting | Cable-based input with auto ground; pass-through and loop handling |
| One answer for "what box" | Ladder showing why smaller boxes fail + per-family minimum |
| Static/no diagram | Input-driven cutaway linked to the receipt; overflow state |
| Unclear edition | 2026 stated; record-based gates; differences listed; AHJ note |
| Opaque math | Input → rule → qty → allowance → multiplier → volume → subtotal → total → capacity → result |
| Myths | "How to count" section with verified wording; myths named and rejected |
| 314.16 vs 314.28 | Visible scope notice and decision graphic |
| Dead-end results | "How to fix" suggestions |
Future separate tools: 314.28 pull-box sizing; conduit fill.

---

## 21. Risks and unknowns / unresolved questions
| Item | Severity | Handling |
|---|---|---|
| Printed NFPA 70-2026 not read; evidence is NFPA development records plus corroboration | Medium → low | One non-blocking spot check before the page claims "reviewed against NFPA 70-2026": (a) table caption "Table 314.16(B)(1)" and (B)(1)–(B)(6) headings; (b) (B)(1)–(B)(3) wording unchanged; (c) Table 314.16(A) rows. Constants block makes any change trivial. |
| Public-comment stage for CMP-8 not read in full | Low | Second Draft working output shows no further revision to 314.16(A)/(B). |
| "Table 314.16(B)(4)" claim | Low | Unsupported; ignore. |
| Domed-luminaire exception wording (2026) | Low | Deferred (V1.1, UNVERIFIED). |
| EGC loops | Low | Not implemented (UNVERIFIED). |
| Interpretations (largest conductor, pass-through EGC) | Medium | Disclosed in Assumptions; tests T5, T18, T28. |
| Barriered boxes | Low | v1 notice; V1.1 model defined (8.9). |
| Crowded SERP; no volume/KD data | Medium | Compete on workflow and clarity. |
| Safety-adjacent liability | Medium | Disclaimer: planning aid; verify with NEC and AHJ. |
| Marked volumes may exceed table values | Low | Custom field and explanation. |
| Cable preset assumptions | Low | Presets labelled; custom cable available. |
| Jurisdiction adopts an older edition | Medium | Edition section lists differences; no older-edition math in v1. |

Unresolved questions (non-blocking): exact printed 2026 numbering; 2026 domed-luminaire exception wording; whether to ship an optional older-edition (≤ 2017) grounding mode later.

---

## 22. Final decision

### **BUILD**

Reasoning:
- Demand and intent are clear and recurring; competition is crowded but uneven with real, specific gaps (section 3.4). No volume/difficulty numbers are claimed.
- GaugeCalc fit: extends Electrical & Wiring, reuses site patterns, no dependencies, no overlap.
- Methodology: the device, grounding, terminal-block, general (including splicing connectors), barrier and marked-volume rules are verbatim in NFPA's own 2026-cycle records; the grounding change was rejected; values and the 24-row box table are reproduced by NFPA and internally consistent. Clamp, support fitting and conductor counting rest on verbatim older-edition text plus 2023-labelled sources with no 2026 revision.
- Nothing required for a trustworthy advanced v1 is UNVERIFIED. Items that are (domed-luminaire exception, EGC loops, "4-inch pigtail", "Table 314.16(B)(4)") are excluded or ignored.
- Hard blockers: **none**. Non-blocking: printed-book spot check (section 21).

---

## 23. Implementation notes for the next coding step

1. Scope for the coding step: **V1 as defined in section 6.9** (everything classed V1), the receipt model (8.7), the live diagram (12), the validation (10) and the tests (19). V1.1 items stay out.
2. **Do not publish this document.** Move `docs/electrical-box-fill-calculator-spec.md` outside the repo, or gitignore `docs/`, or add `X-Robots-Tag: noindex` for `/docs/*`; never add it to the sitemap. (The site deploys the repo as-is.)
3. Files to touch when building: new `tools/electrical-box-fill-calculator.html`; `assets/nav.js` (category `electrical-wiring`); `index.html` (card + `ItemList` position 10); `sitemap.xml` (21st URL); optionally one sentence in the Voltage Drop "Related tools". Nothing else. Follow `CLAUDE.md`.
4. Copy the head from an existing tool exactly (AdSense loader `ca-pub-5945580588007634` and the `google-adsense-account` meta must match other pages); then set title, description, canonical and OG/Twitter.
5. Put **all NEC data and citation strings in one constants block**: table caption, sub-paragraph numbers, allowance table, 24 box rows, loop threshold, barrier deductions. Keep the printed-book spot check a one-edit job.
6. Use exact integer arithmetic (1/10 000 in³), exact comparisons, and one `calculate()` returning one result object consumed by the receipt, summary and SVG.
7. Implement the ¼ grounding rule only. Add the T21 regression test so the rejected variant fails the suite.
8. Build a throwaway Node harness **outside the repo** that re-implements section 8 and asserts every value in section 19, including T32 (derived capacity columns equal the NFPA printed columns); then run the same cases in the browser.
9. Verify at 320, 375, 430, 768, 1024 and desktop in light and dark; check the overflow SVG state; run the standard overflow script from earlier audits; confirm no `NaN`/`Infinity`.
10. Write the FAQ once; mirror it exactly in `FAQPage` JSON-LD.
11. Perform the section 21 spot check (or note it as pending) before the page says "reviewed against NFPA 70-2026"; otherwise word the page as "based on NFPA development records for the 2026 NEC".
12. After building, update this spec with the date each gate was last checked.

---

## Appendix — Sources and access status

Primary / official (NFPA):
- NFPA 70 product and standard-development pages (2026 edition): https://www.nfpa.org/product/nfpa-70-national-electrical-code-nec/p0070code , https://www.nfpa.org/codes-and-standards/nfpa-70-standard-development/70 , https://www.nfpa.org/education-and-research/electrical/understanding-nfpa-70-national-electrical-code
- CMP-8 First Draft public inputs and responses: https://docinfofiles.nfpa.org/files/AboutTheCodes/70/70_A2025_NEC_P08_FD_PIResponses.pdf (PI 1452, 1466, 1485, 1580, 1617, 1785, 325, 3374, 3972)
- CMP-8 First Revisions: https://docinfofiles.nfpa.org/files/AboutTheCodes/70/70_A2025_NEC_P08_FD_PrelimFR.pdf (FR 7525, 7527, 7529)
- CMP-8 Second Draft: https://docinfofiles.nfpa.org/files/AboutTheCodes/70/70_A2025_NEC_P08_SD_PrelimSR.pdf (no revision to 314.16(A)/(B))
- 2026-edition TIAs (none affect Article 314): https://docinfofiles.nfpa.org/files/AboutTheCodes/70/TIA_70_26_1.pdf … `TIA_70_26_10.pdf`

Older-edition code reproduction (verbatim wording of (B)(1)–(B)(3)): https://www.ideadigitalcontent.com/files/11301/AEC_MC007_Switch_and_Outlet_Boxes_and_Covers.pdf ; IAEI Magazine "Box Fill Calculations": https://iaeimagazine.org/2016/november2016/box-fill-calculations/

Training / trade (corroboration): Electrical License Renewal pages (2020 grounding text; 2023-vs-2026 small-fittings comparison): https://www.electricallicenserenewal.com/Electrical-Continuing-Education-Courses/NEC-Content.php?sectionID=884 , `…sectionID=759.1`, `…sectionID=707`, `…sectionID=1306` ; ECM Web: https://www.ecmweb.com/content/article/20886012/box-fill-calculations ; ExpertCE: https://expertce.com/learn-articles/device-box-fill-calculations-receptacles-dimmers/

Competitors (secondary only): boxfillcalculator.com, calcshed.com, electricalcalctools.com, elecalculator.com, intrysys.com, calcexp.com, electricalsuite.com, electricianprep.co, turn2engineering.com, zing2.app (table cross-check).

Not accessible: the printed NFPA 70-2026 text, NFPA free-access reader (JavaScript only), ECMAG (HTTP 403), ICC codes (HTTP 403), Mike Holt forum (HTTP 403).

---

## 24. As-built notes (implementation step, 2026-10-05)

The calculator was built to this specification. Differences and clarifications:

- **Test expectations updated.** T6, T12 and T18 listed a smallest box computed before the 24-row Table 314.16(A) was adopted; with all 24 rows the smallest volume is 24.0 in³ (FD multiple-cover). The test harness (`tests/electrical-box-fill.test.js`) holds the corrected values.
- **Loose conductors have a type** (insulated conductor, or equipment ground / bonding jumper) so grounds that arrive separately from a cable can be entered. Required for T7, T8 and T21–T23.
- **Device yoke rows have a quantity** (identical yokes) as well as a gang count; the arithmetic is unchanged (2 × allowance × gangs × quantity).
- **Cable presets are 14/2, 14/3, 12/2, 12/3, 10/2, 10/3.** 8/3 and 6/3 were not preset because the ground sizes of those cables are product facts this research did not establish; use "Custom cable" and choose the ground size.
- **Loose-conductor limit** is 200 per row (up to 10 rows), so T16's 500 × #12 is entered as three rows.
- **Engine location.** The engine is inline in the page between `@@ENGINE_START@@` and `@@ENGINE_END@@` markers; the harness extracts and runs that exact code. All NEC constants are in one block at the top of the engine.
- **Internal documents.** `_headers` sends `X-Robots-Tag: noindex, nofollow, noarchive` for `/docs/*` and `/tests/*`, and `robots.txt` disallows both. The files remain fetchable by direct URL because the site has no build step to exclude them.
- **Not built (per scope):** barriered-box spaces (notice only), domed-luminaire exception, EGC loops, conduit bodies, 314.28.
