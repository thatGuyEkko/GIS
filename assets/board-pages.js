(function () {
  "use strict";

  // 关闭样本：这些状态不计入「在管商机」
  var CLOSED = ["筛查未通过", "初评未通过", "已放弃"];
  // 评估中：介于线索与推进之间、仍在评估流程里的状态
  var EVALING = ["已纳入评估", "观望中", "暂停", "商讨中", "暂缓"];

  function fetchCsv(url) {
    return fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("加载失败: " + url + " (" + r.status + ")");
      return r.text();
    });
  }

  // 数据目录：按本脚本自身 URL 推算（data/ 与 assets/ 同级），
  // 兼容本地根服务、线上子路径(如 /GIS/)与子目录页面。
  var DATA_BASE = (function () {
    var s = document.currentScript;
    if (!s || !s.src) {
      var all = document.getElementsByTagName("script");
      for (var i = all.length - 1; i >= 0; i--) {
        if (/board-pages\.js/.test(all[i].src)) { s = all[i]; break; }
      }
    }
    var src = s && s.src ? s.src : "";
    return src.replace(/assets\/[^/]*$/, "") + "data/";
  })();

  function parseCsv(text) {
    text = (text || "").replace(/^﻿/, "");
    var rows = [], row = [], len = text.length, cell = "", q = false;
    for (var i = 0; i < len; i++) {
      var c = text[i];
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') { cell += '"'; i++; } else q = false;
        } else cell += c;
        continue;
      }
      if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else if (c !== "\r") cell += c;
    }
    if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row); }
    var f = rows.filter(function (r) { return r.some(function (v) { return v !== ""; }); });
    if (!f.length) return [];
    var h = f[0];
    return f.slice(1).map(function (r) {
      var o = {};
      h.forEach(function (k, idx) { o[k] = r[idx] || ""; });
      return o;
    });
  }

  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  // 标准化日期为 YYYY-MM-DD，兼容 CSV 中的 2026-07-01 与 2026/7/6 两种写法
  function normDate(s) {
    s = (s || "").trim();
    if (!s) return "";
    var parts = s.split(/[/\-]/);
    if (parts.length === 3 && parts[0].length === 4) {
      var m = String(parts[1]).padStart(2, "0");
      var d = String(parts[2]).padStart(2, "0");
      return parts[0] + "-" + m + "-" + d;
    }
    return s;
  }

  function countBy(arr, key) {
    var m = {};
    arr.forEach(function (o) {
      var k = (o[key] || "").trim();
      if (k) m[k] = (m[k] || 0) + 1;
    });
    return m;
  }

  function barList(map) {
    var entries = Object.keys(map).map(function (k) { return [k, map[k]]; });
    entries.sort(function (a, b) { return b[1] - a[1]; });
    var max = entries.length ? entries[0][1] : 1;
    var palette = ["var(--purple)", "var(--blue)", "var(--teal)", "var(--green)", "var(--orange)", "var(--red)", "var(--gray)"];
    return entries.map(function (e, i) {
      var pct = max ? Math.round((e[1] / max) * 100) : 0;
      var color = palette[i % palette.length];
      return '<div class="bar-row"><span class="bar-label">' + esc(e[0]) + '</span>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%;background:' + color + ';"></div></div>' +
        '<span class="bar-value">' + e[1] + '</span></div>';
    }).join("");
  }

  // 国家经纬度 [纬度 lat, 经度 lon]，用于 ECharts geo 坐标系定位气泡。
  // 未在此表的国家的商机仅进入右侧「区域关注清单」，地图上不画气泡。
  var GEO = {
    "日本": [36, 138],
    "韩国": [36, 128],
    "越南": [16, 106],
    "泰国": [15, 101],
    "印尼": [-2, 118],
    "新加坡": [1.3, 103.8],
    "马来西亚": [4, 110],
    "沙特": [24, 45],
    "土耳其": [39, 35],
    "巴西": [-10, -52],
    "印度": [22, 79],
    "菲律宾": [13, 122],
    "美国": [39, -98],
    "墨西哥": [23, -102],
    "阿联酋": [24, 54],
    "埃及": [27, 30],
    "南非": [-30, 25],
    "澳大利亚": [-25, 134],
    "英国": [54, -2],
    "德国": [51, 10],
    "法国": [47, 2]
  };

  // 气泡配色与主题一致；优先级：已完成 > 推进中 > 观望/暂停 > 关闭 > 在管(蓝)
  var STATUS_HEX = {
    blue: "#2166b1",
    purple: "#6b3fa0",
    green: "#5c8c2b",
    orange: "#b87420",
    gray: "#7c7b73"
  };

  function bubbleHex(list) {
    var color = STATUS_HEX.blue;
    list.forEach(function (o) {
      var s = o["status"];
      if (s === "已完成") color = STATUS_HEX.green;
      else if (s === "推进中" && color !== STATUS_HEX.green) color = STATUS_HEX.purple;
      else if ((s === "观望中" || s === "暂停") && color === STATUS_HEX.blue) color = STATUS_HEX.orange;
      else if (CLOSED.indexOf(s) >= 0 && color === STATUS_HEX.blue) color = STATUS_HEX.gray;
    });
    return color;
  }

  function bubbleSize(n) {
    if (n >= 4) return "bubble-lg";
    if (n >= 3) return "bubble-md";
    if (n >= 2) return "bubble-sm";
    return "bubble-xs";
  }

  function statusTag(status) {
    if (status === "已完成") return "tag-green";
    if (status === "推进中") return "tag-purple";
    if (status === "观望中" || status === "暂停") return "tag-orange";
    if (CLOSED.indexOf(status) >= 0) return "tag-gray";
    return "tag-blue";
  }

  function load() {
    return Promise.all([
      fetchCsv(DATA_BASE + "leads.csv"),
      fetchCsv(DATA_BASE + "opportunities.csv"),
      fetchCsv(DATA_BASE + "bp_main.csv")
    ]).then(function (res) {
      return {
        leads: parseCsv(res[0]),
        opps: parseCsv(res[1]),
        bps: parseCsv(res[2])
      };
    });
  }

  function setText(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }
  function setHTML(id, v) { var el = document.getElementById(id); if (el) el.innerHTML = v; }

  function render(data) {
    var leads = data.leads, opps = data.opps, bps = data.bps;
    var open = opps.filter(function (o) { return CLOSED.indexOf(o["status"]) < 0; });
    var done = opps.filter(function (o) { return o["status"] === "已完成"; });
    var evaling = opps.filter(function (o) { return EVALING.indexOf(o["status"]) >= 0; });

    setText("summary-meta", "覆盖 " + open.length + " 个在管商机、" + leads.length + " 条线索、" + bps.length + " 份 BP");

    setText("m-open", open.length);
    setText("m-leads", leads.length);
    setText("m-eval", evaling.length);
    setText("m-done", done.length);

    var ecount = countBy(evaling, "status");
    var ebreak = Object.keys(ecount).map(function (k) { return k + " " + ecount[k]; });
    setText("sub-eval", ebreak.length ? ebreak.join(" / ") : "暂无评估中项目");

    var ls = barList(countBy(leads, "source"));
    setHTML("src-lead-source", ls || '<div class="chart-note">暂无线索数据</div>');

    var ot = barList(countBy(opps, "type"));
    setHTML("src-opp-type", ot || '<div class="chart-note">暂无商机数据</div>');

    var ob = barList(countBy(opps, "bg"));
    setHTML("src-opp-bg", ob || '<div class="chart-note">暂无商机数据</div>');

    var sc = countBy(opps, "status");
    setText("lg-prog", "推进中 " + (sc["推进中"] || 0));
    setText("lg-open", "在管 " + open.length);
    setText("lg-watch", "观望/暂停 " + evaling.length);
    setText("lg-done", "已完成 " + done.length);
    renderFunnel(open.length, sc["推进中"] || 0, done.length);

    renderMap(opps);
    renderRecent(leads, opps);
  }

  function funnelStep(cls, color, label, val) {
    return '<div class="funnel-step ' + cls + '">' +
      '<div class="funnel-label" style="color:var(--' + color + ');">' + label + '</div>' +
      '<div class="funnel-value" style="color:var(--' + color + ');">' + val + '</div></div>';
  }
  function renderFunnel(openN, progN, doneN) {
    var html = funnelStep("top", "purple", "在管商机", openN) +
      '<div class="funnel-arrow purple"></div>' +
      funnelStep("mid-a", "orange", "推进中", progN) +
      '<div class="funnel-arrow orange"></div>' +
      funnelStep("bottom", "green", "已完成", doneN);
    setHTML("funnel", html);
  }

  function renderMap(opps) {
    var byCountry = {};
    opps.forEach(function (o) {
      var c = (o["country"] || "").trim();
      if (!c) return;
      if (!byCountry[c]) byCountry[c] = [];
      byCountry[c].push(o);
    });
    var countries = Object.keys(byCountry);

    // 右侧「区域关注清单」（与地图渲染方式无关，保留原逻辑）
    var sorted = countries.map(function (c) { return [c, byCountry[c]]; })
      .sort(function (a, b) { return b[1].length - a[1].length; });
    var max = sorted.length ? sorted[0][1].length : 1;
    var listHtml = sorted.map(function (e) {
      var c = e[0], list = e[1], n = list.length;
      var types = {};
      list.forEach(function (o) { var t = o["type"]; if (t) types[t] = (types[t] || 0) + 1; });
      var note = Object.keys(types).join("、") || "—";
      var pct = max ? Math.round((n / max) * 100) : 0;
      return '<div class="map-list-item" data-country="' + esc(c) + '"><div><div class="map-list-name">' + esc(c) + '</div>' +
        '<div class="map-list-note">' + esc(note) + '</div></div>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%;background:var(--purple);"></div></div>' +
        '<div class="map-list-score">' + n + '</div></div>';
    }).join("");
    setHTML("region-list", listHtml || '<div class="chart-note">暂无商机数据</div>');

    // ECharts 世界地图 + 散点气泡
    var node = document.getElementById("map-chart");
    if (!node) return;
    if (!window.echarts || typeof window.echarts.init !== "function") {
      showError("ECharts 组件未加载，请检查 assets/vendor/echarts.min.js。");
      return;
    }
    if (!window.echarts.getMap || !window.echarts.getMap("world")) {
      showError("ECharts 世界地图数据未加载，请检查 assets/vendor/echarts-world.js。");
      return;
    }

    var points = [];
    countries.forEach(function (c) {
      var g = GEO[c];
      if (!g) return;
      var list = byCountry[c];
      var n = list.length;
      points.push({
        name: c,
        value: [g[1], g[0], n], // [经度, 纬度, 数量]
        itemStyle: { color: bubbleHex(list) },
        _list: list // 原商机数组，供 tooltip 明细展示
      });
    });

    if (window.__dashboardMap) {
      window.__dashboardMap.dispose();
      window.__dashboardMap = null;
    }
    var chart = window.echarts.init(node);
    window.__dashboardMap = chart;

    chart.setOption({
      animation: false,
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(33,39,46,.92)",
        borderWidth: 0,
        textStyle: { color: "#fff", fontSize: 12 },
        formatter: function (p) {
          if (p.seriesType !== "scatter" || !p.data) return "";
          var list = p.data._list || [];
          var rows = list.map(function (o) {
            var meta = [o["type"], o["status"], o["score"]].filter(Boolean).join(" · ");
            return '<div class="tt-row"><span class="tt-name">' + esc(o["name"] || "商机") + '</span>' +
              '<span class="tt-meta">' + esc(meta) + '</span></div>';
          }).join("");
          return '<div class="tt-title">' + esc(p.name) + '：<b>' + p.value[2] + '</b> 个商机</div>' + rows;
        }
      },
      geo: {
        map: "world",
        roam: true,
        silent: true,
        left: 0, right: 0, top: 8, bottom: 8,
        itemStyle: {
          areaColor: "#dbe4ea",
          borderColor: "#ffffff",
          borderWidth: 0.5
        },
        emphasis: {
          itemStyle: { areaColor: "#c6d3dc" },
          label: { show: false }
        },
        label: { show: false }
      },
      series: [{
        type: "scatter",
        coordinateSystem: "geo",
        data: points,
        symbolSize: function (val) {
          var n = val[2];
          return Math.max(12, Math.min(42, 12 + n * 7));
        },
        itemStyle: {
          borderColor: "#ffffff",
          borderWidth: 1.5,
          opacity: 0.92
        },
        label: {
          show: true,
          formatter: function (p) { return p.value[2]; },
          color: "#ffffff",
          fontWeight: 600,
          fontSize: 11
        },
        emphasis: {
          scale: 1.15,
          label: { show: true },
          itemStyle: { shadowBlur: 10, shadowColor: "rgba(0,0,0,.35)" }
        },
        z: 10
      }]
    });

    // 联动：地图气泡 <-> 右侧「区域关注清单」双向高亮
    function hlListItem(country, on) {
      document.querySelectorAll("#region-list .map-list-item").forEach(function (it) {
        if (it.getAttribute("data-country") === country) it.classList.toggle("hl", !!on);
      });
    }
    chart.on("mouseover", function (params) {
      if (params.componentType === "series" && params.seriesType === "scatter") hlListItem(params.name, true);
    });
    chart.on("mouseout", function (params) {
      if (params.componentType === "series" && params.seriesType === "scatter") hlListItem(params.name, false);
    });
    document.querySelectorAll("#region-list .map-list-item").forEach(function (it) {
      var c = it.getAttribute("data-country");
      it.addEventListener("mouseenter", function () {
        chart.dispatchAction({ type: "highlight", seriesIndex: 0, name: c });
        hlListItem(c, true);
      });
      it.addEventListener("mouseleave", function () {
        chart.dispatchAction({ type: "downplay", seriesIndex: 0, name: c });
        hlListItem(c, false);
      });
    });

    if (!window.__dashboardMapResized) {
      window.__dashboardMapResized = true;
      window.addEventListener("resize", function () {
        if (window.__dashboardMap) window.__dashboardMap.resize();
      });
    }
  }

  function renderRecent(leads, opps) {
    var items = [];
    leads.forEach(function (o) {
      items.push({
        time: normDate(o["updated"]), name: o["name"],
        sub: (o["bg"] || "") + (o["bg"] ? " / " : "") + (o["type"] || ""),
        node: "线索录入", nodeCls: "tag-gray", desc: o["copy"]
      });
    });
    opps.forEach(function (o) {
      items.push({
        time: normDate(o["updated"]), name: o["name"],
        sub: (o["bg"] || "") + (o["bg"] ? " / " : "") + (o["type"] || ""),
        node: o["status"] || "—", nodeCls: statusTag(o["status"]), desc: o["copy"]
      });
    });
    items = items.filter(function (it) { return (it.time || "").trim() !== ""; });
    items.sort(function (a, b) { return String(b.time).localeCompare(String(a.time)); });
    items = items.slice(0, 8);
    var html = items.map(function (it) {
      return '<tr><td class="mono" style="color:var(--text-muted);">' + esc(it.time) + '</td>' +
        '<td><div class="cell-title">' + esc(it.name) + '</div><div class="cell-sub">' + esc(it.sub) + '</div></td>' +
        '<td><span class="tag ' + it.nodeCls + '">' + esc(it.node) + '</span></td>' +
        '<td>' + esc((it.desc || "").slice(0, 40)) + '</td></tr>';
    }).join("");
    setHTML("recent-tbody", html || '<tr><td colspan="4" class="empty-note">暂无动态</td></tr>');
  }

  function showError(msg) {
    var el = document.getElementById("board-error");
    if (el) { el.style.display = "block"; el.textContent = msg; }
  }

  load().then(render).catch(function (e) {
    showError("看板数据加载失败：" + e.message + "（请通过本地服务 http:// 访问，勿用 file:// 直接打开）");
  });
})();
