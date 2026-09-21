# GaugeCalc

Static website for [GaugeCalc](https://gaugecalc.com) — free calculators and field guides for CCTV, PoE, and network installers (voltage drop, PoE budget, storage sizing, battery backup, bandwidth, field of view, etc.).

No build step — plain HTML/CSS/JS served as static files.

## Structure

```
/
├── index.html            Home page
├── contact.html          Contact page
├── feedback.html         Feedback page
├── privacy-policy.html   Privacy policy
├── 404.html              Custom 404 page
├── robots.txt
├── sitemap.xml
├── favicon.ico
├── assets/               Shared CSS, JS, icons, favicons, OG image
│   ├── style.css
│   ├── theme.js
│   ├── nav.js            Sidebar / mobile menu / search (one data model, all pages)
│   ├── calc-ux.js        Calculate button, jump-to-result, Recalculate/Reset (tool pages)
│   └── ...icons
├── blog/                 Field guides / blog articles
│   └── index.html        Blog listing page
└── tools/                Calculator pages (one HTML file per tool)
```

## Adding a new tool

1. Create `tools/<tool-name>.html` following the structure/styling of an existing calculator in `tools/`.
2. Link it from the relevant section on `index.html`.
3. Add it to its category in `assets/nav.js` (the single data model behind the sidebar, mobile menu and search). A category appears publicly once it has a calculator.
4. Add its URL to `sitemap.xml`.

## Adding a new blog post

1. Create `blog/<post-slug>.html`.
2. Add a link/card to `blog/index.html`.
3. Add its URL to `sitemap.xml`.

## Deployment

Static files only — deploy by publishing the repository contents as-is (no build/compile step required).
