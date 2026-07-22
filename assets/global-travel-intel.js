(function () {
  "use strict";

  var pageRoot = document.querySelector("[data-travel-intel-page]");
  var mapChart = null;
  var currentView = null;
  var hasBoundResize = false;
  var lastSelectedCode = null;
  var hoverCardHideTimer = 0;
  var isHoverCardHovered = false;
  var HOVER_CARD_HIDE_DELAY = 600;
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
    opportunities: dataPrefix + "travel_intel_opportunities.csv",
    expos: dataPrefix + "travel_intel_expos.csv"
  };

  var store = null;
  var state = {
    region: "全部",
    language: "全部",
    category: "全部",
    activeCountryCode: null,
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
    loadCsv(dataFiles.opportunities),
    loadCsv(dataFiles.expos)
  ])
    .then(function (results) {
      store = buildStore(results[0], results[1], results[2], results[3]);
      renderPage();
    })
    .catch(function (error) {
      renderState("全球化旅业信息数据加载失败，请检查 data 目录下的 travel_intel_*.csv 与本地服务。", true, error);
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

  function buildStore(countryRows, newsRows, opportunityRows, expoRows) {
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

    opportunityRows.forEach(function (item) {
      var country = countriesByCode[String(item.country_code || "").trim().toUpperCase()];

      if (!country) {
        return;
      }

      country.opportunities.push({
        opportunity_category: String(item.opportunity_category || "").trim() || "未分类",
        opportunity_title: String(item.opportunity_title || "").trim(),
        summary: String(item.summary || "").trim(),
        priority_level: String(item.priority_level || "").trim() || "观察"
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

    if (state.activeCountryCode && !visibleCountries.some(function (country) {
      return country.country_code === state.activeCountryCode;
    })) {
      state.activeCountryCode = null;
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
      buildSelectField("区域", "region", filters.regions, state.region),
      buildSelectField("官方语言", "language", filters.languages, state.language),
      buildSelectField("机会点类别", "category", filters.categories, state.category),
      '  </div>',
      '</section>',
      '<section class="travel-map-card section">',
      '  <div class="section-head">',
      '    <div class="section-title">主地图看板</div>',
      '  </div>',
      '  <div class="travel-map-shell">',
      '    <div class="travel-map-canvas" data-travel-map aria-label="世界地图"></div>',
      '    <div class="travel-map-overlay" data-travel-overlay></div>',
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
        cancelHoverCardHide();
        isHoverCardHovered = false;
        state.activeCountryCode = null;
        state.hoverCountryCode = null;
        renderPage();
      });
    });

    if (resetButton) {
      resetButton.addEventListener("click", function () {
        state.region = "全部";
        state.language = "全部";
        state.category = "全部";
        cancelHoverCardHide();
        isHoverCardHovered = false;
        state.activeCountryCode = null;
        state.hoverCountryCode = null;
        renderPage();
      });
    }
  }

  function initializeMap() {
    var mapNode = pageRoot.querySelector("[data-travel-map]");
    var shellNode = pageRoot.querySelector(".travel-map-shell");

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

      setFocusedCountry(code);
    });

    mapChart.on("mouseout", function (params) {
      var code = extractCountryCode(params);

      if (!code || state.hoverCountryCode !== code) {
        return;
      }

      state.hoverCountryCode = null;
      scheduleHoverCardHide();
    });

    mapChart.on("click", function (params) {
      var code = extractCountryCode(params);

      if (!code) {
        return;
      }

      setFocusedCountry(code);
    });

    mapChart.getZr().on("globalout", function () {
      state.hoverCountryCode = null;
      scheduleHoverCardHide();
    });

    if (shellNode) {
      shellNode.addEventListener("mouseleave", function () {
        isHoverCardHovered = false;
        clearFocusedCountry();
      });
    }

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
        selected: state.activeCountryCode === country.country_code
      };
    });
  }

  function syncMapSelection() {
    if (!mapChart || !currentView) {
      return;
    }

    if (lastSelectedCode === state.activeCountryCode) {
      return;
    }

    lastSelectedCode = state.activeCountryCode;
    mapChart.setOption({
      series: [
        {
          data: buildMapSeriesData(currentView.visibleCountries)
        }
      ]
    });
  }

  function syncHoverCard() {
    var overlayNode = pageRoot.querySelector("[data-travel-overlay]");

    if (!overlayNode || !currentView) {
      return;
    }

    var country = getFocusCountry(currentView.visibleCountries);
    overlayNode.innerHTML = buildHoverCard(country);
    bindHoverCardEvents(overlayNode);
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
      regions: ["全部"].concat(uniqueValues(countries, function (country) { return country.region_name; })),
      languages: ["全部"].concat(uniqueValues(countries, function (country) { return country.official_language; })),
      categories: ["全部"].concat(uniqueValues(countries, function (country) {
        return country.opportunities.map(function (item) { return item.opportunity_category; });
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
      if (state.region !== "全部" && country.region_name !== state.region) {
        return false;
      }

      if (state.language !== "全部" && country.official_language !== state.language) {
        return false;
      }

      if (state.category !== "全部") {
        var hasCategory = country.opportunities.some(function (item) {
          return item.opportunity_category === state.category;
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
      + Math.min(country.opportunities.length, 4) * 120
      + Math.min(country.expos.length, 4) * 70;
  }

  function extractCountryCode(params) {
    if (!params || !params.data || !params.data.countryCode) {
      return null;
    }

    return String(params.data.countryCode || "").trim().toUpperCase() || null;
  }

  function getFocusCountry(visibleCountries) {
    if (state.activeCountryCode) {
      return visibleCountries.find(function (country) {
        return country.country_code === state.activeCountryCode;
      }) || null;
    }

    return null;
  }

  function buildHoverCard(country) {
    if (!country) {
      return '';
    }

    var primaryNews = resolvePrimaryNews(country.news);
    var relatedNews = resolveRelatedNews(country.news, primaryNews);

    return [
      '<div class="travel-hover-card" tabindex="0">',
      '  <div class="travel-hover-head">',
      '    <div>',
      '      <div class="travel-hover-country">' + escapeHtml(country.country_name) + '</div>',
      '      <div class="travel-hover-meta">' + escapeHtml(country.region_name) + (country.sub_region_name ? ' / ' + escapeHtml(country.sub_region_name) : '') + ' / ' + escapeHtml(country.official_language) + '</div>',
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
      buildHoverOpportunitySection(country),
      buildHoverExpoSection(country),
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

  function buildHoverOpportunitySection(country) {
    var records = country.opportunities.slice(0, 2).map(function (item) {
      return [
        '<div class="travel-hover-record">',
        '  <div class="travel-hover-record-title">' + escapeHtml(item.opportunity_title || item.opportunity_category || "待补充") + '</div>',
        '  <div class="travel-hover-record-meta">' + escapeHtml(item.opportunity_category || "未分类") + ' / ' + escapeHtml(item.priority_level || "观察") + '</div>',
        '  <div class="travel-hover-record-copy">' + escapeHtml(item.summary || "待补充") + '</div>',
        '</div>'
      ].join("");
    }).join("");

    return [
      '<div class="travel-hover-section">',
      '  <div class="travel-hover-section-title">机会点信息</div>',
      '  <div class="travel-hover-copy">' + escapeHtml(country.opportunity_summary || "待补充") + '</div>',
      records ? '  <div class="travel-hover-list">' + records + '</div>' : '',
      !records ? '<div class="travel-hover-record empty-note">当前国家暂无机会点明细</div>' : '',
      '</div>'
    ].join("");
  }

  function buildHoverExpoSection(country) {
    if (!country.expos.length) {
      return [
        '<div class="travel-hover-section">',
        '  <div class="travel-hover-section-title">旅游业展会信息</div>',
        '  <div class="travel-hover-record empty-note">当前国家暂无展会数据</div>',
        '</div>'
      ].join("");
    }

    return [
      '<div class="travel-hover-section">',
      '  <div class="travel-hover-section-title">旅游业展会信息</div>',
      '  <div class="travel-hover-list">',
      country.expos.slice(0, 3).map(function (item) {
        return [
          '<div class="travel-hover-record">',
          '  <div class="travel-hover-record-title">' + escapeHtml(item.expo_name || "待补充") + '</div>',
          '  <div class="travel-hover-record-meta">' + escapeHtml(formatDateRange(item.expo_start_date, item.expo_end_date)) + (item.expo_city ? ' / ' + escapeHtml(item.expo_city) : '') + '</div>',
          '  <div class="travel-hover-record-copy">' + escapeHtml(item.expo_note || "待补充") + '</div>',
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

  function setFocusedCountry(code) {
    if (!code) {
      return;
    }

    cancelHoverCardHide();
    state.hoverCountryCode = code;
    state.activeCountryCode = code;
    syncMapSelection();
    syncHoverCard();
  }

  function clearFocusedCountry() {
    if (!state.activeCountryCode && !state.hoverCountryCode) {
      cancelHoverCardHide();
      return;
    }

    cancelHoverCardHide();
    state.activeCountryCode = null;
    state.hoverCountryCode = null;
    syncMapSelection();
    syncHoverCard();
  }

  function scheduleHoverCardHide() {
    if (isHoverCardHovered) {
      return;
    }

    cancelHoverCardHide();
    hoverCardHideTimer = window.setTimeout(function () {
      hoverCardHideTimer = 0;

      if (state.hoverCountryCode || isHoverCardHovered) {
        return;
      }

      clearFocusedCountry();
    }, HOVER_CARD_HIDE_DELAY);
  }

  function cancelHoverCardHide() {
    if (!hoverCardHideTimer) {
      return;
    }

    window.clearTimeout(hoverCardHideTimer);
    hoverCardHideTimer = 0;
  }

  function bindHoverCardEvents(overlayNode) {
    var cardNode = overlayNode.querySelector(".travel-hover-card");

    if (!cardNode) {
      return;
    }

    cardNode.addEventListener("mouseenter", function () {
      isHoverCardHovered = true;
      cancelHoverCardHide();
    });

    cardNode.addEventListener("mouseleave", function () {
      isHoverCardHovered = false;
      scheduleHoverCardHide();
    });
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
