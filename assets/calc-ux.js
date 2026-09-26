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
