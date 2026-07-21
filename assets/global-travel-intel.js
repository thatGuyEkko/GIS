(function () {
  "use strict";

  var pageRoot = document.querySelector("[data-travel-intel-page]");

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

  var defaultMapCountries = [
    { code: "US", name: "美国", cx: 216, cy: 190, labelDx: 0, labelDy: -18, size: "lg" },
    { code: "CA", name: "加拿大", cx: 196, cy: 106, labelDx: 0, labelDy: -16, size: "md" },
    { code: "BR", name: "巴西", cx: 306, cy: 304, labelDx: 0, labelDy: 24, size: "md" },
    { code: "GB", name: "英国", cx: 430, cy: 116, labelDx: 0, labelDy: -18, size: "sm" },
    { code: "FR", name: "法国", cx: 452, cy: 136, labelDx: 0, labelDy: 24, size: "sm" },
    { code: "AE", name: "阿联酋", cx: 586, cy: 186, labelDx: 0, labelDy: 24, size: "sm" },
    { code: "SA", name: "沙特阿拉伯", cx: 566, cy: 206, labelDx: 0, labelDy: 26, size: "sm" },
    { code: "JP", name: "日本", cx: 772, cy: 156, labelDx: 0, labelDy: -18, size: "sm" },
    { code: "KR", name: "韩国", cx: 740, cy: 154, labelDx: 0, labelDy: 24, size: "xs" },
    { code: "SG", name: "新加坡", cx: 686, cy: 258, labelDx: 0, labelDy: 24, size: "xs" },
    { code: "TH", name: "泰国", cx: 668, cy: 234, labelDx: 0, labelDy: 24, size: "xs" },
    { code: "AU", name: "澳大利亚", cx: 774, cy: 338, labelDx: 0, labelDy: 26, size: "md" }
  ];
  var mapLayoutByCode = {};
  var store = null;
  var state = {
    region: "全部",
    language: "全部",
    category: "全部",
    expoQuarter: "全部",
    activeCountryCode: null,
    hoverCountryCode: null
  };

  defaultMapCountries.forEach(function (item) {
    mapLayoutByCode[item.code] = item;
  });

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
        map_x: toOptionalNumber(item.map_x),
        map_y: toOptionalNumber(item.map_y),
        news: [],
        opportunities: [],
        expos: []
      };

      var layout = mapLayoutByCode[country.country_code];

      if (layout) {
        if (country.map_x === null) {
          country.map_x = layout.cx;
        }

        if (country.map_y === null) {
          country.map_y = layout.cy;
        }

        country.map_label_dx = layout.labelDx;
        country.map_label_dy = layout.labelDy;
        country.map_marker_size = layout.size;
      } else {
        country.map_label_dx = 0;
        country.map_label_dy = -18;
        country.map_marker_size = "sm";
      }

      if (country.display_order === null) {
        country.display_order = 9999;
      }

      if (country.map_x === null || country.map_y === null) {
        country.map_enabled_flag = false;
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
    var filters = deriveFilterOptions(store.countries);
    var filteredCountries = getFilteredCountries(store.countries);

    if (state.activeCountryCode && !filteredCountries.some(function (country) {
      return country.country_code === state.activeCountryCode;
    })) {
      state.activeCountryCode = null;
    }

    var activeCountry = getActiveCountry(filteredCountries);
    var visibleCountries = filteredCountries.filter(function (country) {
      return country.map_enabled_flag && hasMapPosition(country);
    });
    var mappedCountries = store.countries.filter(function (country) {
      return country.map_enabled_flag && hasMapPosition(country);
    });
    var regionCount = countDistinct(filteredCountries, "region_name");
    var languageCount = countDistinct(filteredCountries, "official_language");
    var opportunityCount = filteredCountries.reduce(function (sum, country) {
      return sum + country.opportunities.length;
    }, 0);
    var expoCount = filteredCountries.reduce(function (sum, country) {
      return sum + country.expos.length;
    }, 0);

    document.title = "OOMS | 全球化旅业信息看板";

    pageRoot.innerHTML = [
      '<div class="page-head">',
      '  <div>',
      '    <div class="page-kicker">模块零 / Global Travel Intelligence</div>',
      '    <h1 class="page-title">全球化旅业信息看板</h1>',
      '    <p class="page-sub">用一页地图聚合各国旅业基础面、热点新闻、机会点和行业展会。当前页面直接读取 `data/travel_intel_*.csv` 四份数据文件，维护 CSV 后刷新页面即可看到结果。</p>',
      '  </div>',
      '  <div class="head-aside">',
      '    <div class="summary-card summary-stack">',
      '      <div><div class="summary-label">当前数据源</div><div class="summary-strong">travel_intel_*.csv</div></div>',
      '      <div><div class="summary-key">可交互国家</div><div class="summary-meta mono">' + escapeHtml(String(visibleCountries.length)) + ' 个</div></div>',
      '      <div><div class="summary-key">录入方式</div><div class="summary-meta">国家、新闻、机会点、展会分别维护在 4 份 CSV 中</div></div>',
      '    </div>',
      '  </div>',
      '</div>',
      '<section class="travel-filter-card section">',
      '  <div class="section-head">',
      '    <div>',
      '      <div class="section-title">头部筛选栏</div>',
      '      <div class="section-sub">筛选项会同步影响地图上可交互国家，以及悬浮弹层中呈现的国家信息。</div>',
      '    </div>',
      '    <button type="button" class="travel-reset-btn" data-travel-action="reset">重置筛选</button>',
      '  </div>',
      '  <div class="travel-filter-grid">',
      buildSelectField("区域", "region", filters.regions, state.region),
      buildSelectField("官方语言", "language", filters.languages, state.language),
      buildSelectField("机会点类别", "category", filters.categories, state.category),
      buildSelectField("展会周期", "expoQuarter", filters.expoQuarters, state.expoQuarter),
      '  </div>',
      '</section>',
      '<section class="metrics">',
      buildMetricCard("筛选后国家数", String(filteredCountries.length), "purple", "当前筛选条件下可呈现信息的国家数"),
      buildMetricCard("覆盖区域", String(regionCount) + " 个", "blue", "按国家基础信息中的区域字段去重"),
      buildMetricCard("机会点条目", String(opportunityCount) + " 条", "green", "归属于筛选结果国家的机会点摘要"),
      buildMetricCard("展会信息", String(expoCount) + " 条", "orange", "归属于筛选结果国家的展会名称与时间"),
      '</section>',
      '<section class="travel-map-card section">',
      '  <div class="section-head">',
      '    <div>',
      '      <div class="section-title">主地图看板</div>',
      '      <div class="section-sub">只有底层有数据且命中过滤条件的国家会显示为可交互热点。鼠标悬浮即可查看该国家的完整信息。</div>',
      '    </div>',
      '  </div>',
      '  <div class="travel-map-shell">',
      buildWorldMapSvg(visibleCountries, mappedCountries),
      buildHoverCard(activeCountry, visibleCountries),
      '  </div>',
      '  <div class="travel-map-legend">',
      '    <span class="legend-item"><span class="legend-dot travel-legend-active"></span> 有数据且可交互</span>',
      '    <span class="legend-item"><span class="legend-dot travel-legend-muted"></span> 无数据或已被筛选隐藏</span>',
      '    <span class="legend-item"><span class="legend-dot travel-legend-focus"></span> 当前悬浮或选中国家</span>',
      '  </div>',
      '</section>',
      '<section class="info-panel section">',
      '  <div class="panel-title">数据文件说明</div>',
      '  <div class="list-block">',
      '    <div class="list-item"><div class="list-item-title">1. 国家基础信息</div><div class="list-item-copy">维护 `data/travel_intel_countries.csv`。一行一个国家，控制地图点位、人口、语言、摘要和筛选维度。</div></div>',
      '    <div class="list-item"><div class="list-item-title">2. 新闻与机会点</div><div class="list-item-copy">维护 `data/travel_intel_news.csv` 和 `data/travel_intel_opportunities.csv`。前者按国家挂新闻，后者按国家挂机会点摘要和分类。</div></div>',
      '    <div class="list-item"><div class="list-item-title">3. 展会信息</div><div class="list-item-copy">维护 `data/travel_intel_expos.csv`。页面会直接读取展会名称、时间、城市和说明，刷新页面即可看到最新结果。</div></div>',
      '  </div>',
      '</section>'
    ].join("");

    bindEvents(visibleCountries);
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
      }, true)),
      expoQuarters: ["全部"].concat(uniqueValues(countries, function (country) {
        return country.expos.map(function (item) { return item.expo_quarter; });
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

      if (state.expoQuarter !== "全部") {
        var hasQuarter = country.expos.some(function (item) {
          return item.expo_quarter === state.expoQuarter;
        });

        if (!hasQuarter) {
          return false;
        }
      }

      return true;
    });
  }

  function getActiveCountry(filteredCountries) {
    if (!state.activeCountryCode) {
      return null;
    }

    return filteredCountries.find(function (country) {
      return country.country_code === state.activeCountryCode;
    }) || null;
  }

  function getFocusCountry(activeCountry, visibleCountries) {
    if (state.hoverCountryCode) {
      return visibleCountries.find(function (country) {
        return country.country_code === state.hoverCountryCode;
      }) || activeCountry || null;
    }

    return activeCountry || null;
  }

  function buildWorldMapSvg(visibleCountries, mappedCountries) {
    var visibleByCode = {};
    var focusCode = state.hoverCountryCode || state.activeCountryCode;

    visibleCountries.forEach(function (country) {
      visibleByCode[country.country_code] = country;
    });

    return [
      '<svg class="travel-map-svg" viewBox="0 0 960 520" aria-label="世界地图">',
      '  <rect x="0" y="0" width="960" height="520" class="travel-map-ocean"></rect>',
      '  <g class="travel-map-land">',
      '    <path d="M118 104l46-30 72 18 38 30 30 10 24 34-6 34-46 18-24 48-52 8-42-22-12-38-48-38-10-36 30-36z"></path>',
      '    <path d="M274 276l40 14 26 42 24 80-16 48-38 12-26-52-18-88-8-30z"></path>',
      '    <path d="M404 86l52-16 78 10 56 42 8 34-40 32-36 8-10 20 24 30-16 26-44 8-34-16-26 6-34-20-26-46 4-40 32-34z"></path>',
      '    <path d="M540 186l54-6 50 18 72 8 52 40 22 46-24 36-74 10-44-18-26 10-22-30-44-16-26-54z"></path>',
      '    <path d="M734 338l56 8 52 20 34 42-28 26-72 8-54-20-18-42z"></path>',
      '    <path d="M728 128l34-14 34 16 2 34-24 12-24-4-18-22z"></path>',
      '  </g>',
      '  <g class="travel-map-grid">',
      '    <line x1="120" y1="52" x2="120" y2="458"></line>',
      '    <line x1="280" y1="52" x2="280" y2="458"></line>',
      '    <line x1="440" y1="52" x2="440" y2="458"></line>',
      '    <line x1="600" y1="52" x2="600" y2="458"></line>',
      '    <line x1="760" y1="52" x2="760" y2="458"></line>',
      '    <line x1="80" y1="120" x2="880" y2="120"></line>',
      '    <line x1="80" y1="220" x2="880" y2="220"></line>',
      '    <line x1="80" y1="320" x2="880" y2="320"></line>',
      '    <line x1="80" y1="420" x2="880" y2="420"></line>',
      '  </g>',
      '  <g class="travel-map-labels">',
      '    <text x="170" y="92">北美</text>',
      '    <text x="278" y="434">拉美</text>',
      '    <text x="448" y="84">欧洲</text>',
      '    <text x="588" y="174">中东</text>',
      '    <text x="694" y="224">亚洲</text>',
      '    <text x="764" y="430">大洋洲</text>',
      '  </g>',
      '  <g class="travel-map-hotspots">',
      mappedCountries.map(function (country) {
        var isVisible = !!visibleByCode[country.country_code];
        var isFocused = focusCode === country.country_code;
        var className = ["travel-map-hotspot", isVisible ? "travel-map-hotspot-active" : "travel-map-hotspot-muted", isFocused ? "travel-map-hotspot-selected" : ""].join(" ").trim();
        var radius = getMarkerRadius(country.map_marker_size);
        var labelY = country.map_y + country.map_label_dy;
        var labelX = country.map_x + country.map_label_dx;
        var attr = isVisible ? ' data-country-code="' + escapeHtml(country.country_code) + '" tabindex="0" role="button" aria-label="' + escapeHtml(country.country_name) + '"' : ' aria-hidden="true"';

        return [
          '<g class="' + escapeHtml(className) + '"' + attr + '>',
          '  <circle cx="' + escapeHtml(String(country.map_x)) + '" cy="' + escapeHtml(String(country.map_y)) + '" r="' + escapeHtml(String(radius)) + '"></circle>',
          '  <text x="' + escapeHtml(String(labelX)) + '" y="' + escapeHtml(String(labelY)) + '">' + escapeHtml(country.country_name) + '</text>',
          '</g>'
        ].join("");
      }).join(""),
      '  </g>',
      '</svg>'
    ].join("");
  }

  function buildHoverCard(activeCountry, visibleCountries) {
    var country = getFocusCountry(activeCountry, visibleCountries);

    if (!country) {
      return '<div class="travel-hover-card travel-hover-empty">移动到地图热点上查看国家详情。页面不会再在地图外部单独展示国家卡片。</div>';
    }

    var primaryNews = resolvePrimaryNews(country.news);
    var relatedNews = resolveRelatedNews(country.news, primaryNews);

    return [
      '<div class="travel-hover-card">',
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

  function bindEvents(visibleCountries) {
    var filterNodes = pageRoot.querySelectorAll("[data-travel-filter]");
    var resetButton = pageRoot.querySelector("[data-travel-action='reset']");
    var mapHotspots = pageRoot.querySelectorAll("[data-country-code]");
    var visibleByCode = {};

    visibleCountries.forEach(function (country) {
      visibleByCode[country.country_code] = true;
    });

    Array.prototype.forEach.call(filterNodes, function (node) {
      node.addEventListener("change", function (event) {
        var filterKey = event.target.getAttribute("data-travel-filter");
        state[filterKey] = event.target.value;
        state.hoverCountryCode = null;
        renderPage();
      });
    });

    if (resetButton) {
      resetButton.addEventListener("click", function () {
        state.region = "全部";
        state.language = "全部";
        state.category = "全部";
        state.expoQuarter = "全部";
        state.activeCountryCode = null;
        state.hoverCountryCode = null;
        renderPage();
      });
    }

    Array.prototype.forEach.call(mapHotspots, function (node) {
      var code = node.getAttribute("data-country-code");

      if (!visibleByCode[code]) {
        return;
      }

      node.addEventListener("mouseenter", function () {
        state.hoverCountryCode = code;
        renderPage();
      });

      node.addEventListener("mouseleave", function () {
        state.hoverCountryCode = null;
        renderPage();
      });

      node.addEventListener("focus", function () {
        state.hoverCountryCode = code;
        renderPage();
      });

      node.addEventListener("blur", function () {
        state.hoverCountryCode = null;
        renderPage();
      });

      node.addEventListener("click", function () {
        state.activeCountryCode = code;
        state.hoverCountryCode = code;
        renderPage();
      });
    });
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

  function renderState(message, isError, error) {
    document.title = "OOMS | 全球化旅业信息看板";
    pageRoot.innerHTML = [
      '<div class="page-state ' + (isError ? 'page-state-error' : '') + '">',
      '  <div class="page-state-title">' + escapeHtml(isError ? '页面未能完成渲染' : '页面准备中') + '</div>',
      '  <div class="page-state-copy">' + escapeHtml(message) + '</div>',
      error ? '  <div class="page-state-detail mono">' + escapeHtml(String(error.message || error)) + '</div>' : '',
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

  function countDistinct(items, key) {
    var values = {};

    items.forEach(function (item) {
      var value = String(item[key] || "").trim();
      if (value) {
        values[value] = true;
      }
    });

    return Object.keys(values).length;
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

  function hasMapPosition(country) {
    return Number.isFinite(country.map_x) && Number.isFinite(country.map_y);
  }

  function getMarkerRadius(size) {
    if (size === "lg") {
      return 14;
    }

    if (size === "md") {
      return 12;
    }

    if (size === "xs") {
      return 8;
    }

    return 10;
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
