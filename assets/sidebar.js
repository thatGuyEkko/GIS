(function () {
  var STORAGE_KEY = 'ooms-sidebar-collapsed';
  var DEFAULT_ROUTE = 'dashboard';
  var routes = {
    dashboard: {
      page: 'dashboard.html',
      title: '商机看板'
    },
    travel: {
      page: 'global-travel-intel.html',
      title: '全球化旅业信息看板'
    },
    leads: {
      page: 'leads.html',
      title: '线索商机管理'
    },
    eval: {
      page: 'eval.html',
      title: '商机评估管理'
    },
    bp: {
      page: 'bp.html',
      title: '商业BP管理'
    }
  };
  var shell = document.querySelector('.app-shell[data-shell="main"]');

  if (!shell) {
    return;
  }

  var sidebar = shell.querySelector('.sidebar');
  var frame = document.querySelector('[data-content-frame]');
  var navItems = Array.prototype.slice.call(shell.querySelectorAll('.nav-item[data-route]'));
  var currentFrameUrl = '';

  if (!sidebar || !frame || !navItems.length) {
    return;
  }

  function getStoredState() {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === '1';
    } catch (error) {
      return false;
    }
  }

  function setStoredState(collapsed) {
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
    } catch (error) {
      return;
    }
  }

  function labelFromText(text) {
    var value = (text || '').replace(/\s+/g, ' ').trim();

    if (!value) {
      return 'NA';
    }

    if (/^[A-Za-z0-9\s]+$/.test(value)) {
      return value.slice(0, 2).toUpperCase();
    }

    return value.slice(0, 2);
  }

  function shortLabelFromText(text) {
    var value = (text || '').replace(/\s+/g, ' ').trim();

    if (!value) {
      return 'NA';
    }

    var map = {
      '商机看板': '看板',
      '全球化旅业信息看板': '旅业',
      '线索商机管理': '线索',
      '商机评估管理': '评估',
      '商业BP管理': 'BP'
    };

    return map[value] || labelFromText(value);
  }

  function updateToggle(button, collapsed) {
    button.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    button.setAttribute('aria-label', collapsed ? '展开导航栏' : '折叠导航栏');
    button.title = collapsed ? '展开导航栏' : '折叠导航栏';
    button.querySelector('.sidebar-toggle-icon').textContent = collapsed ? '>' : '<';
  }

  function updateNav(route) {
    navItems.forEach(function (item) {
      item.classList.toggle('active', item.dataset.route === route);
    });
  }

  function buildFrameUrl(route, detailCode) {
    var config = routes[route] || routes[DEFAULT_ROUTE];

    if (route === 'bp' && detailCode) {
      return 'bp-details/index.html?bp_code=' + encodeURIComponent(detailCode);
    }

    return config.page;
  }

  function updateDocumentTitle(route, detailCode) {
    var pageTitle = (routes[route] || routes[DEFAULT_ROUTE]).title;

    if (route === 'bp' && detailCode) {
      pageTitle += ' / ' + detailCode;
    }

    document.title = 'OOMS | ' + pageTitle;
  }

  function syncHistory(route, detailCode, replace) {
    var url = new URL(window.location.href);
    url.searchParams.set('page', route);

    if (route === 'bp' && detailCode) {
      url.searchParams.set('bp_code', detailCode);
    } else {
      url.searchParams.delete('bp_code');
    }

    if (replace) {
      window.history.replaceState({ route: route, bpCode: detailCode || '' }, '', url.toString());
    } else {
      window.history.pushState({ route: route, bpCode: detailCode || '' }, '', url.toString());
    }
  }

  function setFrameHeight(nextHeight) {
    var height = Number(nextHeight);
    var minViewportHeight = Math.max(window.innerHeight || 0, 320);

    if (!Number.isFinite(height) || height <= 0) {
      try {
        var doc = frame.contentWindow && frame.contentWindow.document;
        if (!doc) {
          return;
        }

        var main = doc.querySelector('main');
        if (main) {
          height = Math.ceil(main.getBoundingClientRect().height);
        } else if (doc.body) {
          height = Math.ceil(doc.body.getBoundingClientRect().height);
        }
      } catch (error) {
        return;
      }
    }

    frame.style.height = Math.max(Math.ceil(height), minViewportHeight) + 'px';
  }

  function renderRoute(route, detailCode, options) {
    var targetRoute = routes[route] ? route : DEFAULT_ROUTE;
    var targetCode = targetRoute === 'bp' ? (detailCode || '') : '';
    var nextUrl = buildFrameUrl(targetRoute, targetCode);
    var replace = !!(options && options.replace);
    var skipHistory = !!(options && options.skipHistory);

    updateNav(targetRoute);
    updateDocumentTitle(targetRoute, targetCode);

    if (!skipHistory) {
      syncHistory(targetRoute, targetCode, replace);
    }

    if (currentFrameUrl !== nextUrl) {
      if (frame.contentWindow && frame.contentWindow.location && currentFrameUrl) {
        frame.contentWindow.location.replace(nextUrl);
      } else {
        frame.setAttribute('src', nextUrl);
      }

      currentFrameUrl = nextUrl;
      frame.dataset.currentSrc = nextUrl;
    }
  }

  navItems.forEach(function (item) {
    var titleNode = item.querySelector('.nav-title');
    var titleText = titleNode ? titleNode.textContent : item.textContent;
    item.dataset.shortLabel = shortLabelFromText(titleText);
    item.title = (titleText || '').replace(/\s+/g, ' ').trim();
    item.setAttribute('href', '?page=' + encodeURIComponent(item.dataset.route));

    item.addEventListener('click', function (event) {
      event.preventDefault();
      renderRoute(item.dataset.route, '', { replace: false });
    });
  });

  var button = document.createElement('button');
  button.type = 'button';
  button.className = 'sidebar-toggle';
  button.innerHTML = '<span class="sidebar-toggle-icon" aria-hidden="true"></span>';

  var collapsed = getStoredState() && window.innerWidth > 960;
  if (collapsed) {
    shell.classList.add('sidebar-collapsed');
  }
  updateToggle(button, collapsed);

  button.addEventListener('click', function () {
    if (window.innerWidth <= 960) {
      return;
    }

    collapsed = shell.classList.toggle('sidebar-collapsed');
    setStoredState(collapsed);
    updateToggle(button, collapsed);
  });

  window.addEventListener('resize', function () {
    if (window.innerWidth <= 960) {
      shell.classList.remove('sidebar-collapsed');
      updateToggle(button, false);
      setFrameHeight();
      return;
    }

    collapsed = getStoredState();
    shell.classList.toggle('sidebar-collapsed', collapsed);
    updateToggle(button, collapsed);
    setFrameHeight();
  });

  frame.addEventListener('load', function () {
    try {
      currentFrameUrl = frame.contentWindow && frame.contentWindow.location
        ? frame.contentWindow.location.pathname.replace(/^\//, '') + frame.contentWindow.location.search
        : frame.getAttribute('src') || currentFrameUrl;
    } catch (error) {
      currentFrameUrl = frame.getAttribute('src') || currentFrameUrl;
    }

    frame.dataset.currentSrc = currentFrameUrl;

    setFrameHeight();
  });

  window.addEventListener('message', function (event) {
    if (event.origin !== window.location.origin || !event.data || typeof event.data !== 'object') {
      return;
    }

    if (event.data.type === 'ooms:navigate') {
      renderRoute(event.data.route || DEFAULT_ROUTE, event.data.bpCode || '', { replace: false });
      return;
    }

    if (event.data.type === 'ooms:resize') {
      setFrameHeight(event.data.height);
    }
  });

  window.addEventListener('popstate', function () {
    var params = new URL(window.location.href).searchParams;
    var route = params.get('page') || DEFAULT_ROUTE;
    var detailCode = params.get('bp_code') || '';
    renderRoute(route, detailCode, { skipHistory: true, replace: true });
  });

  sidebar.appendChild(button);

  var params = new URL(window.location.href).searchParams;
  var initialRoute = params.get('page') || DEFAULT_ROUTE;
  var initialDetailCode = params.get('bp_code') || '';
  renderRoute(initialRoute, initialDetailCode, { replace: true });
})();
