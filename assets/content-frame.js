(function () {
  function inShellFrame() {
    try {
      return window.parent && window.parent !== window;
    } catch (error) {
      return false;
    }
  }

  function notifyHeight() {
    if (!inShellFrame()) {
      return;
    }

    try {
      window.parent.postMessage({ type: 'ooms:resize' }, window.location.origin);
    } catch (error) {
      return;
    }
  }

  window.addEventListener('load', notifyHeight);
  window.addEventListener('resize', notifyHeight);

  if (window.ResizeObserver && document.body) {
    var observer = new ResizeObserver(notifyHeight);
    observer.observe(document.body);
    if (document.documentElement) {
      observer.observe(document.documentElement);
    }
  }

  document.addEventListener('click', function (event) {
    var anchor = event.target.closest('a[data-shell-route]');

    if (!anchor) {
      return;
    }

    if (!inShellFrame()) {
      return;
    }

    event.preventDefault();

    try {
      window.parent.postMessage({
        type: 'ooms:navigate',
        route: anchor.getAttribute('data-shell-route') || '',
        bpCode: anchor.getAttribute('data-shell-bp-code') || ''
      }, window.location.origin);
    } catch (error) {
      return;
    }
  });
})();
