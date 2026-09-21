// GaugeCalc calculator UX layer — Calculate CTA, jump-to-result, Recalculate / Reset.
//
// Loaded on tool pages only. It never contains or changes a formula: the
// calculators still update live as you type, exactly as before. This layer adds
// an explicit "Calculate" action that re-runs the page's own calculate(),
// then (only if the inputs are valid) scrolls to and focuses the result.
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
  actions.innerHTML = '<button type="button" class="btn calc-cta">Calculate</button>';
  inputPanel.appendChild(actions);

  var resultActions = document.createElement('div');
  resultActions.className = 'result-actions';
  resultActions.innerHTML =
    '<button type="button" class="btn btn-ghost calc-recalc">Recalculate</button>' +
    '<button type="button" class="btn btn-ghost calc-reset">Reset</button>';
  result.appendChild(resultActions);

  // The result panel becomes a labelled, focusable landmark so keyboard and
  // screen-reader users can be moved to the answer.
  result.setAttribute('role', 'region');
  result.setAttribute('tabindex', '-1');
  result.addEventListener('blur', function () { result.classList.remove('is-focused'); });
  nameResult();

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

  function calculateAndShow() {
    runCalculation();
    var bad = firstInvalid();
    if (bad) {
      // Validation failed: keep the user in the inputs, on the first problem.
      result.classList.remove('is-focused');
      bad.focus();
      return false;
    }
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
    runCalculation();
  }

  /* ---------- wiring ---------- */

  actions.querySelector('.calc-cta').addEventListener('click', calculateAndShow);

  resultActions.querySelector('.calc-recalc').addEventListener('click', function () {
    runCalculation();
    if (firstInvalid()) { result.classList.remove('is-focused'); firstInvalid().focus(); return; }
    nameResult();
    result.focus({ preventScroll: true });
    result.classList.add('is-focused');
  });

  resultActions.querySelector('.calc-reset').addEventListener('click', function () {
    resetToDefaults();
    // Back to the first input so the next run starts at the top of the form.
    var first = inputPanel.querySelector('input:not([type="hidden"]), select');
    result.classList.remove('is-focused');
    if (first && visible(first)) first.focus();
  });
})();
