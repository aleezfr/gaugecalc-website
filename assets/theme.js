// GaugeCalc theme toggle — click handling + persistence.
// The instant theme apply (to avoid a flash of the wrong theme) happens
// in a tiny inline script in each page's <head>, before this file loads.
(function () {
  function wire() {
    var btn = document.getElementById('themeToggle');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var root = document.documentElement;
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('gc-theme', next); } catch (e) {}
      btn.setAttribute('aria-pressed', next === 'dark' ? 'true' : 'false');
    });
    btn.setAttribute('aria-pressed', document.documentElement.getAttribute('data-theme') === 'dark' ? 'true' : 'false');
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
