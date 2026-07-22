(function () {
  function inShellFrame() {
    try {
      return window.parent && window.parent !== window;
    } catch (error) {
      return false;
    }
  }

  function applyEmbeddedLayout() {
    if (!inShellFrame()) {
      return;
    }

    if (document.body) {
      document.body.classList.add('content-embedded');
    }
  }

  function getPrimaryContentNode() {
    return document.querySelector('main') || document.body;
  }

  function getContentHeight() {
    var node = getPrimaryContentNode();

    if (!node) {
      return 0;
    }

    var rect = node.getBoundingClientRect();
    var style = window.getComputedStyle(node);
    var marginTop = parseFloat(style.marginTop) || 0;
    var marginBottom = parseFloat(style.marginBottom) || 0;

    return Math.ceil(rect.height + marginTop + marginBottom);
  }

  function notifyHeight() {
    if (!inShellFrame()) {
      return;
    }

    try {
      window.parent.postMessage({
        type: 'ooms:resize',
        height: getContentHeight()
      }, window.location.origin);
    } catch (error) {
      return;
    }
  }

  applyEmbeddedLayout();
  window.addEventListener('load', function () {
    window.requestAnimationFrame(notifyHeight);
  });
  window.addEventListener('resize', function () {
    window.requestAnimationFrame(notifyHeight);
  });

  if (window.ResizeObserver) {
    var observedNode = getPrimaryContentNode();
    var observer = new ResizeObserver(notifyHeight);

    if (observedNode) {
      observer.observe(observedNode);
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
