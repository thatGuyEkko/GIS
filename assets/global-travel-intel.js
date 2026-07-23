(function () {
  "use strict";

  var pageRoot = document.querySelector("[data-travel-intel-page]");
  var mapChart = null;
  var currentView = null;
  var hasBoundResize = false;
  var lastSelectedCode = null;
  var regionDisplayNames = typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function"
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;
  var mapNameOverrides = {
    AE: "United Arab Emirates",
    BA: "Bosnia and Herz.",
    BN: "Brunei",
    CF: "Central African Rep.",
    CG: "Congo",
    CD: "Dem. Rep. Congo",
    CI: "Cote d'Ivoire",
    CZ: "Czech Rep.",
    DO: "Dominican Rep.",
    EH: "W. Sahara",
    GB: "United Kingdom",
    IR: "Iran",
    KP: "North Korea",
    KR: "South Korea",
    LA: "Laos",
    MK: "Macedonia",
    PS: "Palestine",
    RU: "Russia",
    SB: "Solomon Is.",
    SS: "S. Sudan",
    SY: "Syria",
    TL: "Timor-Leste",
    TZ: "Tanzania",
    US: "United States",
    VE: "Venezuela",
    VN: "Vietnam"
  };

  if (!pageRoot) {
    return;
  }

  var dataPrefix = (function () {
    var script = document.currentScript;

    if (!script || !script.src) {
      var allScripts = document.getElementsByTagName("script");
      for (var index = allScripts.length - 1; index >= 0; index -= 1) {
        if (/global-travel-intel\.js/.test(allScripts[index].src)) {
          script = allScripts[index];
          break;
        }
      }
    }

    var src = script && script.src ? script.src : "";
    return src.replace(/assets\/[^/]*$/, "") + "data/";
  })();

  var dataFiles = {
    countries: dataPrefix + "travel_intel_countries.csv",
    news: dataPrefix + "travel_intel_news.csv",
    leads: dataPrefix + "leads.csv",
    opportunities: dataPrefix + "opportunities.csv",
    expos: dataPrefix + "travel_intel_expos.csv"
  };

  var store = null;
  var state = {
    language: "全部",
    category: "全部",
    lockedCountryCode: null,
    hoverCountryCode: null
  };

  if (window.location.protocol === "file:") {
    renderState(
      "请通过本地 HTTP 服务打开页面，浏览器在 file:// 模式下不会允许脚本读取数据文件。",
      true
    );
    return;
  }

  renderState("正在读取全球化旅业信息数据...");

  Promise.all([
    loadCsv(dataFiles.countries),
    loadCsv(dataFiles.news),
    loadCsv(dataFiles.leads),
    loadCsv(dataFiles.opportunities),
    loadCsv(dataFiles.expos)
  ])
    .then(function (results) {
      store = buildStore(results[0], results[1], results[2], results[3], results[4]);
      renderPage();
    })
    .catch(function (error) {
      renderState("全球化旅业信息数据加载失败，请检查 data 目录下的 travel_intel_*.csv、leads.csv、opportunities.csv 与本地服务。", true, error);
    });

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

  function buildStore(countryRows, newsRows, leadRows, opportunityRows, expoRows) {
    var countries = countryRows.map(function (item) {
      var country = {
        country_code: String(item.country_code || "").trim().toUpperCase(),
        country_name: String(item.country_name || "").trim(),
        region_name: String(item.region_name || "").trim() || "未分组",
        sub_region_name: String(item.sub_region_name || "").trim(),
        official_language: String(item.official_language || "").trim() || "-",
        population_value: toNumber(item.population_value),
        population_growth_rate: toOptionalNumber(item.population_growth_rate),
        tourism_overview: String(item.tourism_overview || "").trim(),
        opportunity_summary: String(item.opportunity_summary || "").trim(),
        focus_level: String(item.focus_level || "").trim() || "观察",
        headline_metric: String(item.headline_metric || "").trim(),
        map_enabled_flag: toBoolean(item.map_enabled_flag),
        display_order: toOptionalNumber(item.display_order),
        news: [],
        leads: [],
        opportunities: [],
        expos: []
      };

      if (country.display_order === null) {
        country.display_order = 9999;
      }

      return country;
    }).sort(function (left, right) {
      return left.display_order - right.display_order || left.country_name.localeCompare(right.country_name, "zh-CN");
    });

    var countriesByCode = {};
    countries.forEach(function (country) {
      countriesByCode[country.country_code] = country;
    });

    newsRows.forEach(function (item) {
      var country = countriesByCode[String(item.country_code || "").trim().toUpperCase()];

      if (!country) {
        return;
      }

      country.news.push({
        news_type: String(item.news_type || "").trim() || "旅业动态",
        headline: String(item.headline || "").trim(),
        publish_date: String(item.publish_date || "").trim(),
        summary: String(item.summary || "").trim(),
        source_name: String(item.source_name || "").trim()
      });
    });

    leadRows.forEach(function (item) {
      var country = countriesByCode[String(item.country || "").trim().toUpperCase()];

      if (!country) {
        return;
      }

      country.leads.push({
        name: String(item.name || "").trim(),
        type: String(item.type || "").trim() || "未分类",
        bg: String(item.bg || "").trim(),
        source: String(item.source || "").trim(),
        copy: String(item.copy || "").trim()
      });
    });

    opportunityRows.forEach(function (item) {
      var country = countriesByCode[String(item.country || "").trim().toUpperCase()];

      if (!country) {
        return;
      }

      country.opportunities.push({
        name: String(item.name || "").trim(),
        type: String(item.type || "").trim() || "未分类",
        bg: String(item.bg || "").trim(),
        source: String(item.source || "").trim(),
        copy: String(item.copy || "").trim(),
        status: String(item.status || "").trim() || "待更新"
      });
    });

    expoRows.forEach(function (item) {
      var country = countriesByCode[String(item.country_code || "").trim().toUpperCase()];

      if (!country) {
        return;
      }

      country.expos.push({
        expo_name: String(item.expo_name || "").trim(),
        expo_start_date: String(item.expo_start_date || "").trim(),
        expo_end_date: String(item.expo_end_date || "").trim(),
        expo_quarter: String(item.expo_quarter || "").trim() || "未标记",
        expo_city: String(item.expo_city || "").trim(),
        expo_schedule: String(item.expo_schedule || "").trim(),
        expo_positioning: String(item.expo_positioning || item.expo_note || "").trim(),
        expo_buyer_type: String(item.expo_buyer_type || "").trim(),
        expo_note: String(item.expo_note || "").trim()
      });
    });

    return {
      countries: countries,
      countriesByCode: countriesByCode
    };
  }

  function renderPage() {
    if (!ensureChartRuntime()) {
      return;
    }

    var filters = deriveFilterOptions(store.countries);
    var filteredCountries = getFilteredCountries(store.countries);
    var visibleCountries = filteredCountries.filter(canRenderOnMap);

    if (state.lockedCountryCode && !visibleCountries.some(function (country) {
      return country.country_code === state.lockedCountryCode;
    })) {
      state.lockedCountryCode = null;
    }

    if (state.hoverCountryCode && !visibleCountries.some(function (country) {
      return country.country_code === state.hoverCountryCode;
    })) {
      state.hoverCountryCode = null;
    }

    currentView = {
      filters: filters,
      filteredCountries: filteredCountries,
      visibleCountries: visibleCountries,
      visibleCountriesByCode: indexCountriesByCode(visibleCountries)
    };

    destroyMapChart();
    document.title = "OOMS | 全球化旅业信息看板";

    pageRoot.innerHTML = [
      '<div class="page-head">',
      '  <div>',
      '    <div class="page-kicker">模块零 / Global Travel Intelligence</div>',
      '    <h1 class="page-title">全球化旅业信息看板</h1>',
      '  </div>',
      '</div>',
      '<section class="travel-filter-card section">',
      '  <div class="section-head">',
      '    <div class="section-title">筛选</div>',
      '    <button type="button" class="travel-reset-btn" data-travel-action="reset">重置筛选</button>',
      '  </div>',
      '  <div class="travel-filter-grid">',
      buildSelectField("官方语言", "language", filters.languages, state.language),
      buildSelectField("商机 / 线索类型", "category", filters.categories, state.category),
      '  </div>',
      '</section>',
      '<section class="travel-map-card section">',
      '  <div class="section-head">',
      '    <div class="section-title">主地图看板</div>',
      '  </div>',
      '  <div class="travel-map-shell">',
      '    <div class="travel-map-stage">',
      '      <div class="travel-map-canvas" data-travel-map aria-label="世界地图"></div>',
      '    </div>',
      '    <aside class="travel-info-panel" aria-live="polite">',
      '      <div class="travel-info-panel-body" data-travel-info></div>',
      '    </aside>',
      '  </div>',
      '</section>'
    ].join("");

    bindEvents();
    initializeMap();
    syncHoverCard();
  }

  function ensureChartRuntime() {
    if (!window.echarts || typeof window.echarts.init !== "function") {
      renderState("ECharts 组件未成功加载，请检查 assets/vendor/echarts.min.js。", true);
      return false;
    }

    if (typeof window.echarts.getMap !== "function" || !window.echarts.getMap("world")) {
      renderState("ECharts 世界地图数据未成功加载，请检查 assets/vendor/echarts-world.js。", true);
      return false;
    }

    return true;
  }

  function bindEvents() {
    var filterNodes = pageRoot.querySelectorAll("[data-travel-filter]");
    var resetButton = pageRoot.querySelector("[data-travel-action='reset']");

    Array.prototype.forEach.call(filterNodes, function (node) {
      node.addEventListener("change", function (event) {
        var filterKey = event.target.getAttribute("data-travel-filter");
        state[filterKey] = event.target.value;
        state.lockedCountryCode = null;
        state.hoverCountryCode = null;
        renderPage();
      });
    });

    if (resetButton) {
      resetButton.addEventListener("click", function () {
        state.language = "全部";
        state.category = "全部";
        state.lockedCountryCode = null;
        state.hoverCountryCode = null;
        renderPage();
      });
    }
  }

  function initializeMap() {
    var mapNode = pageRoot.querySelector("[data-travel-map]");

    if (!mapNode) {
      return;
    }

    mapChart = window.echarts.init(mapNode);
    mapChart.setOption(buildMapOption(currentView.visibleCountries), true);
    lastSelectedCode = null;
    syncMapSelection();

    mapChart.on("mouseover", function (params) {
      var code = extractCountryCode(params);

      if (!code) {
        return;
      }

      if (state.hoverCountryCode === code) {
        return;
      }

      state.hoverCountryCode = code;

      if (!state.lockedCountryCode) {
        syncHoverCard();
      }
    });

    mapChart.on("mouseout", function (params) {
      var code = extractCountryCode(params);

      if (!code || state.hoverCountryCode !== code) {
        return;
      }

      state.hoverCountryCode = null;

      if (!state.lockedCountryCode) {
        syncHoverCard();
      }
    });

    mapChart.on("click", function (params) {
      var code = extractCountryCode(params);

      if (!code) {
        return;
      }

      toggleLockedCountry(code);
    });

    mapChart.getZr().on("globalout", function () {
      if (!state.hoverCountryCode) {
        return;
      }

      state.hoverCountryCode = null;

      if (!state.lockedCountryCode) {
        syncHoverCard();
      }
    });

    if (!hasBoundResize) {
      hasBoundResize = true;
      window.addEventListener("resize", handleWindowResize);
    }
  }

  function buildMapOption(visibleCountries) {
    var values = visibleCountries.map(getCountryMapValue);
    var maxValue = values.length ? Math.max.apply(null, values) : 1;

    return {
      animation: false,
      tooltip: {
        show: false
      },
      visualMap: {
        min: 0,
        max: maxValue,
        show: false,
        calculable: false,
        inRange: {
          color: ["#dfe7dd", "#97b88f", "#5e8b63"]
        }
      },
      series: [
        {
          type: "map",
          map: "world",
          roam: true,
          selectedMode: "single",
          left: 8,
          top: 8,
          right: 8,
          bottom: 8,
          scaleLimit: {
            min: 1,
            max: 6
          },
          zoom: 1.08,
          nameProperty: "name",
          label: {
            show: false
          },
          itemStyle: {
            areaColor: "#d8d5cc",
            borderColor: "#ffffff",
            borderWidth: 0.8
          },
          emphasis: {
            label: {
              show: false
            },
            itemStyle: {
              areaColor: "#d88b4f",
              borderColor: "#ffffff",
              borderWidth: 1.4
            }
          },
          select: {
            label: {
              show: false
            },
            itemStyle: {
              areaColor: "#c96a2d",
              borderColor: "#ffffff",
              borderWidth: 1.6
            }
          },
          data: buildMapSeriesData(visibleCountries)
        }
      ]
    };
  }

  function buildMapSeriesData(visibleCountries) {
    return visibleCountries.map(function (country) {
      return {
        name: resolveMapCountryName(country),
        value: getCountryMapValue(country),
        countryCode: country.country_code,
        selected: state.lockedCountryCode === country.country_code
      };
    });
  }

  function syncMapSelection() {
    if (!mapChart || !currentView) {
      return;
    }

    if (lastSelectedCode === state.lockedCountryCode) {
      return;
    }

    lastSelectedCode = state.lockedCountryCode;
    mapChart.setOption({
      series: [
        {
          data: buildMapSeriesData(currentView.visibleCountries)
        }
      ]
    });
  }

  function syncHoverCard() {
    var panelNode = pageRoot.querySelector("[data-travel-info]");

    if (!panelNode || !currentView) {
      return;
    }

    var country = getDisplayedCountry(currentView.visibleCountries);
    panelNode.innerHTML = buildHoverCard(country);
  }

  function buildSelectField(label, key, options, selectedValue) {
    return [
      '<label class="travel-filter-field">',
      '  <span class="travel-filter-label">' + escapeHtml(label) + '</span>',
      '  <select class="travel-select" data-travel-filter="' + escapeHtml(key) + '">',
      options.map(function (option) {
        var selected = option === selectedValue ? ' selected' : '';
        return '<option value="' + escapeHtml(option) + '"' + selected + '>' + escapeHtml(option) + '</option>';
      }).join(""),
      '  </select>',
      '</label>'
    ].join("");
  }

  function deriveFilterOptions(countries) {
    return {
      languages: ["全部"].concat(uniqueValues(countries, function (country) { return country.official_language; })),
      categories: ["全部"].concat(uniqueValues(countries, function (country) {
        return country.leads.map(function (item) { return item.type; })
          .concat(country.opportunities.map(function (item) { return item.type; }));
      }, true))
    };
  }

  function uniqueValues(countries, picker, flatten) {
    var values = {};

    countries.forEach(function (country) {
      var picked = picker(country);
      var list = flatten ? picked : [picked];

      list.forEach(function (item) {
        var value = String(item || "").trim();
        if (value) {
          values[value] = true;
        }
      });
    });

    return Object.keys(values).sort(function (left, right) {
      return left.localeCompare(right, "zh-CN");
    });
  }

  function getFilteredCountries(countries) {
    return countries.filter(function (country) {
      if (state.language !== "全部" && country.official_language !== state.language) {
        return false;
      }

      if (state.category !== "全部") {
        var hasCategory = country.leads.some(function (item) {
          return item.type === state.category;
        }) || country.opportunities.some(function (item) {
          return item.type === state.category;
        });

        if (!hasCategory) {
          return false;
        }
      }

      return true;
    });
  }

  function canRenderOnMap(country) {
    return country.map_enabled_flag && !!resolveMapCountryName(country);
  }

  function resolveMapCountryName(country) {
    var code = String(country && country.country_code || "").trim().toUpperCase();

    if (!code) {
      return null;
    }

    if (mapNameOverrides[code]) {
      return mapNameOverrides[code];
    }

    if (!regionDisplayNames) {
      return null;
    }

    return regionDisplayNames.of(code) || null;
  }

  function getCountryMapValue(country) {
    var focusWeights = {
      核心: 340,
      重点: 250,
      观察: 160
    };

    return (focusWeights[country.focus_level] || 120)
      + Math.min(country.news.length, 4) * 90
      + Math.min(country.leads.length, 3) * 80
      + Math.min(country.opportunities.length, 4) * 120
      + Math.min(country.expos.length, 4) * 70;
  }

  function extractCountryCode(params) {
    if (!params || !params.data || !params.data.countryCode) {
      return null;
    }

    return String(params.data.countryCode || "").trim().toUpperCase() || null;
  }

  function getDisplayedCountry(visibleCountries) {
    var displayCode = state.lockedCountryCode || state.hoverCountryCode;

    if (displayCode) {
      return visibleCountries.find(function (country) {
        return country.country_code === displayCode;
      }) || null;
    }

    return null;
  }

  function buildHoverCard(country) {
    if (!country) {
      return buildHoverEmptyState();
    }

    var primaryNews = resolvePrimaryNews(country.news);
    var relatedNews = resolveRelatedNews(country.news, primaryNews);
    var interactionState = state.lockedCountryCode === country.country_code
      ? "已锁定，点击地图中的同一国家可取消锁定。"
      : "当前为悬停预览，点击该国家可锁定信息。";

    return [
      '<div class="travel-hover-card" tabindex="0">',
      '  <div class="travel-hover-head">',
      '    <div>',
      '      <div class="travel-hover-country">' + escapeHtml(country.country_name) + '</div>',
      '      <div class="travel-hover-meta">' + escapeHtml(country.region_name) + (country.sub_region_name ? ' / ' + escapeHtml(country.sub_region_name) : '') + ' / ' + escapeHtml(country.official_language) + '</div>',
      '      <div class="travel-hover-tip">' + escapeHtml(interactionState) + '</div>',
      '    </div>',
      '    <span class="tag ' + escapeHtml(getFocusTagClass(country.focus_level)) + '">' + escapeHtml(country.focus_level) + '</span>',
      '  </div>',
      '  <div class="travel-hover-stats">',
      buildHoverMetric("人口", formatPopulation(country.population_value)),
      buildHoverMetric("增长率", formatPercent(country.population_growth_rate)),
      buildHoverMetric("官方语言", country.official_language),
      '  </div>',
      buildHoverSection("国家关键数据", country.headline_metric || "待补充"),
      buildHoverSection("市场概况", country.tourism_overview || "待补充"),
      buildHoverNewsSection("旅游业重要新闻信息", primaryNews),
      buildHoverNewsSection("关联的重要新闻信息", relatedNews),
      buildHoverBusinessSection(country),
      buildHoverExpoSection(country),
      '</div>'
    ].join("");
  }

  function buildHoverEmptyState() {
    return [
      '<div class="travel-info-empty">',
      '  <div class="travel-info-empty-kicker">国家信息面板</div>',
      '  <div class="travel-info-empty-title">先将鼠标悬停到地图中的国家上</div>',
      '  <div class="travel-info-empty-copy">悬停会展示对应国家的商机、线索、新闻与展会信息；点击国家可锁定，再次点击同一国家可取消锁定。</div>',
      '</div>'
    ].join("");
  }

  function buildHoverMetric(label, value) {
    return [
      '<div class="travel-hover-metric">',
      '  <span>' + escapeHtml(label) + '</span>',
      '  <strong>' + escapeHtml(value || "-") + '</strong>',
      '</div>'
    ].join("");
  }

  function buildHoverSection(title, copy) {
    return [
      '<div class="travel-hover-section">',
      '  <div class="travel-hover-section-title">' + escapeHtml(title) + '</div>',
      '  <div class="travel-hover-copy">' + escapeHtml(copy || "待补充") + '</div>',
      '</div>'
    ].join("");
  }

  function buildHoverNewsSection(title, item) {
    return [
      '<div class="travel-hover-section">',
      '  <div class="travel-hover-section-title">' + escapeHtml(title) + '</div>',
      buildHoverNewsItem(item),
      '</div>'
    ].join("");
  }

  function buildHoverNewsItem(item) {
    if (!item) {
      return '<div class="travel-hover-record empty-note">待补充</div>';
    }

    var meta = [item.publish_date, item.source_name].filter(Boolean).join(" / ");

    return [
      '<div class="travel-hover-record">',
      '  <div class="travel-hover-record-title">' + escapeHtml(item.headline || item.news_type || "待补充") + '</div>',
      meta ? '  <div class="travel-hover-record-meta mono">' + escapeHtml(meta) + '</div>' : '',
      '  <div class="travel-hover-record-copy">' + escapeHtml(item.summary || "待补充") + '</div>',
      '</div>'
    ].join("");
  }

  function buildHoverBusinessSection(country) {
    var leadRecords = country.leads.slice(0, 3).map(buildHoverLeadRecord).join("");
    var opportunityRecords = country.opportunities.slice(0, 3).map(buildHoverOpportunityRecord).join("");

    return [
      '<div class="travel-hover-section">',
      '  <div class="travel-hover-section-title">商机与线索展示</div>',
      buildHoverSubsection("线索", leadRecords || '<div class="travel-hover-record empty-note">当前国家暂无线索数据</div>'),
      buildHoverSubsection("商机", opportunityRecords || '<div class="travel-hover-record empty-note">当前国家暂无商机数据</div>'),
      '</div>'
    ].join("");
  }

  function buildHoverSubsection(title, content) {
    return [
      '<div class="travel-hover-subsection">',
      '  <div class="travel-hover-subtitle">' + escapeHtml(title) + '</div>',
      '  <div class="travel-hover-list">' + content + '</div>',
      '</div>'
    ].join("");
  }

  function buildHoverLeadRecord(item) {
    var bgSource = [item.bg, item.source].filter(Boolean).join(" / ");

    return [
      '<div class="travel-hover-record">',
      '  <div class="travel-hover-record-title">' + escapeHtml(item.name || "待补充") + '</div>',
      '  <div class="travel-hover-record-meta">' + escapeHtml(item.type || "未分类") + '</div>',
      buildHoverRecordDetail("文案说明", item.copy || "待补充"),
      buildHoverRecordDetail("BG来源", bgSource || "待补充"),
      '</div>'
    ].join("");
  }

  function buildHoverOpportunityRecord(item) {
    return [
      '<div class="travel-hover-record">',
      '  <div class="travel-hover-record-title">' + escapeHtml(item.name || "待补充") + '</div>',
      '  <div class="travel-hover-record-meta">' + escapeHtml(item.type || "未分类") + '</div>',
      buildHoverRecordDetail("BG", item.bg || "待补充"),
      buildHoverRecordDetail("文案说明", item.copy || "待补充"),
      buildHoverRecordDetail("Status", item.status || "待更新"),
      '</div>'
    ].join("");
  }

  function buildHoverExpoSection(country) {
    if (!country.expos.length) {
      return [
        '<div class="travel-hover-section">',
        '  <div class="travel-hover-section-title">重点展会信息</div>',
        '  <div class="travel-hover-record empty-note">当前国家暂无展会数据</div>',
        '</div>'
      ].join("");
    }

    return [
      '<div class="travel-hover-section">',
      '  <div class="travel-hover-section-title">重点展会信息</div>',
      '  <div class="travel-hover-list">',
      country.expos.slice(0, 3).map(function (item) {
        var scheduleParts = [];

        if (item.expo_start_date || item.expo_end_date) {
          scheduleParts.push(formatDateRange(item.expo_start_date, item.expo_end_date));
        }

        if (item.expo_city) {
          scheduleParts.push(item.expo_city);
        }

        var schedule = item.expo_schedule || scheduleParts.join(" / ") || "待补充";

        return [
          '<div class="travel-hover-record">',
          '  <div class="travel-hover-record-title">' + escapeHtml(item.expo_name || "待补充") + '</div>',
          '  <div class="travel-hover-record-meta">' + escapeHtml(schedule || "待补充") + '</div>',
          buildHoverRecordDetail("展会定位与规模", item.expo_positioning || item.expo_note || "待补充"),
          buildHoverRecordDetail("适配采购商类型", item.expo_buyer_type || "待补充"),
          '</div>'
        ].join("");
      }).join(""),
      '  </div>',
      '</div>'
    ].join("");
  }

  function resolvePrimaryNews(newsItems) {
    if (!newsItems.length) {
      return null;
    }

    return newsItems.find(function (item) {
      return item.news_type.indexOf("旅游业") !== -1;
    }) || newsItems[0];
  }

  function resolveRelatedNews(newsItems, primaryNews) {
    if (!newsItems.length) {
      return null;
    }

    return newsItems.find(function (item) {
      return item !== primaryNews && item.news_type.indexOf("关联") !== -1;
    }) || newsItems.find(function (item) {
      return item !== primaryNews;
    }) || null;
  }

  function buildHoverRecordDetail(label, value) {
    return [
      '<div class="travel-hover-record-copy">',
      '  <span class="travel-hover-record-key">' + escapeHtml(label) + '：</span>',
      escapeHtml(value || "待补充"),
      '</div>'
    ].join("");
  }

  function toggleLockedCountry(code) {
    if (!code) {
      return;
    }

    if (state.lockedCountryCode === code) {
      state.lockedCountryCode = null;
    } else {
      state.lockedCountryCode = code;
      state.hoverCountryCode = code;
    }

    syncMapSelection();
    syncHoverCard();
  }

  function handleWindowResize() {
    if (mapChart) {
      mapChart.resize();
    }
  }

  function destroyMapChart() {
    if (!mapChart) {
      return;
    }

    mapChart.dispose();
    mapChart = null;
    lastSelectedCode = null;
  }

  function renderState(message, isError, error) {
    destroyMapChart();
    document.title = "OOMS | 全球化旅业信息看板";
    pageRoot.innerHTML = [
      '<div class="page-state ' + (isError ? 'page-state-error' : '') + '">',
      '  <div class="page-state-title">' + escapeHtml(isError ? '页面未能完成渲染' : '页面准备中') + '</div>',
      '  <div class="page-state-copy">' + escapeHtml(message) + '</div>',
      error ? '  <div class="page-state-detail mono">' + escapeHtml(String(error.message || error)) + '</div>' : '',
      '</div>'
    ].join("");
  }

  function indexCountriesByCode(countries) {
    var result = {};

    countries.forEach(function (country) {
      result[country.country_code] = country;
    });

    return result;
  }

  function formatPopulation(value) {
    if (!value) {
      return "-";
    }

    if (value >= 100000000) {
      return trimDecimal(value / 100000000) + "亿";
    }

    if (value >= 10000) {
      return trimDecimal(value / 10000) + "万";
    }

    return String(value);
  }

  function formatPercent(value) {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return "-";
    }

    return trimDecimal(value) + "%";
  }

  function formatDateRange(start, end) {
    if (!start && !end) {
      return "待补充";
    }

    if (start && end) {
      return start + " - " + end;
    }

    return start || end;
  }

  function getFocusTagClass(level) {
    var mapping = {
      核心: "tag-red",
      重点: "tag-orange",
      观察: "tag-blue"
    };

    return mapping[level] || "tag-gray";
  }

  function toNumber(value) {
    var result = Number(value);
    return Number.isFinite(result) ? result : 0;
  }

  function toOptionalNumber(value) {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    var result = Number(value);
    return Number.isFinite(result) ? result : null;
  }

  function toBoolean(value) {
    var normalized = String(value || "").trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "y" || normalized === "是";
  }

  function trimDecimal(value) {
    if (!Number.isFinite(value)) {
      return "-";
    }

    if (Math.abs(value) >= 100) {
      return String(Math.round(value));
    }

    if (Math.abs(value) >= 10) {
      return value.toFixed(1).replace(/\.0$/, "");
    }

    return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
