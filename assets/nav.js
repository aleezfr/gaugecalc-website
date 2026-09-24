// GaugeCalc site navigation — one data model, rendered into every page.
//
// Renders the category accordion, the guides list, the site links and the
// global search from the NAV object below, into <div id="gcNavBody"> inside
// each page's <nav class="rail">. To add a calculator, add it to its category
// here (and to sitemap.xml / index.html as usual). A category is only shown
// publicly once it has at least one calculator, so the empty master
// categories stay hidden until their first calculator ships.
(function () {
  'use strict';

  var NAV = {
    // Master category order. `url` is null on purpose: categories are a
    // navigation grouping only — no public category pages exist.
    categories: [
      { slug: 'cctv-ip-camera', name: 'CCTV & IP Camera', url: null, calculators: [
        { title: 'CCTV Storage Calculator', label: 'CCTV Storage', url: '/tools/cctv-storage-calculator' },
        { title: 'NVR Storage Calculator', label: 'NVR Storage', url: '/tools/nvr-storage-calculator' },
        { title: 'IP Camera Bandwidth Calculator', label: 'IP Camera Bandwidth', url: '/tools/ip-camera-bandwidth-calculator' },
        { title: 'Field of View Calculator', label: 'Field of View', url: '/tools/field-of-view-calculator' }
      ] },
      { slug: 'electrical-wiring', name: 'Electrical & Wiring', url: null, calculators: [
        { title: 'Voltage Drop Calculator', label: 'Voltage Drop', url: '/tools/voltage-drop-calculator' }
      ] },
      { slug: 'fire-alarm-elv', name: 'Fire Alarm & ELV', url: null, calculators: [] },
      { slug: 'battery-ups', name: 'Battery & UPS', url: null, calculators: [
        { title: 'Battery Backup Calculator', label: 'Battery Backup', url: '/tools/battery-backup-calculator' },
        { title: 'Battery Amp-Hour Calculator', label: 'Battery Amp-Hour', url: '/tools/battery-amp-hour-calculator' },
        { title: 'Amp-Hour Calculator', label: 'Amp-Hour', url: '/tools/amp-hour-calculator' }
      ] },
      { slug: 'solar-dc-power', name: 'Solar & DC Power', url: null, calculators: [] },
      { slug: 'motors-industrial', name: 'Motors & Industrial', url: null, calculators: [] },
      { slug: 'networking-poe', name: 'Networking & PoE', url: null, calculators: [
        { title: 'PoE Budget Calculator', label: 'PoE Budget', url: '/tools/poe-budget-calculator' }
      ] },
      { slug: 'lighting', name: 'Lighting', url: null, calculators: [] }
    ],
    guidesIndex: { title: 'All Guides', url: '/blog/' },
    guides: [
      { title: 'NVR Storage Calculation: 12 Mistakes That Leave You Short on Space', label: 'NVR Storage Mistakes', url: '/blog/nvr-storage-mistakes' },
      { title: 'IP Camera Bandwidth: Why the Switch (and PoE Budget) Fail First', label: 'IP Bandwidth Mistakes', url: '/blog/ip-camera-bandwidth-mistakes' },
      { title: 'Analog vs. IP CCTV in 2026: Which Should You Actually Install', label: 'Analog vs IP CCTV', url: '/blog/analog-vs-ip-cctv' },
      { title: 'How to Choose the Right Battery Size for a Security Panel', label: 'Battery Sizing Guide', url: '/blog/battery-sizing-guide' },
      { title: 'Choosing the Right CCTV Lens: Coverage vs. Identification Distance', label: 'Lens Selection Guide', url: '/blog/cctv-lens-selection-guide' },
      { title: 'PoE Budget Calculator: How Many Cameras Can Your Switch Run?', label: 'PoE Budget Math', url: '/blog/poe-budget-calculator-how-many-cameras' },
      { title: 'CCTV Voltage Drop Calculator: Why Cameras Fail After Dark', label: 'Voltage Drop at Night', url: '/blog/cctv-voltage-drop-calculator-camera-offline-at-night' }
    ],
    site: [
      { label: 'Privacy Policy', url: '/privacy-policy' },
      { label: 'Contact', url: '/contact' },
      { label: 'Feedback', url: '/feedback' }
    ]
  };

  var body = document.getElementById('gcNavBody');
  var rail = body && body.closest('.rail');
  if (!body || !rail) return;

  var categories = NAV.categories.filter(function (c) { return c.calculators.length > 0; });
  var doc = document.documentElement;
  var mqDesktop = window.matchMedia('(min-width: 821px)');

  /* ---------- helpers ---------- */

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function normPath(p) {
    p = p.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
    return p.length > 1 ? p.replace(/\/+$/, '') : p;
  }

  var here = normPath(location.pathname);
  function isHere(url) { return normPath(url) === here; }

  var ICONS = {
    chev: '<svg class="acc-chev" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    chevSm: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5 10.5 8 6 12.5"/></svg>',
    search: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>',
    menu: '<svg class="ic-menu" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>' +
          '<svg class="ic-close" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>'
  };

  /* ---------- sidebar / drawer body ---------- */

  function accordion(id, name, count, itemsHtml, open) {
    return '<div class="acc" data-acc="' + esc(id) + '">' +
      '<button type="button" class="acc-trigger" aria-expanded="' + (open ? 'true' : 'false') + '" aria-controls="acc-' + esc(id) + '">' +
      ICONS.chev + '<span class="acc-name">' + esc(name) + '</span><span class="acc-count">' + count + '</span></button>' +
      '<ul class="acc-panel" id="acc-' + esc(id) + '"' + (open ? '' : ' hidden') + '>' + itemsHtml + '</ul></div>';
  }

  function link(item) {
    return '<li><a class="acc-link" href="' + esc(item.url) + '"' + (isHere(item.url) ? ' aria-current="page"' : '') + '>' + esc(item.label) + '</a></li>';
  }

  function buildBody() {
    var html = '<button type="button" class="rail-search" data-gc-search aria-haspopup="dialog" aria-label="Search calculators, categories and guides">' +
      ICONS.search + '<span class="rail-search-text">Search calculators</span><kbd class="rail-search-key" aria-hidden="true">/</kbd></button>';

    html += '<p class="rail-cat">Calculators</p>';
    categories.forEach(function (c) {
      var open = c.calculators.some(function (k) { return isHere(k.url); });
      html += accordion(c.slug, c.name, c.calculators.length, c.calculators.map(link).join(''), open);
    });

    html += '<p class="rail-cat">Guides</p>';
    html += '<a class="acc-link acc-link--top" href="' + NAV.guidesIndex.url + '"' + (isHere(NAV.guidesIndex.url) ? ' aria-current="page"' : '') + '>' + esc(NAV.guidesIndex.title) + '</a>';
    var guideOpen = NAV.guides.some(function (g) { return isHere(g.url); });
    html += accordion('guides', 'Browse guides', NAV.guides.length, NAV.guides.map(link).join(''), guideOpen);

    html += '<div class="rail-foot">' + NAV.site.map(function (s) {
      return '<a href="' + esc(s.url) + '"' + (isHere(s.url) ? ' aria-current="page"' : '') + '>' + esc(s.label) + '</a>';
    }).join('') + '</div>';
    return html;
  }

  body.innerHTML = buildBody();
  rail.classList.add('is-js');

  /* ---------- footer ---------- */
  /* Same NAV data as the sidebar, rendered into #gcFooterCols (present on
     every page next to the static .footer-brand block). Every item for a
     growing list is rendered — CSS (see .footer-col--grow) decides how
     many show per breakpoint and whether "See all" appears, so this stays
     correct with 9 calculators today or 30 later without code changes. */

  function footerColumn(label, items, seeAllUrl, grow) {
    var html = '<nav class="footer-col' + (grow ? ' footer-col--grow' : '') + '" aria-label="' + esc(label) + '">' +
      '<p class="footer-heading">' + esc(label) + '</p>';
    items.forEach(function (it) {
      html += '<a class="footer-link" href="' + esc(it.url) + '">' + esc(it.label) + '</a>';
    });
    if (grow && seeAllUrl) {
      html += '<a class="footer-see-all" href="' + esc(seeAllUrl) + '">See All' + ICONS.chevSm + '</a>';
    }
    return html + '</nav>';
  }

  function buildFooter() {
    var mount = document.getElementById('gcFooterCols');
    if (!mount) return;

    var calcItems = [];
    categories.forEach(function (c) {
      c.calculators.forEach(function (k) { calcItems.push({ url: k.url, label: k.label }); });
    });
    var catItems = categories.map(function (c) { return { url: '/#cat-' + c.slug, label: c.name }; });
    var resItems = NAV.guides.map(function (g) { return { url: g.url, label: g.label }; });
    var siteItems = NAV.site.map(function (s) { return { url: s.url, label: s.label }; });

    mount.innerHTML =
      footerColumn('Calculators', calcItems, '/', true) +
      footerColumn('Categories', catItems, '/#calculators', true) +
      footerColumn('Resources', resItems, NAV.guidesIndex.url, true) +
      footerColumn('Site', siteItems, null, false);
  }

  buildFooter();

  /* Header tools (search + menu) — icons are shown at phone/tablet widths only. */
  var top = rail.querySelector('.rail-top');
  var themeBtn = top.querySelector('.theme-toggle');
  var searchIconBtn = document.createElement('button');
  searchIconBtn.type = 'button';
  searchIconBtn.className = 'rail-tool rail-tool--search';
  searchIconBtn.setAttribute('data-gc-search', '');
  searchIconBtn.setAttribute('aria-haspopup', 'dialog');
  searchIconBtn.setAttribute('aria-label', 'Search calculators, categories and guides');
  searchIconBtn.innerHTML = ICONS.search;
  top.insertBefore(searchIconBtn, themeBtn);

  var menuBtn = document.createElement('button');
  menuBtn.type = 'button';
  menuBtn.className = 'rail-tool rail-tool--menu';
  menuBtn.setAttribute('aria-label', 'Menu');
  menuBtn.setAttribute('aria-expanded', 'false');
  menuBtn.setAttribute('aria-controls', 'gcNavBody');
  menuBtn.innerHTML = ICONS.menu;
  top.appendChild(menuBtn);

  /* ---------- accordion behaviour (several may be open at once) ---------- */

  function setAcc(acc, open) {
    var trig = acc.querySelector('.acc-trigger');
    var panel = acc.querySelector('.acc-panel');
    trig.setAttribute('aria-expanded', open ? 'true' : 'false');
    panel.hidden = !open;
  }

  body.addEventListener('click', function (e) {
    var trig = e.target.closest('.acc-trigger');
    if (!trig) return;
    setAcc(trig.closest('.acc'), trig.getAttribute('aria-expanded') !== 'true');
  });

  /* ---------- mobile drawer ---------- */

  function setMenu(open) {
    rail.classList.toggle('is-open', open);
    doc.classList.toggle('gc-nav-open', open);
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  menuBtn.addEventListener('click', function () {
    setMenu(menuBtn.getAttribute('aria-expanded') !== 'true');
  });

  // Esc or a tap outside the header/sheet closes the menu.
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && rail.classList.contains('is-open')) {
      setMenu(false);
      menuBtn.focus();
    }
  });

  document.addEventListener('click', function (e) {
    if (rail.classList.contains('is-open') && !rail.contains(e.target)) setMenu(false);
  });

  function onBreakpoint() { if (mqDesktop.matches) setMenu(false); }
  if (mqDesktop.addEventListener) mqDesktop.addEventListener('change', onBreakpoint);
  else if (mqDesktop.addListener) mqDesktop.addListener(onBreakpoint);

  /* Open a category in the sidebar (used by search "category" results). */
  function revealCategory(slug) {
    var acc = body.querySelector('.acc[data-acc="' + slug + '"]');
    if (!acc) return;
    if (!mqDesktop.matches) setMenu(true);
    setAcc(acc, true);
    var trig = acc.querySelector('.acc-trigger');
    trig.focus();
    if (trig.scrollIntoView) trig.scrollIntoView({ block: 'nearest' });
  }

  /* ---------- global search ---------- */

  function norm(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }

  var index = [];
  categories.forEach(function (c) {
    c.calculators.forEach(function (k) {
      index.push({ type: 'calculator', title: k.title, meta: c.name, url: k.url, t: norm(k.title), hay: norm(k.title + ' ' + c.name) });
    });
  });
  categories.forEach(function (c) {
    var n = c.calculators.length;
    index.push({ type: 'category', title: c.name, meta: n + (n === 1 ? ' calculator' : ' calculators'), slug: c.slug, t: norm(c.name), hay: norm(c.name) });
  });
  NAV.guides.forEach(function (g) {
    index.push({ type: 'guide', title: g.title, meta: 'Guide', url: g.url, t: norm(g.title), hay: norm(g.title + ' ' + g.label) });
  });

  var GROUPS = [
    { type: 'calculator', label: 'Calculators', max: 8 },
    { type: 'category', label: 'Categories', max: 5 },
    { type: 'guide', label: 'Guides', max: 5 }
  ];

  function search(q) {
    var tokens = norm(q).split(' ').filter(Boolean);
    if (!tokens.length) return [];
    var whole = tokens.join(' ');
    var out = [];
    index.forEach(function (item, pos) {
      var score = 0;
      for (var i = 0; i < tokens.length; i++) {
        var tk = tokens[i];
        if (item.hay.indexOf(tk) === -1) return;
        if (item.t.indexOf(tk) === 0 || item.t.indexOf(' ' + tk) !== -1) score += 3;
        else if (item.t.indexOf(tk) !== -1) score += 2;
        else score += 1;
      }
      if (item.t.indexOf(whole) === 0) score += 5;
      out.push({ item: item, score: score, pos: pos });
    });
    out.sort(function (a, b) { return b.score - a.score || a.pos - b.pos; });
    return out.map(function (r) { return r.item; });
  }

  var dlg = null, input, list, status, active = -1, opts = [], opener = null;

  function buildDialog() {
    dlg = document.createElement('dialog');
    dlg.className = 'gc-search';
    dlg.id = 'gcSearch';
    dlg.setAttribute('aria-label', 'Search GaugeCalc');
    dlg.innerHTML =
      '<div class="gc-search-box">' + ICONS.search +
      '<input type="search" class="gc-search-input" id="gcSearchInput" role="combobox" aria-expanded="true" aria-controls="gcSearchList" aria-autocomplete="list" ' +
      'aria-label="Search calculators, categories and guides" placeholder="Search calculators, categories, guides" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search">' +
      '<button type="button" class="gc-search-clear" aria-label="Clear search" hidden>Clear</button>' +
      '<button type="button" class="gc-search-close" aria-label="Close search">Esc</button></div>' +
      '<div class="gc-search-results" id="gcSearchList" role="listbox" aria-label="Search results"></div>' +
      '<p class="gc-search-status" role="status" aria-live="polite"></p>';
    document.body.appendChild(dlg);
    input = dlg.querySelector('.gc-search-input');
    list = dlg.querySelector('.gc-search-results');
    status = dlg.querySelector('.gc-search-status');
    var clear = dlg.querySelector('.gc-search-clear');

    input.addEventListener('input', function () { clear.hidden = !input.value; render(input.value); });
    clear.addEventListener('click', function () { input.value = ''; clear.hidden = true; render(''); input.focus(); });
    dlg.querySelector('.gc-search-close').addEventListener('click', closeSearch);

    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Home' && opts.length && !input.value) { e.preventDefault(); setActive(0); }
      else if (e.key === 'Enter') { e.preventDefault(); if (opts[active]) choose(opts[active]); }
    });

    list.addEventListener('click', function (e) {
      var o = e.target.closest('[role="option"]');
      if (!o) return;
      if (o.hasAttribute('data-cat')) { e.preventDefault(); choose(o); }
    });
    list.addEventListener('mousemove', function (e) {
      var o = e.target.closest('[role="option"]');
      if (o) setActive(opts.indexOf(o), true);
    });

    // Backdrop click closes (the dialog element itself is the click target there).
    dlg.addEventListener('click', function (e) { if (e.target === dlg) closeSearch(); });
    dlg.addEventListener('close', function () { doc.classList.remove('gc-search-open'); });
  }

  function optionHtml(item, i) {
    var inner = '<span class="gc-opt-title">' + esc(item.title) + '</span><span class="gc-opt-meta">' + esc(item.meta) + '</span>';
    var id = 'gcOpt' + i;
    if (item.type === 'category') {
      return '<a role="option" id="' + id + '" tabindex="-1" aria-selected="false" class="gc-opt" href="#" data-cat="' + esc(item.slug) + '">' + inner + '</a>';
    }
    return '<a role="option" id="' + id + '" tabindex="-1" aria-selected="false" class="gc-opt" href="' + esc(item.url) + '">' + inner + '</a>';
  }

  function render(q) {
    var results = q.trim() ? search(q) : [];
    var html = '', n = 0;
    if (!q.trim()) {
      // Idle state: browse categories.
      results = index.filter(function (it) { return it.type === 'category'; });
      html += '<div class="gc-group" role="group" aria-label="Categories"><p class="gc-group-label" aria-hidden="true">Browse categories</p>';
      results.forEach(function (it) { html += optionHtml(it, n++); });
      html += '</div>';
      status.textContent = '';
    } else if (!results.length) {
      html = '<p class="gc-empty"><strong>No matches for “' + esc(q.trim()) + '”.</strong> Try a shorter word, like “battery”, “PoE” or “storage”.</p>';
      status.textContent = 'No results';
    } else {
      GROUPS.forEach(function (g) {
        var items = results.filter(function (it) { return it.type === g.type; }).slice(0, g.max);
        if (!items.length) return;
        html += '<div class="gc-group" role="group" aria-label="' + g.label + '"><p class="gc-group-label" aria-hidden="true">' + g.label + '</p>';
        items.forEach(function (it) { html += optionHtml(it, n++); });
        html += '</div>';
      });
      status.textContent = n + (n === 1 ? ' result' : ' results');
    }
    list.innerHTML = html;
    opts = Array.prototype.slice.call(list.querySelectorAll('[role="option"]'));
    active = -1;
    input.removeAttribute('aria-activedescendant');
    if (opts.length && q.trim()) setActive(0);
  }

  function setActive(i, noScroll) {
    if (active > -1 && opts[active]) { opts[active].setAttribute('aria-selected', 'false'); opts[active].classList.remove('is-active'); }
    active = i;
    if (i < 0 || !opts[i]) { input.removeAttribute('aria-activedescendant'); return; }
    opts[i].setAttribute('aria-selected', 'true');
    opts[i].classList.add('is-active');
    input.setAttribute('aria-activedescendant', opts[i].id);
    if (!noScroll) opts[i].scrollIntoView({ block: 'nearest' });
  }

  function move(d) {
    if (!opts.length) return;
    setActive(active < 0 ? (d > 0 ? 0 : opts.length - 1) : (active + d + opts.length) % opts.length);
  }

  function choose(o) {
    if (o.hasAttribute('data-cat')) {
      var slug = o.getAttribute('data-cat');
      closeSearch(true);
      // Wait a frame so the dialog's own focus restoration doesn't win.
      requestAnimationFrame(function () { revealCategory(slug); });
    } else {
      location.href = o.getAttribute('href');
    }
  }

  function openSearch(from) {
    if (!dlg) buildDialog();
    opener = from || document.activeElement;
    if (rail.classList.contains('is-open')) setMenu(false);
    input.value = '';
    dlg.querySelector('.gc-search-clear').hidden = true;
    render('');
    doc.classList.add('gc-search-open');
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    input.focus();
  }

  function closeSearch(skipRestore) {
    if (!dlg || !dlg.open) return;
    if (dlg.close) dlg.close(); else dlg.removeAttribute('open');
    doc.classList.remove('gc-search-open');
    if (skipRestore !== true && opener && opener.focus) opener.focus();
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-gc-search]');
    if (t) openSearch(t);
  });

  document.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName) || '';
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(tag) || (e.target && e.target.isContentEditable);
    var combo = (e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k';
    var slash = e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !typing;
    if (combo || slash) {
      e.preventDefault();
      if (!dlg || !dlg.open) openSearch();
    }
  });
})();
