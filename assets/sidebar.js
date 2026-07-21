(function () {
  var STORAGE_KEY = 'ooms-sidebar-collapsed';
  var shells = document.querySelectorAll('.app-shell');

  if (!shells.length) {
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

  shells.forEach(function (shell) {
    var sidebar = shell.querySelector('.sidebar');

    if (!sidebar) {
      return;
    }

    sidebar.querySelectorAll('.nav-item').forEach(function (item) {
      var title = item.querySelector('.nav-title');
      var titleText = title ? title.textContent : item.textContent;
      item.dataset.shortLabel = shortLabelFromText(titleText);
      item.title = (titleText || '').replace(/\s+/g, ' ').trim();
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
        return;
      }

      collapsed = getStoredState();
      shell.classList.toggle('sidebar-collapsed', collapsed);
      updateToggle(button, collapsed);
    });

    sidebar.appendChild(button);
  });
})();
