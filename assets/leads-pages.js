(function () {
  const mount = document.querySelector("[data-leads-page]");

  if (!mount) {
    return;
  }

  const LEADS_CSV = "/data/leads.csv";
  const OPP_CSV = "/data/opportunities.csv";

  // 关闭样本由状态判定（与展示约定一致）
  const CLOSED_STATUSES = ["筛查未通过", "初评未通过", "已放弃"];

  // 线索模版表头 → 数据字段
  const LEAD_HEADERS = {
    "id": "id",
    "线索名称": "name",
    "目标国家/城市": "country",
    "类型": "type",
    "归属BG": "bg",
    "来源": "source",
    "线索描述": "copy",
    "附件": "attach",
    "创建时间": "created",
    "更新时间": "updated",
  };

  // 商机模版表头 → 数据字段（类型复用于类型枚举）
  const OPP_HEADERS = {
    "id": "id",
    "商机名称": "name",
    "目标国家/城市": "country",
    "类型": "type",
    "归属BG": "bg",
    "来源": "source",
    "负责人": "owner",
    "商机评分": "score",
    "商机描述": "copy",
    "附件": "attach",
    "状态": "status",
    "创建时间": "created",
    "更新时间": "updated",
  };

  const statusColor = {
    待认领: "gray",
    已纳入评估: "blue",
    推进中: "green",
    观望中: "orange",
    暂停: "gray",
    已完成: "green",
    筛查未通过: "red",
    初评未通过: "red",
    已放弃: "red",
  };

  const typeColor = {
    供应链整合: "purple",
    "OTA平台": "blue",
    投并购标的: "orange",
    酒店管理: "gray",
    软硬件销售: "teal",
    支付金融: "green",
  };

  const state = {
    data: [],
  };

  if (window.location.protocol === "file:") {
    renderState(
      mount,
      "请通过本地 HTTP 服务打开页面，浏览器在 file:// 模式下不会允许脚本读取数据。",
      true
    );
    return;
  }

  renderState(mount, "正在读取线索与商机数据...");

  loadData()
    .then(function (items) {
      state.data = items;
      render();
    })
    .catch(function (error) {
      renderState(mount, "线索数据加载失败，请检查 /data/ 目录下的 leads.csv / opportunities.csv 与本地服务。", true, error);
    });

  function loadData() {
    return Promise.all([
      fetchCsv(LEADS_CSV),
      fetchCsv(OPP_CSV),
    ]).then(function (results) {
      const leads = mapRows(results[0], LEAD_HEADERS, "线索", true);
      const opps = mapRows(results[1], OPP_HEADERS, null, false);

      return leads.concat(opps);
    });
  }

  function fetchCsv(url) {
    return fetch(url, { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Failed to load " + url + ": " + response.status);
        }

        return response.text();
      })
      .then(parseCsv);
  }

  function parseCsv(text) {
    const normalizedText = text.replace(/^\uFEFF/, "");
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;

    for (let index = 0; index < normalizedText.length; index += 1) {
      const char = normalizedText[index];

      if (inQuotes) {
        if (char === '"') {
          if (normalizedText[index + 1] === '"') {
            cell += '"';
            index += 1;
          } else {
            inQuotes = false;
          }
        } else {
          cell += char;
        }
        continue;
      }

      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        row.push(cell);
        cell = "";
      } else if (char === "\n") {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      } else if (char !== "\r") {
        cell += char;
      }
    }

    if (cell.length > 0 || row.length > 0) {
      row.push(cell);
      rows.push(row);
    }

    const filteredRows = rows.filter(function (currentRow) {
      return currentRow.some(function (value) {
        return value !== "";
      });
    });

    if (filteredRows.length === 0) {
      return [];
    }

    const headers = filteredRows[0];

    return filteredRows.slice(1).map(function (currentRow) {
      const entry = {};

      headers.forEach(function (header, headerIndex) {
        entry[header] = currentRow[headerIndex] || "";
      });

      return entry;
    });
  }

  // 将解析后的行（按表头 key）映射为页面数据对象
  function mapRows(rows, headerMap, fixedCategory, isLead) {
    return rows.map(function (row) {
      const obj = {
        category: fixedCategory || deriveCategory(row),
      };

      Object.keys(headerMap).forEach(function (header) {
        const key = headerMap[header];
        const raw = row[header] != null ? row[header] : "";

        obj[key] = raw;
      });

      if (isLead) {
        obj.status = "待认领";
      }

      return obj;
    });
  }

  function deriveCategory(row) {
    return CLOSED_STATUSES.indexOf(row["状态"]) >= 0 ? "关闭" : "商机";
  }

  function render() {
    const counts = countByCategory(state.data);

    mount.innerHTML = [
      buildPageHead(counts),
      buildMetrics(counts),
      buildColumns(),
      buildTable(),
    ].join("");
  }

  function buildPageHead(counts) {
    const total = state.data.length;
    const meta =
      counts.线索 + " 线索 / " + counts.商机 + " 商机 / " + counts.关闭 + " 关闭";

    return [
      '<div class="page-head">',
      '  <div>',
      '    <div class="page-kicker">模块二 / Leads &amp; Opportunities</div>',
      '    <h1 class="page-title">线索商机管理</h1>',
      '    <p class="page-sub">线索池、推进中的商机以及已关闭样本统一从 /data/leads.csv 与 /data/opportunities.csv 两个模版渲染，页面只读展示，不支持在线编辑。</p>',
      '  </div>',
      '  <div class="head-aside">',
      '    <div class="summary-card">',
      '      <div class="summary-label">当前展示口径</div>',
      '      <div class="summary-value mono">' + escapeHtml(String(total)) + ' 条</div>',
      '      <div class="summary-meta">' + escapeHtml(meta) + '</div>',
      '    </div>',
      '  </div>',
      '</div>',
    ].join("");
  }

  function buildMetrics(counts) {
    const pendingClaim = state.data.filter(function (item) {
      return item.category === "线索" && item.status === "待认领";
    }).length;

    return [
      '<section class="metrics">',
      buildMetricCard("线索总数", String(counts.线索), "purple", "线索池中的机会样本"),
      buildMetricCard("待认领线索", String(pendingClaim), "red", "主要来自市场扫描与展会线索"),
      buildMetricCard("在管商机", String(counts.商机), "green", "推进中、观望中与暂停项目"),
      buildMetricCard("关闭样本", String(counts.关闭), "orange", "包含未通过与主动放弃项目"),
      '</section>',
    ].join("");
  }

  function buildColumns() {
    const groups = [
      { key: "线索", title: "线索池", meta: "用于展示待进入评估流程的机会样本" },
      { key: "商机", title: "在管商机", meta: "保留推进中、观望中与暂停项目的静态信息" },
      { key: "关闭", title: "关闭样本", meta: "用来沉淀未通过或终止项目" },
    ];

    const columns = groups.map(function (group) {
      const items = state.data.filter(function (item) {
        return item.category === group.key;
      });

      const cards = items.length
        ? items.map(buildItemCard).join("")
        : '<div class="empty-note">暂无数据</div>';

      return [
        '<div class="column-card">',
        '  <div class="column-head">',
        '    <div class="column-title">' + escapeHtml(group.title) + '</div>',
        '    <div class="column-meta">' + escapeHtml(group.meta) + '</div>',
        '  </div>',
        '  <div class="column-body">' + cards + '</div>',
        '</div>',
      ].join("");
    });

    return '<section class="columns section">' + columns.join("") + '</section>';
  }

  function buildItemCard(item) {
    const status = statusColor[item.status] || "blue";
    const type = typeColor[item.type] || "gray";

    const meta = [
      '<span class="tag tag-' + escapeHtml(status) + '">' + escapeHtml(item.status) + '</span>',
      '<span class="tag tag-' + escapeHtml(type) + '">' + escapeHtml(item.type) + '</span>',
    ];

    if (item.country) {
      meta.push('<span class="tag tag-blue">' + escapeHtml(item.country) + '</span>');
    }

    if (item.bg) {
      meta.push('<span class="tag tag-gray">' + escapeHtml(item.bg) + '</span>');
    }

    if (item.source) {
      meta.push('<span class="tag tag-teal">来源：' + escapeHtml(item.source) + '</span>');
    }

    return [
      '<div class="item-card">',
      '  <div class="item-card-title">' + escapeHtml(item.name) + '</div>',
      '  <div class="item-card-copy">' + escapeHtml(item.copy || "") + '</div>',
      item.attach ? renderAttachments(item.attach, false) : '',
      '  <div class="item-card-meta">' + meta.join("") + '</div>',
      '</div>',
    ].join("");
  }

  function buildTable() {
    const rows = state.data
      .map(function (item) {
        const dot = statusColor[item.status] || "gray";
        const type = typeColor[item.type] || "gray";
        const status = statusColor[item.status] || "blue";
        const score = renderScore(item.score);
        const subParts = [];

        if (item.source) {
          subParts.push("来源：" + item.source);
        }

        if (item.copy) {
          subParts.push(item.copy);
        }

        return [
          '<tr>',
          '  <td><span class="dot dot-' + escapeHtml(dot) + '"></span></td>',
          '  <td><div class="cell-title">' + escapeHtml(item.name) + '</div><div class="cell-sub">' + escapeHtml(subParts.join(" · ")) + '</div></td>',
          '  <td>' + escapeHtml(item.country || "-") + '</td>',
          '  <td><span class="tag tag-' + escapeHtml(type) + '">' + escapeHtml(item.type || "-") + '</span></td>',
          '  <td><span class="tag tag-' + escapeHtml(status) + '">' + escapeHtml(item.status) + '</span></td>',
          '  <td>' + escapeHtml(item.bg || "-") + '</td>',
          '  <td>' + score + '</td>',
          '  <td>' + escapeHtml(item.owner || "-") + '</td>',
          '  <td class="cell-attach">' + (item.attach ? renderAttachments(item.attach, true) : '-') + '</td>',
          '  <td class="mono" style="color:var(--text-muted);">' + escapeHtml(formatShortDate(item.created)) + '</td>',
          '  <td class="mono" style="color:var(--text-muted);">' + escapeHtml(formatShortDate(item.updated)) + '</td>',
          '</tr>',
        ].join("");
      })
      .join("");

    return [
      '<section class="table-card section">',
      '  <table>',
      '    <thead>',
      '      <tr>',
      '        <th style="width:36px;"></th>',
      '        <th>名称</th>',
      '        <th style="width:90px;">国家</th>',
      '        <th style="width:100px;">类型</th>',
      '        <th style="width:90px;">状态</th>',
      '        <th style="width:90px;">归属BG</th>',
      '        <th style="width:70px;">评分</th>',
      '        <th style="width:80px;">负责人</th>',
      '        <th style="width:170px;">附件</th>',
      '        <th style="width:110px;">创建时间</th>',
      '        <th style="width:110px;">更新时间</th>',
      '      </tr>',
      '    </thead>',
      '    <tbody>' + (rows || '<tr><td colspan="11" class="empty-note">暂无数据</td></tr>') + '</tbody>',
      '  </table>',
      '</section>',
    ].join("");
  }

  function renderScore(value) {
    if (value === "" || value === null || value === undefined) {
      return '<span style="color:var(--text-muted);">-</span>';
    }

    const num = Number(value);

    if (Number.isNaN(num)) {
      return escapeHtml(String(value));
    }

    let cls = "bad";

    if (num >= 3.5) {
      cls = "good";
    } else if (num >= 2.5) {
      cls = "mid";
    }

    return '<span class="score ' + cls + '">' + escapeHtml(String(num)) + '</span>';
  }

  function buildMetricCard(label, value, colorName, subtext) {
    return [
      '<div class="metric-card">',
      '  <div class="metric-label">' + escapeHtml(label) + '</div>',
      '  <div class="metric-value" style="color:var(--' + escapeHtml(colorName) + ');">' + escapeHtml(value) + '</div>',
      '  <div class="metric-sub">' + escapeHtml(subtext) + '</div>',
      '</div>',
    ].join("");
  }

  function countByCategory(items) {
    const counts = { 线索: 0, 商机: 0, 关闭: 0 };

    items.forEach(function (item) {
      if (counts[item.category] === undefined) {
        counts[item.category] = 0;
      }

      counts[item.category] += 1;
    });

    return counts;
  }

  function formatShortDate(value) {
    if (!value || value.length < 10) {
      return value || "-";
    }

    return value.slice(5);
  }

  function renderState(root, message, isError, error) {
    document.title = "OOMS | 线索商机管理";

    root.innerHTML = [
      '<div class="page-state ' + (isError ? 'page-state-error' : '') + '">',
      '  <div class="page-state-title">' + escapeHtml(isError ? '页面未能完成渲染' : '页面准备中') + '</div>',
      '  <div class="page-state-copy">' + escapeHtml(message) + '</div>',
      error ? '  <div class="page-state-detail mono">' + escapeHtml(String(error.message || error)) + '</div>' : '',
      '</div>',
    ].join("");
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // 附件列可填一个或多个链接：换行 / 分号 / 竖线分隔
  function parseAttachments(raw) {
    if (!raw) {
      return [];
    }

    return String(raw)
      .split(/[\r\n;|]+/)
      .map(function (part) { return part.trim(); })
      .filter(function (part) { return part.length > 0; });
  }

  // 仅允许 http/https/ftp 协议，避免 javascript:/data: 等 XSS 注入
  function safeUrl(value) {
    const v = String(value).trim();

    return /^(https?|ftp):\/\//i.test(v) ? v : null;
  }

  function renderAttachments(raw, compact) {
    const items = parseAttachments(raw);

    if (!items.length) {
      return "";
    }

    const links = items.map(function (item) {
      const url = safeUrl(item);

      if (url) {
        const display = item.length > 42 ? item.slice(0, 40) + "…" : item;

        return '<a class="attachment-link" href="' + escapeHtml(url) +
          '" target="_blank" rel="noopener" title="' + escapeHtml(item) +
          '">' + escapeHtml(display) + '</a>';
      }

      // 非 URL 文本按纯文本展示，防止被当作脚本执行
      return '<span class="attach-text">' + escapeHtml(item) + '</span>';
    });

    const body = links.join(compact ? " " : "");
    const label = compact ? "" : '<span class="attach-label">📎 附件</span>';

    return (compact ? "" : '<div class="item-card-attach">') +
      label + body +
      (compact ? "" : '</div>');
  }
})();
