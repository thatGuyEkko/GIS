(function () {
  "use strict";

  var pageRoot = document.querySelector("[data-travel-intel-page]");

  if (!pageRoot) {
    return;
  }

  var DATA_URL = "data/global-travel-intel.json";
  var defaultMapCountries = [
    { code: "US", name: "美国", region: "北美", cx: 216, cy: 190, labelDx: 0, labelDy: -18, size: "lg" },
    { code: "CA", name: "加拿大", region: "北美", cx: 196, cy: 106, labelDx: 0, labelDy: -16, size: "md" },
    { code: "BR", name: "巴西", region: "拉美", cx: 306, cy: 304, labelDx: 0, labelDy: 24, size: "md" },
    { code: "GB", name: "英国", region: "欧洲", cx: 430, cy: 116, labelDx: 0, labelDy: -18, size: "sm" },
    { code: "FR", name: "法国", region: "欧洲", cx: 452, cy: 136, labelDx: 0, labelDy: 24, size: "sm" },
    { code: "AE", name: "阿联酋", region: "中东", cx: 586, cy: 186, labelDx: 0, labelDy: 24, size: "sm" },
    { code: "SA", name: "沙特阿拉伯", region: "中东", cx: 566, cy: 206, labelDx: 0, labelDy: 26, size: "sm" },
    { code: "JP", name: "日本", region: "东北亚", cx: 772, cy: 156, labelDx: 0, labelDy: -18, size: "sm" },
    { code: "KR", name: "韩国", region: "东北亚", cx: 740, cy: 154, labelDx: 0, labelDy: 24, size: "xs" },
    { code: "SG", name: "新加坡", region: "东南亚", cx: 686, cy: 258, labelDx: 0, labelDy: 24, size: "xs" },
    { code: "TH", name: "泰国", region: "东南亚", cx: 668, cy: 234, labelDx: 0, labelDy: 24, size: "xs" },
    { code: "AU", name: "澳大利亚", region: "大洋洲", cx: 774, cy: 338, labelDx: 0, labelDy: 26, size: "md" }
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

  fetch(DATA_URL, { cache: "no-store" })
    .then(function (response) {
      if (!response.ok) {
        throw new Error("Failed to load " + DATA_URL + ": " + response.status);
      }

      return response.json();
    })
    .then(function (payload) {
      store = normalizeStore(payload);
      state.activeCountryCode = store.countries.length ? store.countries[0].country_code : null;
      renderPage();
    })
    .catch(function (error) {
      renderState("全球化旅业信息数据加载失败，请检查 data 目录和本地服务。", true, error);
    });

  function normalizeStore(payload) {
    var countries = (payload.countries || []).map(function (item) {
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

      if (country.map_x === null || country.map_y === null) {
        country.map_enabled_flag = false;
      }

      if (country.display_order === null) {
        country.display_order = 9999;
      }

      return country;
    }).sort(function (left, right) {
      return left.display_order - right.display_order || left.country_name.localeCompare(right.country_name, "zh-CN");
    });

    var countriesByCode = {};
    countries.forEach(function (item) {
      countriesByCode[item.country_code] = item;
    });

    (payload.news || []).forEach(function (item) {
      var code = String(item.country_code || "").trim().toUpperCase();
      var country = countriesByCode[code];
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

    (payload.opportunities || []).forEach(function (item) {
      var code = String(item.country_code || "").trim().toUpperCase();
      var country = countriesByCode[code];
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

    (payload.expos || []).forEach(function (item) {
      var code = String(item.country_code || "").trim().toUpperCase();
      var country = countriesByCode[code];
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
      countriesByCode: countriesByCode,
      metadata: payload.metadata || {}
    };
  }

  function renderPage() {
    var filters = deriveFilterOptions(store.countries);
    var filteredCountries = getFilteredCountries(store.countries);
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

    if (activeCountry) {
      state.activeCountryCode = activeCountry.country_code;
    }

    document.title = "OOMS | 全球化旅业信息看板";

    pageRoot.innerHTML = [
      '<div class="page-head">',
      '  <div>',
      '    <div class="page-kicker">模块零 / Global Travel Intelligence</div>',
      '    <h1 class="page-title">全球化旅业信息看板</h1>',
      '    <p class="page-sub">用一页地图聚合各国旅业基础面、热点新闻、机会点和行业展会。当前页面读取 `data/global-travel-intel.json`，该 JSON 由 Excel 模板导出，后续只需要补 Excel 即可完成验证。</p>',
      '  </div>',
      '  <div class="head-aside">',
      '    <div class="summary-card summary-stack">',
      '      <div><div class="summary-label">当前数据源</div><div class="summary-strong">global-travel-intel-template.xlsx</div></div>',
      '      <div><div class="summary-key">可交互国家</div><div class="summary-meta mono">' + escapeHtml(String(visibleCountries.length)) + ' 个</div></div>',
      '      <div><div class="summary-key">导出文件</div><div class="summary-meta">JSON 由脚本从 Excel 模板同步生成</div></div>',
      '    </div>',
      '  </div>',
      '</div>',
      '<section class="travel-filter-card section">',
      '  <div class="section-head">',
      '    <div>',
      '      <div class="section-title">头部筛选栏</div>',
      '      <div class="section-sub">筛选项会同步影响主地图上可交互国家、右侧国家信息卡和下方清单。</div>',
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
      '<section class="travel-board section">',
      '  <div class="travel-map-card">',
      '    <div class="section-head">',
      '      <div>',
      '        <div class="section-title">主地图看板</div>',
      '        <div class="section-sub">只有底层有数据且命中过滤条件的国家会显示为可交互热点，其余国家保持灰色底图。</div>',
      '      </div>',
      '    </div>',
      '    <div class="travel-map-shell">',
      buildWorldMapSvg(activeCountry, visibleCountries, mappedCountries),
      buildHoverCard(activeCountry, visibleCountries),
      '    </div>',
      '    <div class="travel-map-legend">',
      '      <span class="legend-item"><span class="legend-dot travel-legend-active"></span> 有数据且可交互</span>',
      '      <span class="legend-item"><span class="legend-dot travel-legend-muted"></span> 无数据或已被筛选隐藏</span>',
      '      <span class="legend-item"><span class="legend-dot travel-legend-focus"></span> 当前选中国家</span>',
      '    </div>',
      '  </div>',
      '  <div class="travel-side-column">',
      buildCountryCard(activeCountry),
      buildCountryList(filteredCountries),
      '  </div>',
      '</section>',
      '<section class="grid-2 section">',
      buildNewsPanel(activeCountry),
      buildExpoPanel(activeCountry),
      '</section>',
      '<section class="info-panel section">',
      '  <div class="panel-title">模板使用说明</div>',
      '  <div class="list-block">',
      '    <div class="list-item"><div class="list-item-title">1. 维护入口</div><div class="list-item-copy">请直接编辑 `data/global-travel-intel-template.xlsx`。它包含国家基础信息、旅业新闻、机会点、展会信息 4 张数据表，以及 1 张说明页。</div></div>',
      '    <div class="list-item"><div class="list-item-title">2. 导出步骤</div><div class="list-item-copy">编辑 Excel 后，运行 `python3 scripts/export_global_travel_intel.py`，脚本会把 Excel 导出成 `data/global-travel-intel.json` 供页面读取。</div></div>',
      '    <div class="list-item"><div class="list-item-title">3. 地图交互</div><div class="list-item-copy">国家是否能在地图上点亮，由 Excel 中的 `map_enabled_flag` 控制；`map_x` 和 `map_y` 会直接参与前端渲染，如果留空则对内置国家使用默认坐标。</div></div>',
      '  </div>',
      '</section>'
    ].join("");

    bindEvents(filteredCountries);
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
    var active = null;
    var activeCode = state.activeCountryCode;

    if (activeCode) {
      active = filteredCountries.find(function (country) {
        return country.country_code === activeCode;
      }) || null;
    }

    if (!active && filteredCountries.length) {
      active = filteredCountries[0];
    }

    return active;
  }

  function buildWorldMapSvg(activeCountry, visibleCountries, mappedCountries) {
    var visibleByCode = {};
    visibleCountries.forEach(function (country) {
      visibleByCode[country.country_code] = country;
    });

    var activeCode = activeCountry ? activeCountry.country_code : null;

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
        var isActive = activeCode === country.country_code;
        var className = ["travel-map-hotspot", isVisible ? "travel-map-hotspot-active" : "travel-map-hotspot-muted", isActive ? "travel-map-hotspot-selected" : ""].join(" ").trim();
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
    var hovered = null;
    var hoveredCode = state.hoverCountryCode;
    if (hoveredCode) {
      hovered = visibleCountries.find(function (country) {
        return country.country_code === hoveredCode;
      }) || null;
    }

    var country = hovered || activeCountry;
    if (!country) {
      return '<div class="travel-hover-card travel-hover-empty">移动到地图热点上查看国家摘要</div>';
    }

    return [
      '<div class="travel-hover-card">',
      '  <div class="travel-hover-country">' + escapeHtml(country.country_name) + '</div>',
      '  <div class="travel-hover-meta">' + escapeHtml(country.region_name) + ' / ' + escapeHtml(country.official_language) + '</div>',
      '  <div class="travel-hover-stats">',
      '    <div><span>人口</span><strong>' + escapeHtml(formatPopulation(country.population_value)) + '</strong></div>',
      '    <div><span>增速</span><strong>' + escapeHtml(formatPercent(country.population_growth_rate)) + '</strong></div>',
      '  </div>',
      '  <div class="travel-hover-copy">' + escapeHtml(country.opportunity_summary || country.tourism_overview || "暂无摘要") + '</div>',
      '</div>'
    ].join("");
  }

  function buildCountryCard(country) {
    if (!country) {
      return [
        '<div class="info-panel">',
        '  <div class="panel-title">国家信息卡片</div>',
        '  <div class="empty-note">当前筛选条件下暂无国家数据。</div>',
        '</div>'
      ].join("");
    }

    return [
      '<div class="info-panel">',
      '  <div class="panel-title">国家信息卡片</div>',
      '  <div class="travel-country-head">',
      '    <div>',
      '      <div class="travel-country-name">' + escapeHtml(country.country_name) + '</div>',
      '      <div class="travel-country-sub">' + escapeHtml(country.region_name) + (country.sub_region_name ? ' / ' + escapeHtml(country.sub_region_name) : '') + '</div>',
      '    </div>',
      '    <span class="tag ' + escapeHtml(getFocusTagClass(country.focus_level)) + '">' + escapeHtml(country.focus_level) + '</span>',
      '  </div>',
      '  <div class="travel-key-grid">',
      '    <div class="travel-key-item"><div class="travel-key-label">人口</div><div class="travel-key-value">' + escapeHtml(formatPopulation(country.population_value)) + '</div></div>',
      '    <div class="travel-key-item"><div class="travel-key-label">增长率</div><div class="travel-key-value">' + escapeHtml(formatPercent(country.population_growth_rate)) + '</div></div>',
      '    <div class="travel-key-item"><div class="travel-key-label">官方语言</div><div class="travel-key-value">' + escapeHtml(country.official_language) + '</div></div>',
      '    <div class="travel-key-item"><div class="travel-key-label">关键指标</div><div class="travel-key-value">' + escapeHtml(country.headline_metric || "待补充") + '</div></div>',
      '  </div>',
      '  <div class="travel-country-copy-group">',
      '    <div class="kv-item">',
      '      <div class="kv-label">旅游业重要新闻信息</div>',
      '      <div class="kv-value">' + escapeHtml(firstHeadline(country.news)) + '</div>',
      '    </div>',
      '    <div class="kv-item">',
      '      <div class="kv-label">关联的重要新闻信息</div>',
      '      <div class="kv-value">' + escapeHtml(secondHeadline(country.news)) + '</div>',
      '    </div>',
      '    <div class="kv-item">',
      '      <div class="kv-label">机会点信息</div>',
      '      <div class="kv-value">' + escapeHtml(country.opportunity_summary || "待补充") + '</div>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join("");
  }

  function buildCountryList(countries) {
    return [
      '<div class="info-panel">',
      '  <div class="panel-title">筛选后国家清单</div>',
      '  <div class="travel-country-list">',
      countries.map(function (country) {
        var active = state.activeCountryCode === country.country_code ? ' is-active' : '';
        return [
          '<button type="button" class="travel-country-chip' + active + '" data-country-select="' + escapeHtml(country.country_code) + '">',
          '  <span class="travel-country-chip-name">' + escapeHtml(country.country_name) + '</span>',
          '  <span class="travel-country-chip-meta">' + escapeHtml(country.region_name) + '</span>',
          '</button>'
        ].join("");
      }).join("") || '<div class="empty-note">暂无国家可展示</div>',
      '  </div>',
      '</div>'
    ].join("");
  }

  function buildNewsPanel(country) {
    return [
      '<div class="info-panel">',
      '  <div class="panel-title">旅游业重要新闻</div>',
      '  <div class="list-block">',
      buildNewsItems(country),
      '  </div>',
      '</div>'
    ].join("");
  }

  function buildNewsItems(country) {
    if (!country || !country.news.length) {
      return '<div class="empty-note">当前国家暂无新闻数据</div>';
    }

    return country.news.slice(0, 4).map(function (item) {
      return [
        '<div class="list-item">',
        '  <div class="list-item-head">',
        '    <div class="list-item-title">' + escapeHtml(item.headline || item.news_type) + '</div>',
        '    <div class="list-item-meta mono">' + escapeHtml(item.publish_date || "待补充") + '</div>',
        '  </div>',
        '  <div class="cell-attach"><span class="attach-label">类型</span><span class="attach-text">' + escapeHtml(item.news_type) + '</span></div>',
        '  <div class="list-item-copy">' + escapeHtml(item.summary || "待补充") + '</div>',
        '  <div class="cell-attach"><span class="attach-label">来源</span><span class="attach-text">' + escapeHtml(item.source_name || "待补充") + '</span></div>',
        '</div>'
      ].join("");
    }).join("");
  }

  function buildExpoPanel(country) {
    return [
      '<div class="info-panel">',
      '  <div class="panel-title">旅业展会信息</div>',
      '  <div class="list-block">',
      buildExpoItems(country),
      '  </div>',
      '</div>'
    ].join("");
  }

  function buildExpoItems(country) {
    if (!country || !country.expos.length) {
      return '<div class="empty-note">当前国家暂无展会数据</div>';
    }

    return country.expos.slice(0, 4).map(function (item) {
      return [
        '<div class="list-item">',
        '  <div class="list-item-head">',
        '    <div class="list-item-title">' + escapeHtml(item.expo_name || "待补充") + '</div>',
        '    <span class="tag tag-blue">' + escapeHtml(item.expo_quarter || "未标记") + '</span>',
        '  </div>',
        '  <div class="cell-attach"><span class="attach-label">展会时间</span><span class="attach-text">' + escapeHtml(formatDateRange(item.expo_start_date, item.expo_end_date)) + '</span></div>',
        '  <div class="cell-attach"><span class="attach-label">展会城市</span><span class="attach-text">' + escapeHtml(item.expo_city || "待补充") + '</span></div>',
        '  <div class="list-item-copy">' + escapeHtml(item.expo_note || "待补充") + '</div>',
        '</div>'
      ].join("");
    }).join("");
  }

  function bindEvents(filteredCountries) {
    var filterNodes = pageRoot.querySelectorAll("[data-travel-filter]");
    var resetButton = pageRoot.querySelector("[data-travel-action='reset']");
    var countryButtons = pageRoot.querySelectorAll("[data-country-select]");
    var mapHotspots = pageRoot.querySelectorAll("[data-country-code]");
    var availableCodes = {};

    filteredCountries.forEach(function (country) {
      availableCodes[country.country_code] = true;
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
        state.hoverCountryCode = null;
        renderPage();
      });
    }

    Array.prototype.forEach.call(countryButtons, function (node) {
      node.addEventListener("click", function () {
        state.activeCountryCode = node.getAttribute("data-country-select");
        state.hoverCountryCode = null;
        renderPage();
      });
    });

    Array.prototype.forEach.call(mapHotspots, function (node) {
      var code = node.getAttribute("data-country-code");

      if (!availableCodes[code]) {
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

  function firstHeadline(newsItems) {
    return newsItems.length ? (newsItems[0].headline || newsItems[0].summary || "待补充") : "待补充";
  }

  function secondHeadline(newsItems) {
    return newsItems.length > 1 ? (newsItems[1].headline || newsItems[1].summary || "待补充") : "待补充";
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
