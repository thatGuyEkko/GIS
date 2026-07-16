(function () {
  const pageRoot = document.querySelector("[data-bp-page]");

  if (!pageRoot) {
    return;
  }

  const pageType = pageRoot.dataset.bpPage;
  const bpCode = resolveBpCode(pageRoot);
  const dataPrefix = pageType === "detail" ? "../data" : "data";
  const tagPalette = ["blue", "purple", "teal", "green", "orange", "gray"];
  const groupLabels = {
    related_opportunity: "关联商机",
    bg: "涉及配合BG",
    main_product: "主营产品",
    market_type: "市场类型",
    core_customer: "核心客群",
  };
  const groupOrder = [
    "related_opportunity",
    "bg",
    "main_product",
    "market_type",
    "core_customer",
  ];

  if (window.location.protocol === "file:") {
    renderState(
      pageRoot,
      "请通过本地 HTTP 服务打开页面，浏览器在 file:// 模式下不会允许脚本读取 CSV 数据。",
      true
    );
    return;
  }

  renderState(pageRoot, "正在读取 BP 数据...");

  Promise.all([
    loadCsv(dataPrefix + "/bp_main.csv"),
    loadCsv(dataPrefix + "/bp_tag.csv"),
    loadCsv(dataPrefix + "/bp_stage.csv"),
    loadCsv(dataPrefix + "/bp_attachment.csv"),
  ])
    .then(function (results) {
      const store = buildStore(results[0], results[1], results[2], results[3]);

      if (pageType === "list") {
        renderListPage(pageRoot, store);
        return;
      }

      renderDetailPage(pageRoot, store, bpCode);
    })
    .catch(function (error) {
      renderState(pageRoot, "BP 数据加载失败，请检查 data 目录和本地服务。", true, error);
    });

  function loadCsv(url) {
    return fetch(url).then(function (response) {
      if (!response.ok) {
        throw new Error("Failed to load " + url + ": " + response.status);
      }

      return response.text();
    }).then(parseCsv);
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

  function buildStore(mainRows, tagRows, stageRows, attachmentRows) {
    const mains = mainRows
      .map(function (row) {
        return {
          bp_code: row.bp_code,
          bp_title: row.bp_title,
          list_summary: row.list_summary,
          detail_summary: row.detail_summary,
          status_display: row.status_display,
          currency_code: row.currency_code,
          owner_name: row.owner_name,
          submitted_date: row.submitted_date,
          updated_date: row.updated_date,
          product_positioning: row.product_positioning,
          execution_plan_summary: row.execution_plan_summary,
          acquisition_summary: row.acquisition_summary,
          supply_chain_summary: row.supply_chain_summary,
        };
      })
      .sort(function (left, right) {
        return left.bp_code.localeCompare(right.bp_code, "zh-CN");
      });

    const mainsByCode = new Map();
    mains.forEach(function (item) {
      mainsByCode.set(item.bp_code, item);
    });

    const tagsByCode = new Map();
    tagRows.forEach(function (row) {
      const code = row.bp_code;
      const group = row.tag_group;
      const entry = ensureNestedGroup(tagsByCode, code, group);

      entry.push({
        value: row.tag_value,
        order: toNumber(row.display_order),
      });
    });

    tagsByCode.forEach(function (groupMap) {
      Object.keys(groupMap).forEach(function (group) {
        groupMap[group] = groupMap[group]
          .sort(function (left, right) {
            return left.order - right.order;
          })
          .map(function (item) {
            return item.value;
          });
      });
    });

    const stagesByCode = new Map();
    stageRows.forEach(function (row) {
      const code = row.bp_code;

      if (!stagesByCode.has(code)) {
        stagesByCode.set(code, []);
      }

      stagesByCode.get(code).push({
        bp_code: code,
        display_order: toNumber(row.display_order),
        stage_name: row.stage_name,
        stage_topic: row.stage_topic,
        stage_summary: row.stage_summary,
        period_start_date: row.period_start_date,
        period_end_date: row.period_end_date,
        fixed_investment_amount: toNumber(row.fixed_investment_amount),
        sales_investment_amount: toNumber(row.sales_investment_amount),
        expected_gmv_amount: toNumber(row.expected_gmv_amount),
        expected_profit_amount: toNumber(row.expected_profit_amount),
        cumulative_cashflow_amount: toNumber(row.cumulative_cashflow_amount),
        sales_cost_positive_flag: String(row.sales_cost_positive_flag).toLowerCase() === "true",
      });
    });

    stagesByCode.forEach(function (stages) {
      stages.sort(function (left, right) {
        return left.display_order - right.display_order;
      });
    });

    const attachmentsByCode = new Map();
    attachmentRows.forEach(function (row) {
      const code = row.bp_code;

      if (!attachmentsByCode.has(code)) {
        attachmentsByCode.set(code, []);
      }

      attachmentsByCode.get(code).push({
        display_order: toNumber(row.display_order),
        attachment_name: row.attachment_name,
        attachment_url: row.attachment_url,
      });
    });

    attachmentsByCode.forEach(function (attachments) {
      attachments.sort(function (left, right) {
        return left.display_order - right.display_order;
      });
    });

    return {
      mains: mains,
      mainsByCode: mainsByCode,
      tagsByCode: tagsByCode,
      stagesByCode: stagesByCode,
      attachmentsByCode: attachmentsByCode,
    };
  }

  function ensureNestedGroup(map, key, group) {
    if (!map.has(key)) {
      map.set(key, {});
    }

    const groups = map.get(key);

    if (!groups[group]) {
      groups[group] = [];
    }

    return groups[group];
  }

  function renderListPage(root, store) {
    const statusCounts = countByStatus(store.mains);
    const statusSummary = buildStatusSummary(statusCounts);
    const uniqueOpportunityCount = countDistinctTags(store.tagsByCode, "related_opportunity");
    const uniqueBgCount = countDistinctTags(store.tagsByCode, "bg");
    const uniqueMarketCount = countDistinctTags(store.tagsByCode, "market_type");

    document.title = "OOMS | 商业BP管理";

    root.innerHTML = [
      '<div class="page-head">',
      '  <div>',
      '    <div class="page-kicker">模块四 / Business Plan</div>',
      '    <h1 class="page-title">商业BP管理</h1>',
      '    <p class="page-sub">BP 台账、项目概要、阶段财务与附件统一按 data 目录中的 CSV 数据渲染，详情页不再维护独立静态内容。</p>',
      '  </div>',
      '  <div class="head-aside">',
      '    <div class="summary-card">',
      '      <div class="summary-label">当前 BP 台账</div>',
      '      <div class="summary-value mono">' + escapeHtml(String(store.mains.length)) + ' 份</div>',
      '      <div class="summary-meta">' + escapeHtml(statusSummary) + '</div>',
      '    </div>',
      '  </div>',
      '</div>',
      '<section class="metrics">',
      buildMetricCard("BP总数", String(store.mains.length), "purple", "来自 bp_main 主表记录数"),
      buildMetricCard("关联商机", String(uniqueOpportunityCount) + " 个", "blue", "bp_tag 中 related_opportunity 去重数量"),
      buildMetricCard("协同BG", String(uniqueBgCount) + " 类", "green", "bp_tag 中 bg 去重数量"),
      buildMetricCard("市场类型", String(uniqueMarketCount) + " 类", "orange", "bp_tag 中 market_type 去重数量"),
      '</section>',
      '<section class="table-card section">',
      '  <table class="wide-table-lg">',
      '    <thead>',
      '      <tr>',
      '        <th style="width:120px;">BP编号</th>',
      '        <th style="width:300px;">BP标题</th>',
      '        <th style="width:260px;">关联商机</th>',
      '        <th style="width:220px;">涉及配合的BG</th>',
      '        <th style="width:220px;">主营产品</th>',
      '        <th style="width:120px;">市场类型</th>',
      '        <th style="width:90px;">状态</th>',
      '        <th style="width:80px;">负责人</th>',
      '        <th style="width:90px;">提交时间</th>',
      '        <th style="width:90px;">更新时间</th>',
      '      </tr>',
      '    </thead>',
      '    <tbody>',
      store.mains.map(function (item) {
        const tags = store.tagsByCode.get(item.bp_code) || {};
        const detailPath = "bp-details/index.html?bp_code=" + encodeURIComponent(item.bp_code);

        return [
          '<tr>',
          '  <td class="mono">' + escapeHtml(item.bp_code) + '</td>',
          '  <td>',
          '    <div class="cell-title"><a class="detail-link" href="' + escapeHtml(detailPath) + '">' + escapeHtml(item.bp_title) + '</a></div>',
          '    <div class="cell-sub">' + escapeHtml(item.list_summary) + '</div>',
          '  </td>',
          '  <td>' + renderTagGroup(tags.related_opportunity || []) + '</td>',
          '  <td>' + renderTagGroup(tags.bg || []) + '</td>',
          '  <td>' + renderTagGroup(tags.main_product || []) + '</td>',
          '  <td>' + renderTagGroup(tags.market_type || [], ["orange"]) + '</td>',
          '  <td>' + renderStatusTag(item.status_display) + '</td>',
          '  <td>' + escapeHtml(item.owner_name) + '</td>',
          '  <td class="mono" style="color:var(--text-muted);">' + escapeHtml(formatShortDate(item.submitted_date)) + '</td>',
          '  <td class="mono" style="color:var(--text-muted);">' + escapeHtml(formatShortDate(item.updated_date)) + '</td>',
          '</tr>'
        ].join("");
      }).join(""),
      '    </tbody>',
      '  </table>',
      '</section>'
    ].join("");
  }

  function renderDetailPage(root, store, code) {
    const main = store.mainsByCode.get(code);

    if (!main) {
      document.title = "OOMS | BP详情";
      renderState(root, "未找到对应的 BP 数据记录。", true);
      return;
    }

    const tags = store.tagsByCode.get(code) || {};
    const stages = store.stagesByCode.get(code) || [];
    const attachments = store.attachmentsByCode.get(code) || [];
    const totals = summarizeStages(stages);
    const salesPositiveStage = stages.find(function (stage) {
      return stage.sales_cost_positive_flag;
    });
    const cashPositiveStage = stages.find(function (stage) {
      return stage.cumulative_cashflow_amount >= 0;
    });

    document.title = "OOMS | " + main.bp_code;

    root.innerHTML = [
      '<a class="back-link" href="../bp.html">返回 BP 台账</a>',
      '<div class="page-head">',
      '  <div>',
      '    <div class="page-kicker">BP详情 / ' + escapeHtml(main.bp_code) + '</div>',
      '    <h1 class="page-title">' + escapeHtml(main.bp_title) + '</h1>',
      '    <p class="page-sub">' + escapeHtml(main.detail_summary) + '</p>',
      '    <div class="page-meta">',
      '      ' + renderStatusTag(main.status_display),
      '      <span class="currency-badge">币种 ' + escapeHtml(main.currency_code) + '</span>',
      '    </div>',
      '  </div>',
      '  <div class="head-aside">',
      '    <div class="summary-card summary-stack">',
      '      <div>',
      '        <div class="summary-label">负责人</div>',
      '        <div class="summary-strong">' + escapeHtml(main.owner_name) + '</div>',
      '      </div>',
      '      <div>',
      '        <div class="summary-key">提交 / 更新</div>',
      '        <div class="summary-meta">' + escapeHtml(formatShortDate(main.submitted_date) + ' / ' + formatShortDate(main.updated_date)) + '</div>',
      '      </div>',
      '      <div>',
      '        <div class="summary-key">附件数量</div>',
      '        <div class="summary-meta mono">' + escapeHtml(String(attachments.length)) + ' 份</div>',
      '      </div>',
      '    </div>',
      '  </div>',
      '</div>',
      '<section class="metrics metrics-5">',
      buildMetricCard("整个BP的GMV", formatAmount(totals.totalGmv), "purple", "按 bp_stage 的 expected_gmv_amount 汇总"),
      buildMetricCard("整个BP的资金投入", formatAmount(totals.totalInvestment), "blue", "固定资金投入与销售投入合计"),
      buildMetricCard("整个BP的ROI", formatRatio(totals.overallRoi), "green", "累计预计利润 / -(累计销售投入 + 累计固定资金投入)"),
      buildMetricCard("销售成本打正周期", formatStageMilestone(salesPositiveStage), "orange", salesPositiveStage ? ("截至 " + salesPositiveStage.period_end_date + " 首次打正") : "当前阶段数据中尚未打正"),
      buildMetricCard("累计现金流打正周期", formatStageMilestone(cashPositiveStage), "teal", cashPositiveStage ? ("截至 " + cashPositiveStage.period_end_date + " 累计现金流转正") : "当前阶段数据中尚未转正"),
      '</section>',
      '<section class="info-panel section">',
      '  <div class="panel-title">项目概要</div>',
      '  <div class="kv-grid kv-grid-5">',
      groupOrder.map(function (groupKey) {
        return [
          '<div class="kv-item">',
          '  <div class="kv-label">' + escapeHtml(groupLabels[groupKey]) + '</div>',
          '  <div class="kv-value">' + renderTagGroup(tags[groupKey] || [], groupKey === "market_type" ? ["orange"] : null) + '</div>',
          '</div>'
        ].join("");
      }).join(""),
      '  </div>',
      '</section>',
      '<section class="info-panel section">',
      '  <div class="panel-title">执行摘要</div>',
      '  <div class="kv-grid">',
      buildKvItem("产品定位", main.product_positioning),
      buildKvItem("执行计划简述", main.execution_plan_summary),
      buildKvItem("获客方法简介", main.acquisition_summary),
      buildKvItem("供应链发展简介", main.supply_chain_summary),
      '  </div>',
      '</section>',
      '<section class="table-card section">',
      '  <div class="table-title-card">',
      '    <div class="section-title">阶段划分</div>',
      '    <div class="section-sub">页面顶部 GMV、投入、ROI 与打正节点全部从 bp_stage.csv 计算。</div>',
      '  </div>',
      '  <table class="wide-table-xl">',
      '    <thead>',
      '      <tr>',
      '        <th style="width:120px;">阶段名称</th>',
      '        <th style="width:220px;">阶段主题</th>',
      '        <th style="width:280px;">阶段简要说明</th>',
      '        <th style="width:180px;">期间启止日期</th>',
      '        <th style="width:120px;">固定资金投入</th>',
      '        <th style="width:120px;">销售投入</th>',
      '        <th style="width:140px;">预计销售额GMV</th>',
      '        <th style="width:120px;">预计利润</th>',
      '        <th style="width:90px;">ROI</th>',
      '        <th style="width:120px;">累计现金流</th>',
      '        <th style="width:120px;">销售成本打正</th>',
      '      </tr>',
      '    </thead>',
      '    <tbody>',
      (stages.length ? stages : []).map(function (stage) {
        const stageRoi = calculateStageRoi(stage);

        return [
          '<tr>',
          '  <td>' + escapeHtml(stage.stage_name) + '</td>',
          '  <td>' + escapeHtml(stage.stage_topic) + '</td>',
          '  <td>' + escapeHtml(stage.stage_summary) + '</td>',
          '  <td class="mono">' + escapeHtml(stage.period_start_date + ' 至 ' + stage.period_end_date) + '</td>',
          '  <td class="mono ' + escapeHtml(getSignedAmountClass(stage.fixed_investment_amount)) + '">' + escapeHtml(formatAmount(stage.fixed_investment_amount)) + '</td>',
          '  <td class="mono ' + escapeHtml(getSignedAmountClass(stage.sales_investment_amount)) + '">' + escapeHtml(formatAmount(stage.sales_investment_amount)) + '</td>',
          '  <td class="mono">' + escapeHtml(formatAmount(stage.expected_gmv_amount)) + '</td>',
          '  <td class="mono">' + escapeHtml(formatAmount(stage.expected_profit_amount)) + '</td>',
          '  <td>' + escapeHtml(formatPercentValue(stageRoi)) + '</td>',
          '  <td class="mono">' + escapeHtml(formatAmount(stage.cumulative_cashflow_amount)) + '</td>',
          '  <td>' + renderBooleanTag(stage.sales_cost_positive_flag) + '</td>',
          '</tr>'
        ].join("");
      }).join("") || '<tr><td colspan="11" class="empty-note">暂无阶段数据</td></tr>',
      '    </tbody>',
      '  </table>',
      '</section>',
      '<section class="info-panel section">',
      '  <div class="panel-title">相关附件</div>',
      '  <div class="list-block">',
      (attachments.length ? attachments : []).map(function (attachment) {
        const safeUrl = sanitizeUrl(attachment.attachment_url);

        return [
          '<div class="list-item">',
          '  <div class="list-item-head">',
          '    <div class="list-item-title">' + escapeHtml(attachment.attachment_name) + '</div>',
          '    <div class="list-item-meta mono">附件 ' + escapeHtml(String(attachment.display_order)) + '</div>',
          '  </div>',
          '  <div class="list-item-copy"><a class="attachment-link" href="' + escapeHtml(safeUrl) + '" target="_blank" rel="noreferrer">' + escapeHtml(attachment.attachment_url) + '</a></div>',
          '</div>'
        ].join("");
      }).join("") || '<div class="empty-note">暂无附件数据</div>',
      '  </div>',
      '</section>'
    ].join("");
  }

  function resolveBpCode(root) {
    if (pageType !== "detail") {
      return root.dataset.bpCode || "";
    }

    try {
      const url = new URL(window.location.href);
      const searchCode = (url.searchParams.get("bp_code") || "").trim();

      if (searchCode) {
        return searchCode.toUpperCase();
      }
    } catch (error) {
      return root.dataset.bpCode || "";
    }

    return root.dataset.bpCode || "";
  }

  function summarizeStages(stages) {
    const totalGmv = stages.reduce(function (sum, stage) {
      return sum + stage.expected_gmv_amount;
    }, 0);
    const totalInvestment = stages.reduce(function (sum, stage) {
      return sum + stage.fixed_investment_amount + stage.sales_investment_amount;
    }, 0);
    const totalProfit = stages.reduce(function (sum, stage) {
      return sum + stage.expected_profit_amount;
    }, 0);

    return {
      totalGmv: totalGmv,
      totalInvestment: totalInvestment,
      totalProfit: totalProfit,
      overallRoi: totalInvestment === 0 ? null : totalProfit / -totalInvestment,
    };
  }

  function calculateStageRoi(stage) {
    const totalCost = stage.sales_investment_amount + stage.fixed_investment_amount;

    if (totalCost === 0) {
      return null;
    }

    return (stage.expected_profit_amount / -totalCost) * 100;
  }

  function countByStatus(items) {
    const counts = {};

    items.forEach(function (item) {
      counts[item.status_display] = (counts[item.status_display] || 0) + 1;
    });

    return counts;
  }

  function buildStatusSummary(counts) {
    const orderedStatuses = ["已通过", "审批中", "草稿"];
    const knownStatuses = new Set(orderedStatuses);
    const extraStatuses = Object.keys(counts).filter(function (status) {
      return !knownStatuses.has(status);
    }).sort(function (left, right) {
      return left.localeCompare(right, "zh-CN");
    });

    return orderedStatuses.concat(extraStatuses)
      .filter(function (status) {
        return counts[status];
      })
      .map(function (status) {
        return counts[status] + " 份" + status;
      })
      .join("，");
  }

  function countDistinctTags(tagsByCode, groupName) {
    const values = new Set();

    tagsByCode.forEach(function (groups) {
      (groups[groupName] || []).forEach(function (value) {
        values.add(value);
      });
    });

    return values.size;
  }

  function buildMetricCard(label, value, colorName, subtext) {
    return [
      '<div class="metric-card">',
      '  <div class="metric-label">' + escapeHtml(label) + '</div>',
      '  <div class="metric-value" style="color:var(--' + escapeHtml(colorName) + ');">' + escapeHtml(value) + '</div>',
      '  <div class="metric-sub">' + escapeHtml(subtext) + '</div>',
      '</div>'
    ].join("");
  }

  function buildKvItem(label, value) {
    return [
      '<div class="kv-item">',
      '  <div class="kv-label">' + escapeHtml(label) + '</div>',
      '  <div class="kv-value">' + escapeHtml(value) + '</div>',
      '</div>'
    ].join("");
  }

  function renderTagGroup(values, palette) {
    if (!values || values.length === 0) {
      return '<span class="empty-note">-</span>';
    }

    const colors = palette && palette.length ? palette : tagPalette;

    return [
      '<div class="tag-row">',
      values.map(function (value, index) {
        const color = colors[index % colors.length];

        return '<span class="tag tag-' + escapeHtml(color) + '">' + escapeHtml(value) + '</span>';
      }).join(""),
      '</div>'
    ].join("");
  }

  function renderStatusTag(status) {
    const colorMap = {
      已通过: "green",
      审批中: "orange",
      草稿: "gray",
      未通过: "red",
      已驳回: "red",
    };
    const color = colorMap[status] || "blue";

    return '<span class="tag tag-' + escapeHtml(color) + '">' + escapeHtml(status) + '</span>';
  }

  function renderBooleanTag(flag) {
    return flag
      ? '<span class="tag tag-green">是</span>'
      : '<span class="tag tag-gray">否</span>';
  }

  function formatShortDate(value) {
    if (!value || value.length < 10) {
      return value || "-";
    }

    return value.slice(5);
  }

  function formatAmount(value) {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return "-";
    }

    const sign = value < 0 ? "-" : "";
    const absolute = Math.abs(value);

    if (absolute >= 100000000) {
      return sign + trimDecimal(absolute / 100000000) + "亿";
    }

    if (absolute >= 10000) {
      return sign + trimDecimal(absolute / 10000) + "万";
    }

    return sign + String(absolute);
  }

  function formatRatio(value) {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return "-";
    }

    return formatPercentValue(value * 100);
  }

  function getSignedAmountClass(value) {
    if (value > 0) {
      return "amount-positive";
    }

    if (value < 0) {
      return "amount-negative";
    }

    return "amount-neutral";
  }

  function formatPercentValue(value) {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return "-";
    }

    const rounded = Math.round(value * 10) / 10;

    if (Math.abs(rounded - Math.round(rounded)) < 0.05) {
      return String(Math.round(rounded)) + "%";
    }

    return rounded.toFixed(1).replace(/\.0$/, "") + "%";
  }

  function formatStageMilestone(stage) {
    return stage ? stage.stage_name + "期末" : "未打正";
  }

  function trimDecimal(value) {
    if (value >= 100) {
      return String(Math.round(value));
    }

    if (value >= 10) {
      return value.toFixed(1).replace(/\.0$/, "");
    }

    return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  }

  function sanitizeUrl(url) {
    try {
      const parsed = new URL(url, window.location.href);

      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.href;
      }
    } catch (error) {
      return "#";
    }

    return "#";
  }

  function renderState(root, message, isError, error) {
    document.title = pageType === "detail" ? "OOMS | BP详情" : "OOMS | 商业BP管理";

    root.innerHTML = [
      '<div class="page-state ' + (isError ? 'page-state-error' : '') + '">',
      '  <div class="page-state-title">' + escapeHtml(isError ? '页面未能完成渲染' : '页面准备中') + '</div>',
      '  <div class="page-state-copy">' + escapeHtml(message) + '</div>',
      error ? '  <div class="page-state-detail mono">' + escapeHtml(String(error.message || error)) + '</div>' : '',
      '</div>'
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

  function toNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }
})();
