(function () {
  "use strict";

  var pageRoot = document.querySelector("[data-travel-intel-page]");
  var mapChart = null;
  var currentView = null;
  var hasBoundResize = false;
  var lastSelectedCode = null;
  var worldMapRegionsCache = null;
  var worldMapFeaturesByCodeCache = null;
  var regionCodeCandidatesByNameCache = null;
  var worldMapName = "world-iso-a2";
  var regionDisplayNames = typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function"
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;
  var legacyRegionCodes = {
    AN: true,
    CS: true,
    DD: true,
    DY: true,
    FX: true,
    HV: true,
    NH: true,
    RH: true,
    SU: true,
    TP: true,
    UK: true,
    VD: true,
    YD: true,
    YU: true
  };
  var mapIsoCodeOverrides = {
    aland: "AX",
    "antigua and barb": "AG",
    "bosnia and herz": "BA",
    "br indian ocean ter": "IO",
    "cayman is": "KY",
    "central african rep": "CF",
    congo: "CG",
    "czech rep": "CZ",
    "dem rep congo": "CD",
    "dem rep korea": "KP",
    "dominican rep": "DO",
    "eq guinea": "GQ",
    "faeroe is": "FO",
    "falkland is": "FK",
    "fr polynesia": "PF",
    "fr s antarctic lands": "TF",
    "heard i and mcdonald is": "HM",
    korea: "KR",
    "lao pdr": "LA",
    macedonia: "MK",
    myanmar: "MM",
    "n cyprus": null,
    "n mariana is": "MP",
    palestine: "PS",
    "s geo and s sandw is": "GS",
    "s sudan": "SS",
    "saint helena": "SH",
    "saint lucia": "LC",
    "siachen glacier": null,
    "solomon is": "SB",
    "st vin and gren": "VC",
    swaziland: "SZ",
    turkey: "TR",
    "turks and caicos is": "TC",
    "u s virgin is": "VI",
    "w sahara": "EH"
  };
  var travelMapPalette = [
    "#ef476f",
    "#118ab2",
    "#ffd166",
    "#06d6a0",
    "#8338ec",
    "#fb8500",
    "#3a86ff",
    "#ff006e",
    "#2a9d8f",
    "#8ac926",
    "#f15bb5",
    "#ff7f51",
    "#4cc9f0",
    "#e76f51",
    "#577590"
  ];
  var travelProductLineDefinitions = [
    { key: "flight", label: "机票" },
    { key: "hotel", label: "酒店" },
    { key: "homestay", label: "民宿" },
    { key: "rail", label: "轨道交通" },
    { key: "car_rental", label: "租车" },
    { key: "vacation", label: "度假旅游" },
    { key: "cruise", label: "游轮" }
  ];
  var travelCountryTableColumns = [
    {
      key: "country_name",
      label: "国家",
      type: "string",
      getValue: function (country) { return country.country_name; },
      format: function (country) { return country.country_name || "-"; }
    },
    {
      key: "population_value",
      label: "人口",
      type: "number",
      getValue: function (country) { return country.population_value; },
      format: function (country) { return formatPopulation(country.population_value); }
    },
    {
      key: "population_growth_rate",
      label: "人口增速",
      type: "number",
      getValue: function (country) { return country.population_growth_rate; },
      format: function (country) { return formatPercent(country.population_growth_rate); }
    },
    {
      key: "gdp_display",
      label: "GDP",
      type: "metric-text",
      getValue: function (country) { return country.gdp_display; },
      format: function (country) { return country.gdp_display || "-"; }
    },
    {
      key: "inbound_travelers_annual",
      label: "年入境游人口数",
      type: "number",
      getValue: function (country) { return country.inbound_travelers_annual; },
      format: function (country) { return formatPopulation(country.inbound_travelers_annual); }
    },
    {
      key: "inbound_spend_cny_annual",
      label: "入境游消费金额",
      type: "number",
      getValue: function (country) { return country.inbound_spend_cny_annual; },
      format: function (country) { return formatCurrencyCny(country.inbound_spend_cny_annual); }
    },
    {
      key: "outbound_travelers_annual",
      label: "年出境游人口数",
      type: "number",
      getValue: function (country) { return country.outbound_travelers_annual; },
      format: function (country) { return formatPopulation(country.outbound_travelers_annual); }
    },
    {
      key: "outbound_spend_cny_annual",
      label: "出境游消费金额",
      type: "number",
      getValue: function (country) { return country.outbound_spend_cny_annual; },
      format: function (country) { return formatCurrencyCny(country.outbound_spend_cny_annual); }
    },
    {
      key: "domestic_travelers_annual",
      label: "年境内游人口数",
      type: "number",
      getValue: function (country) { return country.domestic_travelers_annual; },
      format: function (country) { return formatPopulation(country.domestic_travelers_annual); }
    },
    {
      key: "domestic_spend_cny_annual",
      label: "境内游消费金额",
      type: "number",
      getValue: function (country) { return country.domestic_spend_cny_annual; },
      format: function (country) { return formatCurrencyCny(country.domestic_spend_cny_annual); }
    }
  ].concat(travelProductLineDefinitions.reduce(function (result, definition) {
    result.push({
      key: definition.key + "_spend_cny_annual",
      label: definition.label + "消费金额",
      type: "number",
      getValue: function (country) { return country[definition.key + "_spend_cny_annual"]; },
      format: function (country) { return formatCurrencyCny(country[definition.key + "_spend_cny_annual"]); }
    });
    result.push({
      key: definition.key + "_growth_rate",
      label: definition.label + "增速",
      type: "number",
      getValue: function (country) { return country[definition.key + "_growth_rate"]; },
      format: function (country) { return formatPercent(country[definition.key + "_growth_rate"]); }
    });
    return result;
  }, []));

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
    hoverCountryCode: null,
    tableSortKey: "country_name",
    tableSortDirection: "asc"
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
        gdp_display: String(item.gdp_display || "").trim(),
        currency: String(item.currency || "").trim(),
        inbound_travelers_annual: toOptionalNumber(item.inbound_travelers_annual),
        inbound_spend_cny_annual: toOptionalNumber(item.inbound_spend_cny_annual),
        outbound_travelers_annual: toOptionalNumber(item.outbound_travelers_annual),
        outbound_spend_cny_annual: toOptionalNumber(item.outbound_spend_cny_annual),
        domestic_travelers_annual: toOptionalNumber(item.domestic_travelers_annual),
        domestic_spend_cny_annual: toOptionalNumber(item.domestic_spend_cny_annual),
        travel_product_lines: buildTravelProductLines(item),
        flight_spend_cny_annual: toOptionalNumber(item.flight_spend_cny_annual),
        flight_growth_rate: toOptionalNumber(item.flight_growth_rate),
        hotel_spend_cny_annual: toOptionalNumber(item.hotel_spend_cny_annual),
        hotel_growth_rate: toOptionalNumber(item.hotel_growth_rate),
        homestay_spend_cny_annual: toOptionalNumber(item.homestay_spend_cny_annual),
        homestay_growth_rate: toOptionalNumber(item.homestay_growth_rate),
        rail_spend_cny_annual: toOptionalNumber(item.rail_spend_cny_annual),
        rail_growth_rate: toOptionalNumber(item.rail_growth_rate),
        car_rental_spend_cny_annual: toOptionalNumber(item.car_rental_spend_cny_annual),
        car_rental_growth_rate: toOptionalNumber(item.car_rental_growth_rate),
        vacation_spend_cny_annual: toOptionalNumber(item.vacation_spend_cny_annual),
        vacation_growth_rate: toOptionalNumber(item.vacation_growth_rate),
        cruise_spend_cny_annual: toOptionalNumber(item.cruise_spend_cny_annual),
        cruise_growth_rate: toOptionalNumber(item.cruise_growth_rate),
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

  function buildTravelProductLines(item) {
    return travelProductLineDefinitions.map(function (definition) {
      return {
        key: definition.key,
        label: definition.label,
        spend_cny_annual: toOptionalNumber(item[definition.key + "_spend_cny_annual"]),
        growth_rate: toOptionalNumber(item[definition.key + "_growth_rate"])
      };
    });
  }

  function renderPage() {
    if (!ensureChartRuntime()) {
      return;
    }

    ensureCountryColorAssignments();

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
      '<section class="travel-map-card section">',
      '  <div class="section-head travel-map-toolbar">',
      '    <div class="section-title">主地图看板</div>',
      '    <div class="travel-map-toolbar-actions">',
      buildSelectField("官方语言", "language", filters.languages, state.language),
      buildSelectField("商机 / 线索类型", "category", filters.categories, state.category),
      '      <button type="button" class="travel-reset-btn" data-travel-action="reset">重置</button>',
      '    </div>',
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

    if (!ensureIsoWorldMap()) {
      renderState("ECharts 世界地图未能生成 ISO_A2 属性，请检查 assets/vendor/echarts-world.js。", true);
      return false;
    }

    return true;
  }

  function bindEvents() {
    var filterNodes = pageRoot.querySelectorAll("[data-travel-filter]");
    var resetButton = pageRoot.querySelector("[data-travel-action='reset']");
    var panelNode = pageRoot.querySelector("[data-travel-info]");

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

    if (panelNode) {
      panelNode.addEventListener("click", function (event) {
        var sortTrigger = event.target.closest("[data-travel-sort-key]");
        if (sortTrigger) {
          updateTableSort(sortTrigger.getAttribute("data-travel-sort-key"));
          syncHoverCard();
          return;
        }

        var rowNode = event.target.closest("[data-travel-country-row]");
        if (rowNode) {
          toggleLockedCountryFromTable(rowNode.getAttribute("data-travel-country-row"));
        }
      });

      panelNode.addEventListener("keydown", function (event) {
        var rowNode = event.target.closest("[data-travel-country-row]");
        if (!rowNode) {
          return;
        }

        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        event.preventDefault();
        toggleLockedCountryFromTable(rowNode.getAttribute("data-travel-country-row"));
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
        clearActiveCountryState();
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

    mapChart.getZr().on("click", function (event) {
      if (event && event.target) {
        return;
      }

      clearActiveCountryState();
    });

    if (!hasBoundResize) {
      hasBoundResize = true;
      window.addEventListener("resize", handleWindowResize);
    }
  }

  function buildMapOption(visibleCountries) {
    return {
      animation: false,
      tooltip: {
        show: false
      },
      series: [
        {
          type: "map",
          map: worldMapName,
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
          nameProperty: "ISO_A2",
          label: {
            show: false
          },
          itemStyle: {
            areaColor: "#ddd7cc",
            borderColor: "#ffffff",
            borderWidth: 1
          },
          emphasis: {
            label: {
              show: false
            },
            itemStyle: {
              borderColor: "#ffffff",
              borderWidth: 1.8,
              shadowBlur: 18,
              shadowColor: "rgba(41, 51, 67, 0.2)"
            }
          },
          blur: {
            itemStyle: {
              opacity: 0.85
            }
          },
          select: {
            label: {
              show: false
            },
            itemStyle: {
              borderColor: "#ffffff",
              borderWidth: 2.1,
              shadowBlur: 22,
              shadowColor: "rgba(41, 51, 67, 0.26)"
            }
          },
          data: buildMapSeriesData(visibleCountries)
        }
      ]
    };
  }

  function buildMapSeriesData(visibleCountries) {
    return visibleCountries.map(function (country, index) {
      var baseColor = getCountryMapColor(country, index);

      return {
        name: country.country_code,
        value: getCountryMapValue(country),
        countryCode: country.country_code,
        selected: state.lockedCountryCode === country.country_code,
        itemStyle: {
          areaColor: baseColor,
          borderColor: "#ffffff",
          borderWidth: 1.15
        },
        emphasis: {
          itemStyle: {
            areaColor: shiftColor(baseColor, 0.1),
            borderColor: "#ffffff",
            borderWidth: 1.9
          }
        },
        select: {
          itemStyle: {
            areaColor: shiftColor(baseColor, -0.1),
            borderColor: "#ffffff",
            borderWidth: 2.1
          }
        }
      };
    });
  }

  function ensureCountryColorAssignments() {
    if (!store) {
      return;
    }

    if (store.countryColorByCode) {
      return;
    }

    store.countryColorByCode = buildCountryColorAssignments(store.countries.filter(canRenderOnMap));
  }

  function buildCountryColorAssignments(countries) {
    var assignments = {};
    var adjacencyByCode = buildCountryAdjacencyGraph(countries);
    var assignedIndexes = {};
    var paletteUsage = {};
    var countriesByCode = indexCountriesByCode(countries);
    var sortedCountries = countries.slice().sort(function (left, right) {
      var leftDegree = countObjectKeys(adjacencyByCode[left.country_code]);
      var rightDegree = countObjectKeys(adjacencyByCode[right.country_code]);

      if (leftDegree !== rightDegree) {
        return rightDegree - leftDegree;
      }

      var valueDelta = getCountryMapValue(right) - getCountryMapValue(left);
      if (valueDelta !== 0) {
        return valueDelta;
      }

      if (left.display_order !== right.display_order) {
        return left.display_order - right.display_order;
      }

      return hashCountryCode(left.country_code) - hashCountryCode(right.country_code);
    });

    sortedCountries.forEach(function (country) {
      var code = country.country_code;
      var neighborIndexes = collectAssignedNeighborIndexes(code, adjacencyByCode, assignedIndexes);
      var paletteIndex = pickPaletteIndex(code, neighborIndexes, paletteUsage);

      assignedIndexes[code] = paletteIndex;
      paletteUsage[paletteIndex] = (paletteUsage[paletteIndex] || 0) + 1;
    });

    Object.keys(assignedIndexes).forEach(function (code) {
      assignments[code] = travelMapPalette[assignedIndexes[code]];
    });

    Object.keys(countriesByCode).forEach(function (code) {
      if (!assignments[code]) {
        assignments[code] = travelMapPalette[hashCountryCode(code) % travelMapPalette.length];
      }
    });

    return assignments;
  }

  function buildCountryAdjacencyGraph(countries) {
    var adjacencyByCode = {};
    var regions = getWorldMapRegions();
    var regionsByCode = {};
    var segmentOwners = {};
    var pointOwners = {};
    var sharedPointCounts = {};

    countries.forEach(function (country) {
      adjacencyByCode[country.country_code] = {};
    });

    regions.forEach(function (region) {
      var code = String(region && region.isoA2 || "").trim().toUpperCase();
      if (code) {
        regionsByCode[code] = region;
      }
    });

    countries.forEach(function (country) {
      var code = country.country_code;
      var region = code ? regionsByCode[code] : null;

      if (!code || !region) {
        return;
      }

      collectRegionRings(region).forEach(function (ring) {
        var normalizedRing = ring.slice();

        if (normalizedRing.length >= 2 && buildPointKey(normalizedRing[0]) === buildPointKey(normalizedRing[normalizedRing.length - 1])) {
          normalizedRing.pop();
        }

        if (normalizedRing.length < 2) {
          return;
        }

        normalizedRing.forEach(function (point) {
          addOwner(pointOwners, buildPointKey(point), code);
        });

        for (var index = 0; index < normalizedRing.length; index += 1) {
          var currentPoint = normalizedRing[index];
          var nextPoint = normalizedRing[(index + 1) % normalizedRing.length];
          addOwner(segmentOwners, buildSegmentKey(currentPoint, nextPoint), code);
        }
      });
    });

    Object.keys(segmentOwners).forEach(function (segmentKey) {
      var owners = Object.keys(segmentOwners[segmentKey] || {});

      for (var leftIndex = 0; leftIndex < owners.length; leftIndex += 1) {
        for (var rightIndex = leftIndex + 1; rightIndex < owners.length; rightIndex += 1) {
          connectCountries(adjacencyByCode, owners[leftIndex], owners[rightIndex]);
        }
      }
    });

    Object.keys(pointOwners).forEach(function (pointKey) {
      var owners = Object.keys(pointOwners[pointKey] || {});

      for (var leftIndex = 0; leftIndex < owners.length; leftIndex += 1) {
        for (var rightIndex = leftIndex + 1; rightIndex < owners.length; rightIndex += 1) {
          var pairKey = owners[leftIndex] < owners[rightIndex]
            ? owners[leftIndex] + "|" + owners[rightIndex]
            : owners[rightIndex] + "|" + owners[leftIndex];
          sharedPointCounts[pairKey] = (sharedPointCounts[pairKey] || 0) + 1;
        }
      }
    });

    Object.keys(sharedPointCounts).forEach(function (pairKey) {
      if (sharedPointCounts[pairKey] < 2) {
        return;
      }

      var parts = pairKey.split("|");
      connectCountries(adjacencyByCode, parts[0], parts[1]);
    });

    return adjacencyByCode;
  }

  function getWorldMapRegions() {
    if (worldMapRegionsCache) {
      return worldMapRegionsCache;
    }

    if (!ensureIsoWorldMap()) {
      worldMapRegionsCache = [];
      return worldMapRegionsCache;
    }

    if (!window.echarts || typeof window.echarts.getMap !== "function") {
      worldMapRegionsCache = [];
      return worldMapRegionsCache;
    }

    var mapRecord = window.echarts.getMap(worldMapName);
    var rawGeoJson = mapRecord && (mapRecord.geoJSON || mapRecord.geoJson);
    var parser = window.echarts.parseGeoJSON || window.echarts.parseGeoJson;

    if (!rawGeoJson || typeof parser !== "function") {
      worldMapRegionsCache = [];
      return worldMapRegionsCache;
    }

    try {
      worldMapRegionsCache = parser(rawGeoJson) || [];
      worldMapRegionsCache.forEach(function (region, index) {
        var feature = rawGeoJson.features && rawGeoJson.features[index];
        var code = String(feature && feature.properties && feature.properties.ISO_A2 || "").trim().toUpperCase();
        region.isoA2 = code || null;
      });
    } catch (error) {
      worldMapRegionsCache = [];
    }

    return worldMapRegionsCache;
  }

  function collectRegionRings(region) {
    var rings = [];

    if (!region) {
      return rings;
    }

    if (Array.isArray(region.geometries)) {
      region.geometries.forEach(function (geometry) {
        if (!geometry) {
          return;
        }

        if (Array.isArray(geometry.exterior)) {
          rings.push(geometry.exterior);
        }

        if (Array.isArray(geometry.interiors)) {
          geometry.interiors.forEach(function (interior) {
            if (Array.isArray(interior)) {
              rings.push(interior);
            }
          });
        }

        if (Array.isArray(geometry.coordinates)) {
          collectCoordinateRings(geometry.coordinates, rings);
        }
      });
    } else if (Array.isArray(region.coordinates)) {
      collectCoordinateRings(region.coordinates, rings);
    }

    return rings.filter(function (ring) {
      return Array.isArray(ring) && ring.length >= 2;
    });
  }

  function collectCoordinateRings(coordinates, target) {
    if (!Array.isArray(coordinates) || !coordinates.length) {
      return;
    }

    if (isCoordinateRing(coordinates)) {
      target.push(coordinates);
      return;
    }

    coordinates.forEach(function (item) {
      collectCoordinateRings(item, target);
    });
  }

  function isCoordinateRing(value) {
    return Array.isArray(value)
      && value.length >= 2
      && Array.isArray(value[0])
      && value[0].length >= 2
      && typeof value[0][0] === "number"
      && typeof value[0][1] === "number";
  }

  function addOwner(target, key, owner) {
    if (!key || !owner) {
      return;
    }

    if (!target[key]) {
      target[key] = {};
    }

    target[key][owner] = true;
  }

  function connectCountries(adjacencyByCode, leftCode, rightCode) {
    if (!leftCode || !rightCode || leftCode === rightCode) {
      return;
    }

    if (!adjacencyByCode[leftCode]) {
      adjacencyByCode[leftCode] = {};
    }

    if (!adjacencyByCode[rightCode]) {
      adjacencyByCode[rightCode] = {};
    }

    adjacencyByCode[leftCode][rightCode] = true;
    adjacencyByCode[rightCode][leftCode] = true;
  }

  function buildPointKey(point) {
    if (!Array.isArray(point) || point.length < 2) {
      return "";
    }

    return quantizeCoordinate(point[0]) + ":" + quantizeCoordinate(point[1]);
  }

  function buildSegmentKey(leftPoint, rightPoint) {
    var leftKey = buildPointKey(leftPoint);
    var rightKey = buildPointKey(rightPoint);

    if (!leftKey || !rightKey) {
      return "";
    }

    return leftKey < rightKey
      ? leftKey + "|" + rightKey
      : rightKey + "|" + leftKey;
  }

  function quantizeCoordinate(value) {
    var numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
      return 0;
    }

    return Math.round(numericValue * 1000);
  }

  function countObjectKeys(object) {
    return object ? Object.keys(object).length : 0;
  }

  function collectAssignedNeighborIndexes(code, adjacencyByCode, assignedIndexes) {
    var result = [];
    var seenIndexes = {};
    var neighbors = adjacencyByCode[code] || {};

    Object.keys(neighbors).forEach(function (neighborCode) {
      if (assignedIndexes[neighborCode] === undefined) {
        return;
      }

      var paletteIndex = assignedIndexes[neighborCode];
      if (seenIndexes[paletteIndex]) {
        return;
      }

      seenIndexes[paletteIndex] = true;
      result.push(paletteIndex);
    });

    return result;
  }

  function pickPaletteIndex(code, neighborIndexes, paletteUsage) {
    var bestCandidate = null;

    for (var paletteIndex = 0; paletteIndex < travelMapPalette.length; paletteIndex += 1) {
      var candidate = scorePaletteIndex(code, paletteIndex, neighborIndexes, paletteUsage);

      if (!bestCandidate || isBetterPaletteCandidate(candidate, bestCandidate)) {
        bestCandidate = candidate;
      }
    }

    return bestCandidate ? bestCandidate.index : getPreferredPaletteIndex(code);
  }

  function scorePaletteIndex(code, paletteIndex, neighborIndexes, paletteUsage) {
    var conflicts = 0;
    var minDistance = Number.POSITIVE_INFINITY;
    var totalDistance = 0;

    neighborIndexes.forEach(function (neighborIndex) {
      if (neighborIndex === paletteIndex) {
        conflicts += 1;
      }

      var distance = getPaletteColorDistance(paletteIndex, neighborIndex);
      minDistance = Math.min(minDistance, distance);
      totalDistance += distance;
    });

    if (!neighborIndexes.length) {
      minDistance = Number.POSITIVE_INFINITY;
    }

    return {
      index: paletteIndex,
      conflicts: conflicts,
      minDistance: minDistance,
      totalDistance: totalDistance,
      usage: paletteUsage[paletteIndex] || 0,
      preferredOffset: getPaletteIndexOffset(paletteIndex, getPreferredPaletteIndex(code))
    };
  }

  function isBetterPaletteCandidate(candidate, currentBest) {
    if (candidate.conflicts !== currentBest.conflicts) {
      return candidate.conflicts < currentBest.conflicts;
    }

    if (candidate.minDistance !== currentBest.minDistance) {
      return candidate.minDistance > currentBest.minDistance;
    }

    if (candidate.totalDistance !== currentBest.totalDistance) {
      return candidate.totalDistance > currentBest.totalDistance;
    }

    if (candidate.usage !== currentBest.usage) {
      return candidate.usage < currentBest.usage;
    }

    if (candidate.preferredOffset !== currentBest.preferredOffset) {
      return candidate.preferredOffset < currentBest.preferredOffset;
    }

    return candidate.index < currentBest.index;
  }

  function getPaletteColorDistance(leftIndex, rightIndex) {
    var leftColor = parseHexColor(travelMapPalette[leftIndex]);
    var rightColor = parseHexColor(travelMapPalette[rightIndex]);
    var redDelta = leftColor[0] - rightColor[0];
    var greenDelta = leftColor[1] - rightColor[1];
    var blueDelta = leftColor[2] - rightColor[2];

    return Math.sqrt(redDelta * redDelta + greenDelta * greenDelta + blueDelta * blueDelta);
  }

  function parseHexColor(hex) {
    var normalized = String(hex || "").replace("#", "");

    if (normalized.length !== 6) {
      return [0, 0, 0];
    }

    return [
      parseInt(normalized.slice(0, 2), 16),
      parseInt(normalized.slice(2, 4), 16),
      parseInt(normalized.slice(4, 6), 16)
    ];
  }

  function getPreferredPaletteIndex(code) {
    return hashCountryCode(code) % travelMapPalette.length;
  }

  function getPaletteIndexOffset(leftIndex, rightIndex) {
    var directDistance = Math.abs(leftIndex - rightIndex);
    return Math.min(directDistance, travelMapPalette.length - directDistance);
  }

  function getCountryMapColor(country, index) {
    var code = String(country.country_code || "").toUpperCase();

    if (store && store.countryColorByCode && store.countryColorByCode[code]) {
      return store.countryColorByCode[code];
    }

    return travelMapPalette[hashCountryCode(code || String(index)) % travelMapPalette.length];
  }

  function hashCountryCode(code) {
    var value = 0;
    var normalized = String(code || "");

    for (var index = 0; index < normalized.length; index += 1) {
      value = (value * 33 + normalized.charCodeAt(index)) >>> 0;
    }

    return value;
  }

  function shiftColor(hex, amount) {
    var normalized = String(hex || "").replace("#", "");

    if (normalized.length !== 6) {
      return hex;
    }

    var red = parseInt(normalized.slice(0, 2), 16);
    var green = parseInt(normalized.slice(2, 4), 16);
    var blue = parseInt(normalized.slice(4, 6), 16);
    var target = amount >= 0 ? 255 : 0;
    var ratio = Math.min(Math.abs(amount), 1);

    red = Math.round(red + (target - red) * ratio);
    green = Math.round(green + (target - green) * ratio);
    blue = Math.round(blue + (target - blue) * ratio);

    return "#" + [red, green, blue].map(function (value) {
      return value.toString(16).padStart(2, "0");
    }).join("");
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

    var country = getDisplayedCountry(currentView.filteredCountries);
    panelNode.innerHTML = country
      ? buildHoverCard(country)
      : buildHoverEmptyState(currentView.filteredCountries);
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
    var code = String(country && country.country_code || "").trim().toUpperCase();
    return !!country.map_enabled_flag && !!code && !!getWorldMapFeatureByCode(code);
  }

  function ensureIsoWorldMap() {
    if (!window.echarts || typeof window.echarts.getMap !== "function" || typeof window.echarts.registerMap !== "function") {
      return false;
    }

    if (window.echarts.getMap(worldMapName)) {
      return true;
    }

    var mapRecord = window.echarts.getMap("world");
    var rawGeoJson = mapRecord && (mapRecord.geoJSON || mapRecord.geoJson);

    if (!rawGeoJson || !Array.isArray(rawGeoJson.features)) {
      return false;
    }

    var clonedGeoJson = {};
    Object.keys(rawGeoJson).forEach(function (key) {
      if (key !== "features") {
        clonedGeoJson[key] = rawGeoJson[key];
      }
    });

    clonedGeoJson.features = rawGeoJson.features.map(function (feature) {
      var clonedFeature = {};
      var properties = {};

      Object.keys(feature || {}).forEach(function (key) {
        if (key !== "properties") {
          clonedFeature[key] = feature[key];
        }
      });

      Object.keys(feature && feature.properties || {}).forEach(function (key) {
        properties[key] = feature.properties[key];
      });

      properties.ISO_A2 = resolveRegionCodeByMapName(properties.name);
      clonedFeature.properties = properties;

      return clonedFeature;
    });

    window.echarts.registerMap(worldMapName, clonedGeoJson);
    worldMapRegionsCache = null;
    worldMapFeaturesByCodeCache = null;

    return !!window.echarts.getMap(worldMapName);
  }

  function getWorldMapFeatureByCode(code) {
    var normalizedCode = String(code || "").trim().toUpperCase();

    if (!normalizedCode) {
      return null;
    }

    return getWorldMapFeaturesByCode()[normalizedCode] || null;
  }

  function getWorldMapFeaturesByCode() {
    if (worldMapFeaturesByCodeCache) {
      return worldMapFeaturesByCodeCache;
    }

    if (!ensureIsoWorldMap()) {
      worldMapFeaturesByCodeCache = {};
      return worldMapFeaturesByCodeCache;
    }

    var mapRecord = window.echarts.getMap(worldMapName);
    var rawGeoJson = mapRecord && (mapRecord.geoJSON || mapRecord.geoJson);
    var featuresByCode = {};

    if (!rawGeoJson || !Array.isArray(rawGeoJson.features)) {
      worldMapFeaturesByCodeCache = featuresByCode;
      return worldMapFeaturesByCodeCache;
    }

    rawGeoJson.features.forEach(function (feature) {
      var code = String(feature && feature.properties && feature.properties.ISO_A2 || "").trim().toUpperCase();

      if (code && !featuresByCode[code]) {
        featuresByCode[code] = feature;
      }
    });

    worldMapFeaturesByCodeCache = featuresByCode;
    return worldMapFeaturesByCodeCache;
  }

  function resolveRegionCodeByMapName(name) {
    var normalizedName = normalizeRegionName(name);

    if (!normalizedName) {
      return null;
    }

    if (Object.prototype.hasOwnProperty.call(mapIsoCodeOverrides, normalizedName)) {
      return mapIsoCodeOverrides[normalizedName];
    }

    var candidates = buildRegionCodeCandidatesByName()[normalizedName] || [];
    return pickPreferredRegionCode(candidates);
  }

  function buildRegionCodeCandidatesByName() {
    if (regionCodeCandidatesByNameCache) {
      return regionCodeCandidatesByNameCache;
    }

    var candidatesByName = {};

    if (!regionDisplayNames) {
      regionCodeCandidatesByNameCache = candidatesByName;
      return regionCodeCandidatesByNameCache;
    }

    for (var firstCode = 65; firstCode <= 90; firstCode += 1) {
      for (var secondCode = 65; secondCode <= 90; secondCode += 1) {
        var regionCode = String.fromCharCode(firstCode, secondCode);
        var regionName = null;

        try {
          regionName = regionDisplayNames.of(regionCode);
        } catch (error) {
          regionName = null;
        }

        if (!regionName || regionName === regionCode) {
          continue;
        }

        var normalizedName = normalizeRegionName(regionName);

        if (!normalizedName) {
          continue;
        }

        if (!candidatesByName[normalizedName]) {
          candidatesByName[normalizedName] = [];
        }

        candidatesByName[normalizedName].push(regionCode);
      }
    }

    regionCodeCandidatesByNameCache = candidatesByName;
    return regionCodeCandidatesByNameCache;
  }

  function pickPreferredRegionCode(candidates) {
    if (!Array.isArray(candidates) || !candidates.length) {
      return null;
    }

    var filteredCodes = candidates.filter(function (code) {
      return !legacyRegionCodes[code];
    });

    if (filteredCodes.length === 1) {
      return filteredCodes[0];
    }

    if (filteredCodes.length > 1) {
      return null;
    }

    return candidates.length === 1 ? candidates[0] : null;
  }

  function normalizeRegionName(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, " and ")
      .replace(/[^a-zA-Z0-9]+/g, " ")
      .replace(/\bthe\b/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
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
      return buildHoverEmptyState(currentView ? currentView.filteredCountries : []);
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
      buildHoverMetric("语言", country.official_language),
      buildHoverMetric("GDP", country.gdp_display || "-"),
      buildHoverMetric("币种", country.currency || "-"),
      buildHoverMetric("线索", country.leads.length ? String(country.leads.length) + " 条" : "-"),
      buildHoverMetric("商机", country.opportunities.length ? String(country.opportunities.length) + " 条" : "-"),
      '  </div>',
      buildHoverSection("国家关键数据", country.headline_metric || "待补充"),
      buildHoverSection("市场概况", country.tourism_overview || "待补充"),
      buildHoverTravelOverviewSection(country),
      buildHoverTravelProductLinesSection(country),
      buildHoverNewsSection("旅游业重要新闻信息", primaryNews),
      buildHoverNewsSection("关联的重要新闻信息", relatedNews),
      buildHoverBusinessSection(country),
      buildHoverExpoSection(country),
      '</div>'
    ].join("");
  }

  function buildHoverEmptyState(countries) {
    var visibleCountries = Array.isArray(countries) ? countries : [];
    var sortedCountries = sortCountriesForTable(visibleCountries);
    var columnCount = travelCountryTableColumns.length;

    return [
      '<div class="travel-info-table-state">',
      '  <div class="travel-info-table-head">',
      '    <div class="travel-info-empty-kicker">国家信息面板</div>',
      '    <div class="travel-info-empty-copy">当前未选中国家。将鼠标悬停到地图中的国家上可预览详情，点击地图中的国家或下表国家行可锁定对应信息；表头支持按各维度排序。当前展示 ' + escapeHtml(String(sortedCountries.length)) + ' 个国家。</div>',
      '  </div>',
      '  <div class="travel-info-table-scroll">',
      '    <table class="travel-country-table">',
      '      <thead>',
      '        <tr>',
      travelCountryTableColumns.map(buildCountryTableHeaderCell).join(""),
      '        </tr>',
      '      </thead>',
      '      <tbody>',
      sortedCountries.length
        ? sortedCountries.map(buildCountryTableRow).join("")
        : '<tr><td class="travel-country-table-empty" colspan="' + escapeHtml(String(columnCount)) + '">当前筛选条件下暂无国家数据</td></tr>',
      '      </tbody>',
      '    </table>',
      '  </div>',
      '</div>'
    ].join("");
  }

  function buildCountryTableHeaderCell(column) {
    var isActive = state.tableSortKey === column.key;
    var direction = isActive ? state.tableSortDirection : "";
    var sortLabel = direction === "asc" ? "升序" : direction === "desc" ? "降序" : "未排序";
    var indicator = direction === "asc" ? "↑" : direction === "desc" ? "↓" : "↕";
    var ariaSort = !isActive ? "none" : direction === "asc" ? "ascending" : "descending";

    return [
      '<th class="' + escapeHtml(column.key === "country_name" ? "travel-country-table-sticky" : "") + '" aria-sort="' + escapeHtml(ariaSort) + '">',
      '  <button type="button" class="travel-country-table-sort' + (isActive ? ' active' : '') + '" data-travel-sort-key="' + escapeHtml(column.key) + '" title="按' + escapeHtml(column.label) + sortLabel + '">',
      '    <span>' + escapeHtml(column.label) + '</span>',
      '    <span class="travel-country-table-sort-indicator">' + indicator + '</span>',
      '  </button>',
      '</th>'
    ].join("");
  }

  function buildCountryTableRow(country) {
    return [
      '<tr class="travel-country-table-row" data-travel-country-row="' + escapeHtml(country.country_code) + '" tabindex="0" role="button" aria-label="查看' + escapeHtml(country.country_name) + '详情">',
      travelCountryTableColumns.map(function (column) {
        return buildCountryTableCell(column, country);
      }).join(""),
      '</tr>'
    ].join("");
  }

  function buildCountryTableCell(column, country) {
    var formattedValue = column.format(country);
    var classNames = ["travel-country-table-cell"];

    if (column.key === "country_name") {
      classNames.push("travel-country-table-sticky");
      classNames.push("travel-country-table-country");
    } else if (column.type === "number") {
      classNames.push("mono");
    }

    return '<td class="' + escapeHtml(classNames.join(" ")) + '">' + escapeHtml(formattedValue || "-") + '</td>';
  }

  function updateTableSort(sortKey) {
    var column = getCountryTableColumn(sortKey);
    if (!column) {
      return;
    }

    if (state.tableSortKey === sortKey) {
      state.tableSortDirection = state.tableSortDirection === "asc" ? "desc" : "asc";
      return;
    }

    state.tableSortKey = sortKey;
    state.tableSortDirection = column.type === "string" ? "asc" : "desc";
  }

  function toggleLockedCountryFromTable(code) {
    if (!code) {
      return;
    }

    state.hoverCountryCode = null;
    toggleLockedCountry(code);
  }

  function sortCountriesForTable(countries) {
    var column = getCountryTableColumn(state.tableSortKey) || travelCountryTableColumns[0];
    var directionFactor = state.tableSortDirection === "asc" ? 1 : -1;

    return countries.slice().sort(function (left, right) {
      var result = compareCountryTableValues(left, right, column) * directionFactor;

      if (result !== 0) {
        return result;
      }

      if (left.display_order !== right.display_order) {
        return left.display_order - right.display_order;
      }

      return String(left.country_name || "").localeCompare(String(right.country_name || ""), "zh-CN");
    });
  }

  function compareCountryTableValues(leftCountry, rightCountry, column) {
    var leftValue = getComparableCountryTableValue(leftCountry, column);
    var rightValue = getComparableCountryTableValue(rightCountry, column);

    if (leftValue === null && rightValue === null) {
      return 0;
    }

    if (leftValue === null) {
      return 1;
    }

    if (rightValue === null) {
      return -1;
    }

    if (typeof leftValue === "number" && typeof rightValue === "number") {
      return leftValue - rightValue;
    }

    return String(leftValue).localeCompare(String(rightValue), "zh-CN");
  }

  function getComparableCountryTableValue(country, column) {
    var rawValue = column && typeof column.getValue === "function"
      ? column.getValue(country)
      : null;

    if (!hasValue(rawValue)) {
      return null;
    }

    if (column.type === "number") {
      return Number.isFinite(rawValue) ? rawValue : Number(rawValue);
    }

    if (column.type === "metric-text") {
      var numericValue = parseMetricDisplayValue(rawValue);
      return numericValue === null ? String(rawValue).trim() : numericValue;
    }

    return String(rawValue).trim();
  }

  function getCountryTableColumn(key) {
    return travelCountryTableColumns.find(function (column) {
      return column.key === key;
    }) || null;
  }

  function parseMetricDisplayValue(value) {
    var text = String(value || "").trim();
    if (!text) {
      return null;
    }

    var match = text.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
    if (!match) {
      return null;
    }

    var numericValue = Number(match[0]);
    if (!Number.isFinite(numericValue)) {
      return null;
    }

    var multiplier = 1;
    var normalized = text.toLowerCase();

    if (text.indexOf("万亿") !== -1 || normalized.indexOf("trillion") !== -1) {
      multiplier = 1000000000000;
    } else if (text.indexOf("千亿") !== -1) {
      multiplier = 100000000000;
    } else if (text.indexOf("百亿") !== -1) {
      multiplier = 10000000000;
    } else if (text.indexOf("亿") !== -1 || normalized.indexOf("billion") !== -1) {
      multiplier = 100000000;
    } else if (text.indexOf("百万") !== -1 || normalized.indexOf("million") !== -1) {
      multiplier = 1000000;
    } else if (text.indexOf("万") !== -1) {
      multiplier = 10000;
    }

    return numericValue * multiplier;
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

  function buildHoverTravelOverviewSection(country) {
    var items = [
      {
        label: "年入境游人口数",
        formattedValue: formatPopulation(country.inbound_travelers_annual),
        rawValue: country.inbound_travelers_annual
      },
      {
        label: "入境游消费金额",
        formattedValue: formatCurrencyCny(country.inbound_spend_cny_annual),
        rawValue: country.inbound_spend_cny_annual
      },
      {
        label: "年出境游人口数",
        formattedValue: formatPopulation(country.outbound_travelers_annual),
        rawValue: country.outbound_travelers_annual
      },
      {
        label: "出境游消费金额",
        formattedValue: formatCurrencyCny(country.outbound_spend_cny_annual),
        rawValue: country.outbound_spend_cny_annual
      },
      {
        label: "年境内游人口数",
        formattedValue: formatPopulation(country.domestic_travelers_annual),
        rawValue: country.domestic_travelers_annual
      },
      {
        label: "境内游消费金额",
        formattedValue: formatCurrencyCny(country.domestic_spend_cny_annual),
        rawValue: country.domestic_spend_cny_annual
      }
    ];

    if (!items.some(function (item) {
      return hasValue(item.rawValue);
    })) {
      return [
        '<div class="travel-hover-section">',
        '  <div class="travel-hover-section-title">基础信息与航旅数据</div>',
        '  <div class="travel-hover-record empty-note">当前国家暂未补充基础信息与航旅业年度数据</div>',
        '</div>'
      ].join("");
    }

    return [
      '<div class="travel-hover-section">',
      '  <div class="travel-hover-section-title">基础信息与航旅数据</div>',
      '  <div class="travel-hover-data-grid">',
      items.map(buildHoverDataCard).join(""),
      '  </div>',
      '</div>'
    ].join("");
  }

  function buildHoverTravelProductLinesSection(country) {
    var records = country.travel_product_lines.filter(function (item) {
      return hasValue(item.spend_cny_annual) || hasValue(item.growth_rate);
    }).map(buildHoverTravelProductRecord).join("");

    return [
      '<div class="travel-hover-section">',
      '  <div class="travel-hover-section-title">产品线消费与增速</div>',
      records || '<div class="travel-hover-record empty-note">当前国家暂未补充产品线年度消费与增速数据</div>',
      '</div>'
    ].join("");
  }

  function buildHoverDataCard(item) {
    return [
      '<div class="travel-hover-data-card">',
      '  <div class="travel-hover-data-label">' + escapeHtml(item.label || "待补充") + '</div>',
      '  <div class="travel-hover-data-value">' + escapeHtml(item.formattedValue || "-") + '</div>',
      '</div>'
    ].join("");
  }

  function buildHoverTravelProductRecord(item) {
    return [
      '<div class="travel-hover-record">',
      '  <div class="travel-hover-record-title">' + escapeHtml(item.label || "待补充") + '</div>',
      buildHoverRecordDetail("年消费金额（人民币）", formatCurrencyCny(item.spend_cny_annual)),
      buildHoverRecordDetail("年增长率", formatPercent(item.growth_rate)),
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

  function clearActiveCountryState() {
    if (!state.lockedCountryCode && !state.hoverCountryCode) {
      return;
    }

    state.lockedCountryCode = null;
    state.hoverCountryCode = null;
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

  function formatCurrencyCny(value) {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return "-";
    }

    if (Math.abs(value) >= 1000000000000) {
      return "¥" + trimDecimal(value / 1000000000000) + "万亿";
    }

    if (Math.abs(value) >= 100000000) {
      return "¥" + trimDecimal(value / 100000000) + "亿";
    }

    if (Math.abs(value) >= 10000) {
      return "¥" + trimDecimal(value / 10000) + "万";
    }

    return "¥" + trimDecimal(value);
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

  function hasValue(value) {
    return value !== null && value !== undefined && value !== "";
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
