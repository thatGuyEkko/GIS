(function () {
  "use strict";

  var pageRoot = document.querySelector("[data-channel-hub-page]");
  var hasBoundEvents = false;
  var regionDisplayNames = typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function"
    ? new Intl.DisplayNames(["zh-Hans"], { type: "region" })
    : null;
  var localeCompareOptions = { numeric: true, sensitivity: "base" };
  var languageNames = {
    ar: "阿拉伯语",
    de: "德语",
    en: "英语",
    es: "西班牙语",
    fr: "法语",
    id: "印尼语",
    ja: "日语",
    ko: "韩语",
    ms: "马来语",
    th: "泰语",
    vi: "越南语",
    zh: "中文"
  };
  var channelTypeOptions = ["全部", "销售渠道", "供应渠道", "双侧渠道"];
  var contactRoleOptions = ["全部", "销售对接", "供应对接"];
  var productOrder = [
    "机票",
    "酒店",
    "民宿",
    "玩乐门票",
    "游轮",
    "度假旅游(团游)",
    "租车/接送机",
    "签证/保险",
    "商旅解决方案",
    "系统解决方案"
  ];
  var bizTypeOrder = ["B2B", "B2C", "B2B2C", "系统解决方案"];
  var apiMethodOrder = ["API", "商家后台", "线下"];
  var sortOptions = [
    { value: "name", label: "按渠道名称" },
    { value: "contacts", label: "按联系人数量" },
    { value: "coverage", label: "按覆盖区域数" },
    { value: "dual", label: "双侧渠道优先" }
  ];
  var quickPresets = [
    { key: "all", label: "全部渠道", filters: {} },
    { key: "hotel_supply", label: "酒店供采", filters: { channelType: "供应渠道", product: "酒店" } },
    { key: "flight_distribution", label: "机票分销", filters: { product: "机票" } },
    { key: "activity", label: "玩乐渠道", filters: { product: "玩乐门票" } },
    { key: "tmc", label: "商旅方案", filters: { product: "商旅解决方案" } },
    { key: "api", label: "API 优先", filters: { apiMethod: "API" } }
  ];

  var store = null;
  var state = getDefaultState();

  if (!pageRoot) {
    return;
  }

  if (window.location.protocol === "file:") {
    renderState(
      "请通过本地 HTTP 服务打开页面，浏览器在 file:// 模式下不会允许脚本读取数据文件。",
      true
    );
    return;
  }

  bindEvents();
  renderState("正在读取全球渠道信息与联系人数据...");

  var dataPrefix = (function () {
    var script = document.currentScript;

    if (!script || !script.src) {
      var allScripts = document.getElementsByTagName("script");

      for (var index = allScripts.length - 1; index >= 0; index -= 1) {
        if (/global-channel-hub\.js/.test(allScripts[index].src)) {
          script = allScripts[index];
          break;
        }
      }
    }

    var src = script && script.src ? script.src : "";
    return src.replace(/assets\/[^/]*$/, "") + "data/";
  })();

  Promise.all([
    loadCsv(dataPrefix + "channel_main.csv"),
    loadCsv(dataPrefix + "channel_sales_info.csv"),
    loadCsv(dataPrefix + "channel_supply_info.csv"),
    loadCsv(dataPrefix + "contacts.csv")
  ])
    .then(function (results) {
      store = buildStore(results[0], results[1], results[2], results[3]);
      syncPresetFromState();
      renderPage();
    })
    .catch(function (error) {
      renderState(
        "渠道信息加载失败，请检查 data/channel_main.csv、data/channel_sales_info.csv、data/channel_supply_info.csv 与 data/contacts.csv。",
        true,
        error
      );
    });

  function getDefaultState() {
    return {
      keyword: "",
      channelType: "全部",
      region: "全部",
      product: "全部",
      bizType: "全部",
      apiMethod: "全部",
      language: "全部",
      contactRole: "全部",
      sort: "name",
      selectedChannelId: null,
      activePreset: "all",
      isDetailOpen: false
    };
  }

  function bindEvents() {
    if (hasBoundEvents) {
      return;
    }

    hasBoundEvents = true;

    pageRoot.addEventListener("input", handleFilterChange);
    pageRoot.addEventListener("change", handleFilterChange);

    pageRoot.addEventListener("click", function (event) {
      var resetButton = event.target.closest("[data-channel-reset]");
      if (resetButton) {
        event.preventDefault();
        state = getDefaultState();
        syncPresetFromState();
        renderPage();
        return;
      }

      var presetButton = event.target.closest("[data-channel-preset]");
      if (presetButton) {
        event.preventDefault();
        applyPreset(presetButton.getAttribute("data-channel-preset") || "all");
        renderPage();
        return;
      }

      var closeButton = event.target.closest("[data-channel-modal-close]");
      if (closeButton) {
        event.preventDefault();
        state.isDetailOpen = false;
        renderPage();
        return;
      }

      if (
        event.target
        && typeof event.target.getAttribute === "function"
        && event.target.getAttribute("data-channel-modal-backdrop") === "true"
      ) {
        state.isDetailOpen = false;
        renderPage();
        return;
      }

      if (event.target.closest("a")) {
        return;
      }

      var row = event.target.closest("tr[data-channel-row]");
      if (!row) {
        return;
      }

      state.selectedChannelId = row.getAttribute("data-channel-row") || null;
      state.isDetailOpen = true;
      renderPage();
    });

    pageRoot.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && state.isDetailOpen) {
        state.isDetailOpen = false;
        renderPage();
        return;
      }

      var row = event.target.closest("tr[data-channel-row]");
      if (!row) {
        return;
      }

      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      state.selectedChannelId = row.getAttribute("data-channel-row") || null;
      state.isDetailOpen = true;
      renderPage();
    });
  }

  function handleFilterChange(event) {
    var field = event.target.closest("[data-channel-filter]");
    if (!field) {
      return;
    }

    var key = field.getAttribute("data-channel-filter");
    if (!key || !Object.prototype.hasOwnProperty.call(state, key)) {
      return;
    }

    state[key] = field.value || "";
    syncPresetFromState();
    renderPage();
  }

  function applyPreset(key) {
    var preset = findPresetByKey(key) || quickPresets[0];
    var nextState = getDefaultState();

    Object.keys(preset.filters).forEach(function (field) {
      nextState[field] = preset.filters[field];
    });

    nextState.selectedChannelId = state.selectedChannelId;
    nextState.activePreset = preset.key;
    nextState.isDetailOpen = state.isDetailOpen;
    state = nextState;
  }

  function findPresetByKey(key) {
    return quickPresets.filter(function (preset) {
      return preset.key === key;
    })[0] || null;
  }

  function syncPresetFromState() {
    var matchedPreset = null;

    quickPresets.forEach(function (preset) {
      if (matchedPreset) {
        return;
      }

      var keys = Object.keys(preset.filters);
      var fitsPreset = keys.every(function (field) {
        return state[field] === preset.filters[field];
      }) && Object.keys(getDefaultState()).every(function (field) {
        if (field === "selectedChannelId" || field === "activePreset") {
          return true;
        }

        if (keys.indexOf(field) >= 0) {
          return true;
        }

        return state[field] === getDefaultState()[field];
      });

      if (fitsPreset) {
        matchedPreset = preset.key;
      }
    });

    state.activePreset = matchedPreset || "custom";
  }

  function loadCsv(url) {
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
    var normalizedText = text.replace(/^\uFEFF/, "");
    var rows = [];
    var row = [];
    var cell = "";
    var inQuotes = false;

    for (var index = 0; index < normalizedText.length; index += 1) {
      var char = normalizedText[index];

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

    var filteredRows = rows.filter(function (currentRow) {
      return currentRow.some(function (value) {
        return value !== "";
      });
    });

    if (!filteredRows.length) {
      return [];
    }

    var headers = filteredRows[0];

    return filteredRows.slice(1).map(function (currentRow) {
      var entry = {};

      headers.forEach(function (header, headerIndex) {
        entry[header] = currentRow[headerIndex] || "";
      });

      return entry;
    });
  }

  function buildStore(mainRows, salesRows, supplyRows, contactRows) {
    var salesByChannel = {};
    var supplyByChannel = {};
    var contactsByChannel = {};

    salesRows.forEach(function (row) {
      salesByChannel[row.channel_id] = {
        subTypes: parseMultiValue(row.sales_sub_types),
        products: parseMultiValue(row.sales_products),
        bizTypes: parseMultiValue(row.sales_biz_types),
        apiMethods: parseMultiValue(row.sales_api_methods),
        languages: parseMultiValue(row.sales_languages)
      };
    });

    supplyRows.forEach(function (row) {
      supplyByChannel[row.channel_id] = {
        subTypes: parseMultiValue(row.supply_sub_types),
        products: parseMultiValue(row.supply_products),
        apiMethods: parseMultiValue(row.supply_api_methods)
      };
    });

    contactRows.forEach(function (row) {
      var channelId = row.channel_id;

      if (!contactsByChannel[channelId]) {
        contactsByChannel[channelId] = [];
      }

      contactsByChannel[channelId].push({
        id: row.contact_id || "",
        channelId: channelId,
        name: buildPersonName(row.first_name, row.last_name),
        title: row.title || "",
        languages: parseMultiValue(row.languages),
        responsibility: row.responsibility || "",
        isSales: isYes(row.is_sales),
        isSupply: isYes(row.is_supply),
        phone: row.phone || "",
        email: row.email || "",
        socials: buildSocials(row)
      });
    });

    var channels = mainRows.map(function (row) {
      var salesInfo = salesByChannel[row.channel_id] || emptySalesInfo();
      var supplyInfo = supplyByChannel[row.channel_id] || emptySupplyInfo();
      var contacts = contactsByChannel[row.channel_id] || [];
      var types = parseMultiValue(row.channel_types);
      var regions = parseMultiValue(row.regions);
      var hasSales = types.indexOf("销售渠道") >= 0;
      var hasSupply = types.indexOf("供应渠道") >= 0;
      var allProducts = uniqueList(salesInfo.products.concat(supplyInfo.products));
      var allApiMethods = uniqueList(salesInfo.apiMethods.concat(supplyInfo.apiMethods));
      var allLanguages = uniqueList(
        salesInfo.languages.concat(
          flatten(contacts.map(function (contact) {
            return contact.languages;
          }))
        )
      );

      return {
        id: row.channel_id || "",
        name: row.channel_name || "",
        shortIntro: row.short_intro || "",
        intro: row.intro || "",
        types: types,
        regions: regions,
        hasSales: hasSales,
        hasSupply: hasSupply,
        salesInfo: salesInfo,
        supplyInfo: supplyInfo,
        contacts: contacts,
        contactCount: contacts.length,
        regionCount: regions.length,
        allProducts: allProducts,
        allApiMethods: allApiMethods,
        allLanguages: allLanguages,
        searchText: normalizeSearch([
          row.channel_id,
          row.channel_name,
          row.short_intro,
          row.intro,
          types.join(" "),
          regions.join(" "),
          salesInfo.subTypes.join(" "),
          salesInfo.products.join(" "),
          salesInfo.bizTypes.join(" "),
          salesInfo.apiMethods.join(" "),
          supplyInfo.subTypes.join(" "),
          supplyInfo.products.join(" "),
          supplyInfo.apiMethods.join(" "),
          contacts.map(function (contact) {
            return [
              contact.name,
              contact.title,
              contact.responsibility,
              contact.email,
              contact.phone,
              contact.languages.join(" ")
            ].join(" ");
          }).join(" ")
        ].join(" "))
      };
    });

    return {
      channels: channels,
      options: {
        regions: sortListByDisplay(uniqueList(flatten(channels.map(function (channel) {
          return channel.regions;
        }))), formatRegion),
        products: sortByDefinedOrder(uniqueList(flatten(channels.map(function (channel) {
          return channel.allProducts;
        }))), productOrder),
        bizTypes: sortByDefinedOrder(uniqueList(flatten(channels.map(function (channel) {
          return channel.salesInfo.bizTypes;
        }))), bizTypeOrder),
        apiMethods: sortByDefinedOrder(uniqueList(flatten(channels.map(function (channel) {
          return channel.allApiMethods;
        }))), apiMethodOrder),
        languages: sortListByDisplay(uniqueList(flatten(channels.map(function (channel) {
          return channel.allLanguages;
        }))), formatLanguage)
      }
    };
  }

  function renderPage() {
    if (!store) {
      return;
    }

    var filteredChannels = getFilteredChannels();
    var selectedChannel = syncSelectedChannel(filteredChannels);
    syncModalState(selectedChannel);

    pageRoot.innerHTML = [
      '<div class="page-head">',
      '  <div>',
      '    <div class="page-kicker">共享资源 / Channel Hub</div>',
      '    <h1 class="page-title">全球渠道信息共享看板</h1>',
      '    <p class="page-sub">面向各 BG 的渠道资源共享页。通过渠道类型、区域、产品、对接方式与联系人语言快速筛选目标渠道，并在列表中快速扫描能力标签与关键联系人，按需展开详情弹层继续查看。</p>',
      '  </div>',
      '</div>',
      renderFilterSection(store.options, filteredChannels.length),
      renderChannelWorkspace(filteredChannels, selectedChannel)
    ].join("");
  }

  function getFilteredChannels() {
    var keyword = normalizeSearch(state.keyword);

    return store.channels
      .filter(function (channel) {
        if (keyword && channel.searchText.indexOf(keyword) < 0) {
          return false;
        }

        if (state.channelType === "销售渠道" && !channel.hasSales) {
          return false;
        }

        if (state.channelType === "供应渠道" && !channel.hasSupply) {
          return false;
        }

        if (state.channelType === "双侧渠道" && !(channel.hasSales && channel.hasSupply)) {
          return false;
        }

        if (state.region !== "全部" && channel.regions.indexOf(state.region) < 0) {
          return false;
        }

        if (state.product !== "全部" && channel.allProducts.indexOf(state.product) < 0) {
          return false;
        }

        if (state.bizType !== "全部" && channel.salesInfo.bizTypes.indexOf(state.bizType) < 0) {
          return false;
        }

        if (state.apiMethod !== "全部" && channel.allApiMethods.indexOf(state.apiMethod) < 0) {
          return false;
        }

        if (state.language !== "全部" && channel.allLanguages.indexOf(state.language) < 0) {
          return false;
        }

        if (state.contactRole === "销售对接" && !channel.contacts.some(function (contact) { return contact.isSales; })) {
          return false;
        }

        if (state.contactRole === "供应对接" && !channel.contacts.some(function (contact) { return contact.isSupply; })) {
          return false;
        }

        return true;
      })
      .sort(compareChannels);
  }

  function syncSelectedChannel(filteredChannels) {
    if (!filteredChannels.length) {
      state.selectedChannelId = null;
      state.isDetailOpen = false;
      return null;
    }

    if (!state.selectedChannelId) {
      return null;
    }

    var matched = filteredChannels.filter(function (channel) {
      return channel.id === state.selectedChannelId;
    })[0];

    if (!matched) {
      state.selectedChannelId = null;
      state.isDetailOpen = false;
    }

    return matched;
  }

  function compareChannels(left, right) {
    if (state.sort === "contacts") {
      return right.contactCount - left.contactCount
        || right.regionCount - left.regionCount
        || compareText(left.name, right.name);
    }

    if (state.sort === "coverage") {
      return right.regionCount - left.regionCount
        || right.contactCount - left.contactCount
        || compareText(left.name, right.name);
    }

    if (state.sort === "dual") {
      return numberFromBoolean(right.hasSales && right.hasSupply) - numberFromBoolean(left.hasSales && left.hasSupply)
        || right.contactCount - left.contactCount
        || compareText(left.name, right.name);
    }

    return compareText(left.name, right.name);
  }

  function renderFilterSection(options, filteredCount) {
    return [
      '<section class="card section channel-filters-card">',
      '  <div class="section-head">',
      '    <div>',
      '      <div class="section-title">筛选与查找</div>',
      '      <div class="section-sub">支持按渠道类型、区域、产品、对接方式与联系人语言过滤。点击任意渠道行后，会以弹层方式展开详细信息。</div>',
      '    </div>',
      '  </div>',
      '  <div class="channel-preset-row">',
      quickPresets.map(function (preset) {
        return '<button type="button" class="channel-preset-btn ' + (state.activePreset === preset.key ? 'active' : '') + '" data-channel-preset="' + escapeHtml(preset.key) + '">' + escapeHtml(preset.label) + '</button>';
      }).join(""),
      '  </div>',
      '  <div class="channel-filter-grid">',
      renderInputField("关键词", "keyword", state.keyword, "渠道名 / 联系人 / 产品 / 区域"),
      renderSelectField("渠道类型", "channelType", channelTypeOptions, state.channelType, function (value) { return value; }),
      renderSelectField("覆盖区域", "region", ["全部"].concat(options.regions), state.region, function (value) {
        return value === "全部" ? value : formatRegion(value);
      }),
      renderSelectField("产品类型", "product", ["全部"].concat(options.products), state.product, function (value) { return value; }),
      renderSelectField("销售模式", "bizType", ["全部"].concat(options.bizTypes), state.bizType, function (value) { return value; }),
      renderSelectField("对接方式", "apiMethod", ["全部"].concat(options.apiMethods), state.apiMethod, function (value) { return value; }),
      renderSelectField("对接语言", "language", ["全部"].concat(options.languages), state.language, function (value) {
        return value === "全部" ? value : formatLanguage(value);
      }),
      renderSelectField("联系人职责", "contactRole", contactRoleOptions, state.contactRole, function (value) { return value; }),
      renderSelectField("列表排序", "sort", sortOptions.map(function (item) { return item.value; }), state.sort, function (value) {
        return getSortLabel(value);
      }),
      '<div class="channel-filter-actions">',
      '  <button type="button" class="channel-reset-btn" data-channel-reset>重置筛选</button>',
      '  <div class="channel-filter-hint">当前结果 ' + escapeHtml(String(filteredCount)) + ' / ' + escapeHtml(String(store.channels.length)) + '，示例联系人信息可直接在 <span class="mono">data/contacts.csv</span> 维护。</div>',
      '</div>',
      '  </div>',
      '</section>'
    ].join("");
  }

  function renderInputField(label, key, value, placeholder) {
    return [
      '<label class="channel-filter-field">',
      '  <span class="channel-filter-label">' + escapeHtml(label) + '</span>',
      '  <input class="channel-search-input" type="search" data-channel-filter="' + escapeHtml(key) + '" value="' + escapeHtml(value) + '" placeholder="' + escapeHtml(placeholder) + '">',
      '</label>'
    ].join("");
  }

  function renderSelectField(label, key, values, selectedValue, formatter) {
    return [
      '<label class="channel-filter-field">',
      '  <span class="channel-filter-label">' + escapeHtml(label) + '</span>',
      '  <select class="channel-select" data-channel-filter="' + escapeHtml(key) + '">',
      values.map(function (value) {
        return '<option value="' + escapeHtml(value) + '"' + (value === selectedValue ? ' selected' : '') + '>' + escapeHtml(formatter(value)) + '</option>';
      }).join(""),
      '  </select>',
      '</label>'
    ].join("");
  }

  function renderChannelWorkspace(filteredChannels, selectedChannel) {
    return [
      '<section class="channel-layout section">',
      renderChannelTable(filteredChannels, state.isDetailOpen ? selectedChannel : null),
      '</section>',
      renderChannelDetailModal(selectedChannel, filteredChannels.length)
    ].join("");
  }

  function renderChannelTable(filteredChannels, selectedChannel) {
    return [
      '<div class="table-card channel-list-card">',
      '  <div class="channel-list-head">',
      '    <div>',
      '      <div class="channel-list-title">渠道大列表</div>',
      '      <div class="channel-list-sub">点击任意行可弹出详情抽屉，继续查看完整介绍、供采能力与全部联系人方式。表格本身也保留关键联系人信息，适合快速扫描。</div>',
      '    </div>',
      '    <div class="channel-count-badge">' + escapeHtml(String(filteredChannels.length)) + ' 条</div>',
      '  </div>',
      filteredChannels.length
        ? [
            '  <div class="channel-list-scroll">',
            '    <table class="channel-table">',
            '      <thead>',
            '        <tr>',
            '          <th class="channel-table-sticky" style="min-width:250px;">渠道</th>',
            '          <th style="min-width:240px;">类型与覆盖</th>',
            '          <th style="min-width:320px;">销售侧能力</th>',
            '          <th style="min-width:280px;">供应侧能力</th>',
            '          <th style="min-width:330px;">关键联系人</th>',
            '        </tr>',
            '      </thead>',
            '      <tbody>',
            filteredChannels.map(function (channel) {
              return renderChannelRow(channel, selectedChannel);
            }).join(""),
            '      </tbody>',
            '    </table>',
            '  </div>'
          ].join("")
        : '<div class="channel-empty">当前筛选条件下没有命中的渠道。可以先清空关键词，或切回“全部渠道”快捷视角。</div>',
      '</div>'
    ].join("");
  }

  function renderChannelRow(channel, selectedChannel) {
    return [
      '<tr class="channel-table-row ' + (selectedChannel && selectedChannel.id === channel.id ? 'is-selected' : '') + '" data-channel-row="' + escapeHtml(channel.id) + '" tabindex="0">',
      '  <td class="channel-table-sticky">',
      renderChannelIdentity(channel),
      '  </td>',
      '  <td>',
      renderChannelCoverage(channel),
      '  </td>',
      '  <td>',
      renderSalesCapability(channel.salesInfo, channel.hasSales),
      '  </td>',
      '  <td>',
      renderSupplyCapability(channel.supplyInfo, channel.hasSupply),
      '  </td>',
      '  <td>',
      renderContactPreview(channel.contacts),
      '  </td>',
      '</tr>'
    ].join("");
  }

  function renderChannelIdentity(channel) {
    return [
      '<div class="channel-cell-stack">',
      '  <div class="channel-name">' + escapeHtml(channel.name) + '</div>',
      '  <div class="channel-id mono">' + escapeHtml(channel.id) + '</div>',
      '  <div class="tag-row">',
      renderTypeTags(channel),
      '  </div>',
      '  <div class="channel-copy">' + escapeHtml(channel.shortIntro || "待补充简介") + '</div>',
      '</div>'
    ].join("");
  }

  function renderChannelCoverage(channel) {
    return [
      '<div class="channel-cell-stack">',
      renderFactGroup("覆盖区域", renderTags(channel.regions.map(formatRegion), "region")),
      renderFactGroup("说明", '<div class="channel-copy">' + escapeHtml(channel.intro || channel.shortIntro || "待补充详细说明") + '</div>'),
      '</div>'
    ].join("");
  }

  function renderSalesCapability(salesInfo, enabled) {
    if (!enabled) {
      return '<div class="empty-note">当前渠道未标记销售能力</div>';
    }

    return [
      '<div class="channel-cell-stack">',
      renderFactGroup("子类型", renderTags(salesInfo.subTypes, "sales-type")),
      renderFactGroup("产品", renderTags(salesInfo.products, "product")),
      renderFactGroup("模式 / 方式", renderTags(salesInfo.bizTypes, "biz") + renderTags(salesInfo.apiMethods, "api")),
      renderFactGroup("语言", renderTags(salesInfo.languages.map(formatLanguage), "language")),
      '</div>'
    ].join("");
  }

  function renderSupplyCapability(supplyInfo, enabled) {
    if (!enabled) {
      return '<div class="empty-note">当前渠道未标记供应能力</div>';
    }

    return [
      '<div class="channel-cell-stack">',
      renderFactGroup("子类型", renderTags(supplyInfo.subTypes, "supply-type")),
      renderFactGroup("产品", renderTags(supplyInfo.products, "product")),
      renderFactGroup("方式", renderTags(supplyInfo.apiMethods, "api")),
      '</div>'
    ].join("");
  }

  function renderContactPreview(contacts) {
    if (!contacts.length) {
      return '<div class="empty-note">暂无联系人</div>';
    }

    var previewContacts = contacts.slice(0, 2);

    return [
      '<div class="channel-mini-contact-list">',
      previewContacts.map(function (contact) {
        return [
          '<div class="channel-mini-contact">',
          '  <div class="channel-mini-contact-head">',
          '    <div class="channel-mini-contact-name">' + escapeHtml(contact.name || "未命名联系人") + '</div>',
          '    <div class="tag-row">' + renderContactRoleTags(contact) + '</div>',
          '  </div>',
          '  <div class="channel-mini-contact-meta">' + escapeHtml([contact.title, formatLanguagesInline(contact.languages)].filter(Boolean).join(" / ") || "待补充职位") + '</div>',
          '  <div class="channel-mini-contact-copy">' + escapeHtml(contact.responsibility || "待补充职责说明") + '</div>',
          '  <div class="channel-mini-contact-copy">' + renderContactInlineActions(contact) + '</div>',
          '</div>'
        ].join("");
      }).join(""),
      contacts.length > previewContacts.length
        ? '<div class="channel-more-note">还有 ' + escapeHtml(String(contacts.length - previewContacts.length)) + ' 位联系人，点选行后可在弹层查看完整信息。</div>'
        : '',
      '</div>'
    ].join("");
  }

  function renderChannelDetailModal(channel, filteredCount) {
    if (!state.isDetailOpen || !channel) {
      return "";
    }

    return [
      '<div class="channel-modal" data-channel-modal-backdrop="true">',
      '  <aside class="channel-modal-panel" role="dialog" aria-modal="true" aria-label="渠道详情">',
      '    <div class="channel-modal-head">',
      '      <div>',
      '        <div class="channel-modal-kicker">渠道详情</div>',
      '        <div class="channel-modal-title">' + escapeHtml(channel.name) + '</div>',
      '      </div>',
      '      <button type="button" class="channel-modal-close" data-channel-modal-close>关闭</button>',
      '    </div>',
      '    <div class="channel-modal-body">',
      renderChannelDetailContent(channel, filteredCount),
      '    </div>',
      '  </aside>',
      '</div>'
    ].join("");
  }

  function renderChannelDetailContent(channel, filteredCount) {
    return [
      '<div class="channel-detail-card">',
      '  <div class="channel-detail-head">',
      '    <div class="channel-detail-name">' + escapeHtml(channel.name) + '</div>',
      '    <div class="channel-detail-id mono">' + escapeHtml(channel.id) + ' · 当前命中列表 ' + escapeHtml(String(filteredCount)) + ' 条</div>',
      '    <div class="tag-row">' + renderTypeTags(channel) + '</div>',
      '    <div class="channel-detail-copy">' + escapeHtml(channel.shortIntro || "待补充简介") + '</div>',
      '    <div class="channel-detail-copy">' + escapeHtml(channel.intro || "待补充详细介绍") + '</div>',
      '  </div>',
      '  <div class="channel-detail-grid">',
      renderDetailBlock("覆盖区域", renderTags(channel.regions.map(formatRegion), "region")),
      renderDetailBlock("产品组合", renderTags(channel.allProducts, "product")),
      renderDetailBlock("销售模式", channel.hasSales ? renderTags(channel.salesInfo.bizTypes, "biz") : '<span class="empty-note">当前非销售渠道</span>'),
      renderDetailBlock("对接方式", renderTags(channel.allApiMethods, "api")),
      renderDetailBlock("对接语言", renderTags(channel.allLanguages.map(formatLanguage), "language")),
      renderDetailBlock("联系人统计", '<strong class="summary-strong">' + escapeHtml(String(channel.contactCount)) + '</strong><div class="channel-filter-hint">覆盖销售 / 供应关键联系人与接口对接人。</div>'),
      '  </div>',
      '  <div class="channel-detail-section">',
      '    <div class="channel-detail-section-title">销售侧详情</div>',
      channel.hasSales
        ? renderDetailCapabilityList([
            { label: "销售子类型", content: renderTags(channel.salesInfo.subTypes, "sales-type") },
            { label: "可销售产品", content: renderTags(channel.salesInfo.products, "product") },
            { label: "销售类型", content: renderTags(channel.salesInfo.bizTypes, "biz") },
            { label: "对接方式", content: renderTags(channel.salesInfo.apiMethods, "api") }
          ])
        : '<div class="empty-note">当前渠道暂无销售侧配置。</div>',
      '  </div>',
      '  <div class="channel-detail-section">',
      '    <div class="channel-detail-section-title">供应侧详情</div>',
      channel.hasSupply
        ? renderDetailCapabilityList([
            { label: "供应商子类型", content: renderTags(channel.supplyInfo.subTypes, "supply-type") },
            { label: "可供应产品", content: renderTags(channel.supplyInfo.products, "product") },
            { label: "对接方式", content: renderTags(channel.supplyInfo.apiMethods, "api") }
          ])
        : '<div class="empty-note">当前渠道暂无供应侧配置。</div>',
      '  </div>',
      '  <div class="channel-detail-section">',
      '    <div class="channel-detail-section-title">关键联系人</div>',
      channel.contacts.length ? [
        '<div class="channel-detail-contact-list">',
        channel.contacts.map(renderContactDetailCard).join(""),
        '</div>'
      ].join("") : '<div class="empty-note">当前渠道尚未录入联系人。</div>',
      '  </div>'
    ].join("");
  }

  function renderDetailCapabilityList(items) {
    return items.map(function (item) {
      return [
        '<div class="channel-detail-block">',
        '  <div class="channel-detail-block-label">' + escapeHtml(item.label) + '</div>',
        '  <div class="channel-detail-block-value">' + item.content + '</div>',
        '</div>'
      ].join("");
    }).join("");
  }

  function renderDetailBlock(label, content) {
    return [
      '<div class="channel-detail-block">',
      '  <div class="channel-detail-block-label">' + escapeHtml(label) + '</div>',
      '  <div class="channel-detail-block-value">' + content + '</div>',
      '</div>'
    ].join("");
  }

  function renderContactDetailCard(contact) {
    return [
      '<div class="channel-detail-contact">',
      '  <div class="channel-detail-contact-head">',
      '    <div>',
      '      <div class="channel-detail-contact-name">' + escapeHtml(contact.name || "未命名联系人") + '</div>',
      '      <div class="channel-detail-contact-meta">' + escapeHtml([contact.title, formatLanguagesInline(contact.languages)].filter(Boolean).join(" / ") || "待补充职位") + '</div>',
      '    </div>',
      '    <div class="tag-row">' + renderContactRoleTags(contact) + '</div>',
      '  </div>',
      '  <div class="channel-detail-contact-copy">' + escapeHtml(contact.responsibility || "待补充职责说明") + '</div>',
      '  <div class="channel-contact-actions">' + renderContactInlineActions(contact) + '</div>',
      contact.socials.length
        ? '  <div class="channel-contact-actions">' + contact.socials.map(function (item) {
            return renderLink(item.label, item.link);
          }).join("") + '</div>'
        : '',
      '</div>'
    ].join("");
  }

  function renderContactInlineActions(contact) {
    var actions = [];

    if (contact.email) {
      actions.push(renderLink(contact.email, "mailto:" + contact.email));
    }

    if (contact.phone) {
      actions.push('<span>' + escapeHtml(contact.phone) + '</span>');
    }

    return actions.length ? actions.join('<span class="channel-more-note">·</span>') : '<span class="empty-note">待补充联系方式</span>';
  }

  function renderLink(label, href) {
    return '<a class="channel-link" href="' + escapeHtml(href) + '" target="_blank" rel="noreferrer noopener">' + escapeHtml(label) + '</a>';
  }

  function renderFactGroup(label, content) {
    return [
      '<div class="channel-fact-group">',
      '  <div class="channel-fact-label">' + escapeHtml(label) + '</div>',
      '  <div>' + content + '</div>',
      '</div>'
    ].join("");
  }

  function renderTags(values, context) {
    if (!values || !values.length) {
      return '<span class="empty-note">待补充</span>';
    }

    return values.map(function (value) {
      return '<span class="tag ' + escapeHtml(resolveTagClass(value, context)) + '">' + escapeHtml(value) + '</span>';
    }).join("");
  }

  function renderTypeTags(channel) {
    if (channel.hasSales && channel.hasSupply) {
      return '<span class="tag tag-purple">双侧渠道</span><span class="tag tag-blue">销售渠道</span><span class="tag tag-teal">供应渠道</span>';
    }

    return channel.types.map(function (type) {
      var tagClass = type === "销售渠道" ? "tag-blue" : type === "供应渠道" ? "tag-teal" : "tag-gray";
      return '<span class="tag ' + tagClass + '">' + escapeHtml(type) + '</span>';
    }).join("");
  }

  function renderContactRoleTags(contact) {
    var tags = [];

    if (contact.isSales) {
      tags.push('<span class="tag tag-blue">销售对接</span>');
    }

    if (contact.isSupply) {
      tags.push('<span class="tag tag-teal">供应对接</span>');
    }

    return tags.join("");
  }

  function resolveTagClass(value, context) {
    if (context === "api") {
      if (value === "API") {
        return "tag-purple";
      }

      if (value === "商家后台") {
        return "tag-orange";
      }

      return "tag-gray";
    }

    if (context === "biz") {
      if (value === "B2B") {
        return "tag-purple";
      }

      if (value === "B2C") {
        return "tag-orange";
      }

      if (value === "B2B2C") {
        return "tag-blue";
      }

      return "tag-teal";
    }

    if (context === "region") {
      return "tag-gray";
    }

    if (context === "product") {
      if (value === "机票" || value === "商旅解决方案") {
        return "tag-blue";
      }

      if (value === "酒店" || value === "民宿") {
        return "tag-green";
      }

      if (value === "系统解决方案") {
        return "tag-purple";
      }

      return "tag-orange";
    }

    if (context === "language") {
      return "tag-gray";
    }

    if (context === "sales-type") {
      return "tag-blue";
    }

    if (context === "supply-type") {
      return "tag-teal";
    }

    return "tag-gray";
  }

  function syncModalState(selectedChannel) {
    if (!document.body || !document.body.classList) {
      return;
    }

    document.body.classList.toggle("channel-modal-open", Boolean(state.isDetailOpen && selectedChannel));
  }

  function buildPersonName(firstName, lastName) {
    return [firstName, lastName].filter(Boolean).join(" ").trim();
  }

  function buildSocials(row) {
    var socials = [];

    if (row.social_type_1 && row.social_link_1) {
      socials.push({ label: row.social_type_1, link: row.social_link_1 });
    }

    if (row.social_type_2 && row.social_link_2) {
      socials.push({ label: row.social_type_2, link: row.social_link_2 });
    }

    return socials;
  }

  function emptySalesInfo() {
    return {
      subTypes: [],
      products: [],
      bizTypes: [],
      apiMethods: [],
      languages: []
    };
  }

  function emptySupplyInfo() {
    return {
      subTypes: [],
      products: [],
      apiMethods: []
    };
  }

  function parseMultiValue(value) {
    return uniqueList(String(value || "")
      .split(",")
      .map(function (item) { return item.trim(); })
      .filter(Boolean));
  }

  function isYes(value) {
    return String(value || "").toUpperCase() === "Y";
  }

  function uniqueList(values) {
    var seen = {};
    var result = [];

    values.forEach(function (value) {
      if (!value && value !== 0) {
        return;
      }

      var key = String(value);
      if (seen[key]) {
        return;
      }

      seen[key] = true;
      result.push(value);
    });

    return result;
  }

  function flatten(values) {
    return values.reduce(function (result, item) {
      return result.concat(item || []);
    }, []);
  }

  function normalizeSearch(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function compareText(left, right) {
    return String(left || "").localeCompare(String(right || ""), "zh-CN", localeCompareOptions);
  }

  function sortByDefinedOrder(values, orderedValues) {
    return values.slice().sort(function (left, right) {
      var leftIndex = orderedValues.indexOf(left);
      var rightIndex = orderedValues.indexOf(right);

      if (leftIndex >= 0 || rightIndex >= 0) {
        if (leftIndex < 0) {
          return 1;
        }

        if (rightIndex < 0) {
          return -1;
        }

        return leftIndex - rightIndex;
      }

      return compareText(left, right);
    });
  }

  function sortListByDisplay(values, formatter) {
    return values.slice().sort(function (left, right) {
      return compareText(formatter(left), formatter(right));
    });
  }

  function formatRegion(code) {
    var normalizedCode = String(code || "").trim().toUpperCase();
    if (!normalizedCode) {
      return "-";
    }

    var regionName = normalizedCode;

    if (regionDisplayNames) {
      try {
        regionName = regionDisplayNames.of(normalizedCode) || normalizedCode;
      } catch (error) {
        regionName = normalizedCode;
      }
    }

    return normalizedCode + " " + regionName;
  }

  function formatLanguage(code) {
    var normalizedCode = String(code || "").trim().toLowerCase();
    if (!normalizedCode) {
      return "-";
    }

    var displayName = languageNames[normalizedCode] || normalizedCode.toUpperCase();
    return normalizedCode.toUpperCase() + " " + displayName;
  }

  function formatLanguagesInline(codes) {
    if (!codes || !codes.length) {
      return "";
    }

    return codes.map(formatLanguage).join(" / ");
  }

  function getSortLabel(value) {
    var match = sortOptions.filter(function (item) {
      return item.value === value;
    })[0];

    return match ? match.label : value;
  }

  function numberFromBoolean(value) {
    return value ? 1 : 0;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderState(message, isError, error) {
    pageRoot.innerHTML = [
      '<div class="page-state ' + (isError ? 'page-state-error' : '') + '">',
      '  <div class="page-state-title">' + escapeHtml(isError ? '页面未能完成渲染' : '页面准备中') + '</div>',
      '  <div class="page-state-copy">' + escapeHtml(message) + '</div>',
      error ? '  <div class="page-state-detail mono">' + escapeHtml(String(error.message || error)) + '</div>' : '',
      '</div>'
    ].join("");
  }
})();
