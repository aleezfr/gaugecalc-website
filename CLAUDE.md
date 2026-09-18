# CLAUDE.md

Instructions for Claude Code when working in this repo.

## Project

GaugeCalc (gaugecalc.com) — static website with free calculators and field guides for CCTV/PoE/electrical installers. See [README.md](README.md) for full structure.

## Key facts

- Plain static HTML/CSS/JS. No build step, no `package.json`, no framework.
- Shared styling/scripts live in `assets/style.css` and `assets/theme.js` — reuse these instead of inlining new CSS/JS in a page.
- Every calculator is a single self-contained HTML file in `tools/`.
- Every article is a single self-contained HTML file in `blog/`.
- Deployment is just publishing the repo contents as-is.

## Conventions

- When adding a new tool: copy the structure/styling of an existing file in `tools/`, link it from `index.html`, and add its URL to `sitemap.xml`.
- When adding a new blog post: copy the structure/styling of an existing file in `blog/`, add a card/link to `blog/index.html`, and add its URL to `sitemap.xml`.
- Keep `sitemap.xml` in sync whenever a page is added or removed.
- Don't introduce a build tool, bundler, or framework — the site is intentionally build-free.
