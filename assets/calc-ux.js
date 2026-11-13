// GaugeCalc calculator UX layer — Calculate/Reset in the input panel,
// Recalculate in the result panel, jump-to-result.
//
// Loaded on tool pages only. It never contains or changes a formula: the
// calculators still update live as you type, exactly as before. This layer adds
// an explicit "Calculate" action that re-runs the page's own calculate(),
// then (only if the inputs are valid) scrolls to and focuses the result.
// Recalculate is a navigation action, not a reset: it just scrolls the user
// back to the inputs to review/change values before calculating again.
(function () {
  'use strict';

  /* ---------- analytics (GA4) ---------- */

  // Two events only, each with the same two parameters: calculator_id (this
  // page's URL slug, or a fixed id for a second calculator on the same page)
  // and category (its nav category slug). No input value, result or anything
  // else the user typed is ever put into an event.
  var calculatorId = (location.pathname.replace(/\/+$/, '').split('/').pop() || '').replace(/\.html$/, '');

  // A page with a second calculator that calc-ux.js does not wire up (it owns
  // its own Calculate button). Keyed by that calculator's result panel id.
  var SECOND_CALCULATORS = { sizingResult: 'amp-hour-battery-sizing' };

  // nav.js (loaded before this file) marks the current calculator's link and
  // wraps it in its category accordion, so the category comes from the same
  // data model as the sidebar and needs no second list here.
  function calculatorCategory() {
    var here = document.querySelector('.acc-link[aria-current="page"]');
    var acc = here && here.closest ? here.closest('.acc[data-acc]') : null;
    return (acc && acc.getAttribute('data-acc')) || 'uncategorized';
  }

  // True only when the event was really handed to gtag. gtag() just queues in
  // dataLayer, so it is safe to call before gtag.js has finished loading.
  function send(name, id) {
    try {
      if (!id || typeof window.gtag !== 'function') return false;
      window.gtag('event', name, { calculator_id: id, category: calculatorCategory() });
      return true;
    } catch (e) { return false; /* analytics must never break a calculator */ }
  }

  // If gtag is not defined yet, try again shortly (up to about 10 seconds)
  // instead of losing the event. Gives up quietly if it never appears.
  function retry(attempt) {
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      if (attempt() || tries >= 20) clearInterval(timer);
    }, 500);
  }

  function track(name, id) {
    if (send(name, id)) return;
    retry(function () { return send(name, id); });
  }

  // calculator_open: once per page load, even if this file were included
  // twice. The "sent" flag is set only after the event was really queued; the
  // "pending" flag stops a second copy of this file from starting its own retry.
  function trackOpen() {
    if (window.__gcCalculatorOpenSent || window.__gcCalculatorOpenPending) return;
    if (send('calculator_open', calculatorId)) { window.__gcCalculatorOpenSent = true; return; }
    window.__gcCalculatorOpenPending = true;
    retry(function () {
      if (window.__gcCalculatorOpenSent) { window.__gcCalculatorOpenPending = false; return true; }
      if (send('calculator_open', calculatorId)) {
        window.__gcCalculatorOpenSent = true;
        window.__gcCalculatorOpenPending = false;
        return true;
      }
      return false;
    });
  }
  trackOpen();

  var layout = document.querySelector('.calc-layout');
  var result = layout && layout.querySelector('.result-panel');
  var inputPanel = layout && layout.querySelector('.panel:not(.result-panel)');
  if (!result || !inputPanel) return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- markup ---------- */

  var actions = document.createElement('div');
  actions.className = 'calc-actions';
  actions.innerHTML =
    '<button type="button" class="btn calc-cta">Calculate</button>' +
    '<button type="button" class="btn btn-ghost calc-reset">Reset</button>';
  inputPanel.appendChild(actions);

  var resultActions = document.createElement('div');
  resultActions.className = 'result-actions';
  resultActions.innerHTML = '<button type="button" class="btn btn-ghost calc-recalc">Recalculate</button>';
  result.appendChild(resultActions);

  // The result panel becomes a labelled, focusable landmark so keyboard and
  // screen-reader users can be moved to the answer.
  result.setAttribute('role', 'region');
  result.setAttribute('tabindex', '-1');
  result.addEventListener('blur', function () { result.classList.remove('is-focused'); });
  nameResult();

  // No Calculate = no result: hide the result panel (and everything inside
  // it, including its aria-live region) until the user explicitly presses
  // Calculate. Calculators still compute live under the hood as inputs
  // change — only the panel's visibility is gated, so the values shown the
  // moment it's revealed are already current.
  layout.classList.add('is-pending');
  result.classList.add('is-pending');

  function revealResult() {
    layout.classList.remove('is-pending');
    result.classList.remove('is-pending');
  }

  function hideResult() {
    layout.classList.add('is-pending');
    result.classList.add('is-pending');
  }

  /* ---------- helpers ---------- */

  function visible(el) { return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length); }

  // Re-run the page's own calculation. Every calculator exposes calculate();
  // the voltage-drop page keeps it inside a closure, so nudge it with the same
  // event its own inputs already listen to.
  function runCalculation() {
    if (typeof window.calculate === 'function') { window.calculate(); return; }
    var control = inputPanel.querySelector('input:not([type="hidden"]), select');
    if (control) {
      control.dispatchEvent(new Event('input', { bubbles: true }));
      control.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function firstInvalid() {
    var bad = inputPanel.querySelectorAll('[aria-invalid="true"]');
    for (var i = 0; i < bad.length; i++) if (visible(bad[i])) return bad[i];
    return null;
  }

  // For analytics only (it changes nothing the user sees): a calculation did
  // not succeed if a field is flagged invalid or a visible error message is
  // showing. Some pages (wire size, conduit fill) show a .field-error message
  // instead of setting aria-invalid.
  function hasVisibleError(root) {
    var flagged = root.querySelectorAll('[aria-invalid="true"], .field-error');
    for (var i = 0; i < flagged.length; i++) {
      var el = flagged[i];
      if (el.classList.contains('field-error') && !(el.textContent || '').trim()) continue;
      if (visible(el)) return true;
    }
    return false;
  }

  function nameResult() {
    var heads = result.querySelectorAll('h2');
    for (var i = 0; i < heads.length; i++) {
      if (visible(heads[i])) {
        if (!heads[i].id) heads[i].id = 'gcResultHeading';
        result.setAttribute('aria-labelledby', heads[i].id);
        return;
      }
    }
    result.setAttribute('aria-label', 'Calculation result');
  }

  function stickyOffset() {
    var rail = document.querySelector('.rail');
    return rail && getComputedStyle(rail).position === 'sticky' && rail.getBoundingClientRect().top <= 0 && window.innerWidth <= 820
      ? rail.offsetHeight : 0;
  }

  function showResult() {
    nameResult();
    result.focus({ preventScroll: true });
    result.classList.add('is-focused');
    // Only scroll when the result's top isn't already comfortably on screen
    // (on desktop the result sits beside the inputs and is usually visible).
    var top = result.getBoundingClientRect().top;
    if (top < stickyOffset() || top > window.innerHeight * 0.55) {
      result.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
    }
  }

  // Mirrors showResult()'s "already in a good spot? don't jump" check, but
  // for landing back on the calculator itself after Reset.
  function scrollToCalculator() {
    var top = layout.getBoundingClientRect().top;
    var offset = stickyOffset();
    if (top < offset - 4 || top > offset + 80) {
      layout.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
    }
  }

  function calculateAndShow() {
    runCalculation();
    var bad = firstInvalid();
    if (bad) {
      // Validation failed: keep the user in the inputs, on the first problem,
      // and keep the result panel hidden — no result until Calculate succeeds.
      result.classList.remove('is-focused');
      bad.focus();
      return false;
    }
    revealResult();
    showResult();
    // A page whose calculation finishes later (DNS lookup) reports success
    // itself, see the 'gc:calculation-success' listener below.
    if (!window.__gcAsyncCalculation && !hasVisibleError(layout)) track('calculation_complete', calculatorId);
    return true;
  }

  /* ---------- reset ---------- */

  var deviceList = document.getElementById('deviceList');
  var fields = Array.prototype.slice.call(inputPanel.querySelectorAll('input, select, textarea'))
    .filter(function (el) { return !(deviceList && deviceList.contains(el)); })
    .map(function (el) { return { el: el, value: el.value, checked: el.checked }; });
  var toggles = Array.prototype.slice.call(inputPanel.querySelectorAll('.toggle-row')).map(function (row) {
    var btns = Array.prototype.slice.call(row.querySelectorAll('.toggle-btn'));
    var init = btns.filter(function (b) { return b.classList.contains('active'); })[0] || null;
    return { btns: btns, init: init };
  });
  var initialRows = deviceList ? deviceList.querySelectorAll('.device-row').length : 0;

  function fire(el) {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function resetToDefaults() {
    // 1. Toggles first — through the page's own click handlers, so its state
    //    (mode, units, chemistry…) and visible sections follow.
    toggles.forEach(function (t) {
      if (t.init && !t.init.classList.contains('active')) t.init.click();
    });
    // 2. Field values back to what the page loaded with.
    fields.forEach(function (f) {
      var changed = f.el.value !== f.value || f.el.checked !== f.checked;
      f.el.value = f.value;
      f.el.checked = f.checked;
      if (changed) fire(f.el);
    });
    // 3. PoE device rows: back to the starting row count / values.
    if (deviceList) {
      var add = document.getElementById('addDeviceBtn');
      var rows = deviceList.querySelectorAll('.device-row');
      while (rows.length > Math.max(initialRows, 1)) {
        rows[rows.length - 1].querySelector('.device-row-remove').click();
        rows = deviceList.querySelectorAll('.device-row');
      }
      while (rows.length < initialRows && add) { add.click(); rows = deviceList.querySelectorAll('.device-row'); }
      // Removing the last remaining row resets it to its defaults.
      if (rows.length === 1) rows[0].querySelector('.device-row-remove').click();
    }
  }

  /* ---------- wiring ---------- */

  actions.querySelector('.calc-cta').addEventListener('click', calculateAndShow);

  // Asynchronous calculation (DNS lookup): the page announces a finished,
  // successful lookup. An invalid name, an unreachable resolver or a failed
  // request never announces anything, so they are never counted.
  // Registered once per page even if this file is loaded twice.
  if (!window.__gcAsyncListener) {
    window.__gcAsyncListener = true;
    document.addEventListener('gc:calculation-success', function () {
      track('calculation_complete', calculatorId);
    });
  }

  // A second calculator on the same page (amp-hour page) keeps its own
  // Calculate button and validation. This only listens: it counts a click as a
  // calculation once the page's own handler (registered earlier, while the page
  // was parsed) has run and left no visible invalid field and a shown result.
  Array.prototype.slice.call(document.querySelectorAll('.calc-layout')).forEach(function (other) {
    var panel = other.querySelector('.result-panel');
    var id = panel && SECOND_CALCULATORS[panel.id];
    var button = other.querySelector('.calc-cta');
    if (!id || !button || other === layout || button.__gcTracked) return;
    button.__gcTracked = true; // one listener even if this file is loaded twice
    button.addEventListener('click', function () {
      if (panel.classList.contains('is-pending')) return;
      if (hasVisibleError(other)) return;
      track('calculation_complete', id);
    });
  });

  // Recalculate is a navigation action, not Reset: it doesn't touch input
  // values, mode, or the displayed result — it just takes the user back to
  // the inputs so they can review/change values and press Calculate again.
  resultActions.querySelector('.calc-recalc').addEventListener('click', function () {
    result.classList.remove('is-focused');
    // Back to the first input, preventScroll so the browser's own focus-scroll
    // can't fight the explicit scrollToCalculator() below.
    var first = inputPanel.querySelector('input:not([type="hidden"]), select');
    if (first && visible(first)) first.focus({ preventScroll: true });
    scrollToCalculator();
  });

  actions.querySelector('.calc-reset').addEventListener('click', function () {
    resetToDefaults();
    result.classList.remove('is-focused');
    // Reset returns to the pre-Calculate state: no result until the user
    // explicitly calculates again.
    hideResult();
    // Back to the first input so the next run starts at the top of the form —
    // preventScroll so the browser's own focus-scroll can't fight the explicit
    // scrollToCalculator() below (e.g. jump to a field that shifted position
    // when toggles/device rows reset).
    var first = inputPanel.querySelector('input:not([type="hidden"]), select');
    if (first && visible(first)) first.focus({ preventScroll: true });
    scrollToCalculator();
  });
})();
