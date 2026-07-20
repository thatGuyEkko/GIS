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

  // 国家在抽象地图上的坐标（百分比），未知国家仅进入右侧清单
  var COORD = {
    "日本": { top: 13, left: 63 },
    "韩国": { top: 19, left: 66 },
    "越南": { top: 42, left: 53 },
    "泰国": { top: 38, left: 32 },
    "印尼": { top: 56, left: 60 },
    "新加坡": { top: 50, left: 62 },
    "马来西亚": { top: 46, left: 58 },
    "沙特": { top: 26, left: 79 },
    "巴西": { top: 67, left: 16 },
    "土耳其": { top: 24, left: 55 }
  };

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
      fetchCsv("/data/leads.csv"),
      fetchCsv("/data/opportunities.csv"),
      fetchCsv("/data/bp_main.csv")
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
    var open = opps.filter(function (o) { return CLOSED.indexOf(o["状态"]) < 0; });
    var done = opps.filter(function (o) { return o["状态"] === "已完成"; });
    var evaling = opps.filter(function (o) { return EVALING.indexOf(o["状态"]) >= 0; });

    setText("summary-meta", "覆盖 " + open.length + " 个在管商机、" + leads.length + " 条线索、" + bps.length + " 份 BP");

    setText("m-open", open.length);
    setText("m-leads", leads.length);
    setText("m-eval", evaling.length);
    setText("m-done", done.length);

    var ecount = countBy(evaling, "状态");
    var ebreak = Object.keys(ecount).map(function (k) { return k + " " + ecount[k]; });
    setText("sub-eval", ebreak.length ? ebreak.join(" / ") : "暂无评估中项目");

    var ls = barList(countBy(leads, "来源"));
    setHTML("src-lead-source", ls || '<div class="chart-note">暂无线索数据</div>');

    var ot = barList(countBy(opps, "类型"));
    setHTML("src-opp-type", ot || '<div class="chart-note">暂无商机数据</div>');

    var ob = barList(countBy(opps, "归属BG"));
    setHTML("src-opp-bg", ob || '<div class="chart-note">暂无商机数据</div>');

    var sc = countBy(opps, "状态");
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
      var c = (o["目标国家/城市"] || "").trim();
      if (!c) return;
      if (!byCountry[c]) byCountry[c] = [];
      byCountry[c].push(o);
    });
    var countries = Object.keys(byCountry);

    var bubbleHtml = "";
    countries.forEach(function (c) {
      var list = byCountry[c];
      var coord = COORD[c];
      if (!coord) return;
      var n = list.length;
      var color = "tag-blue";
      list.forEach(function (o) {
        var s = o["状态"];
        if (s === "已完成") color = "tag-green";
        else if (s === "推进中" && color !== "tag-green") color = "tag-purple";
        else if ((s === "观望中" || s === "暂停") && color === "tag-blue") color = "tag-orange";
        else if (CLOSED.indexOf(s) >= 0 && color === "tag-blue") color = "tag-gray";
      });
      bubbleHtml += '<div class="map-bubble" style="top:' + coord.top + '%;left:' + coord.left + '%;">' +
        '<div class="bubble-dot ' + bubbleSize(n) + ' ' + color + '">' + n + '</div>' +
        '<div class="bubble-label" style="color:var(--text);">' + esc(c) + '</div></div>';
    });
    setHTML("map-bubbles", bubbleHtml);

    var sorted = countries.map(function (c) { return [c, byCountry[c]]; })
      .sort(function (a, b) { return b[1].length - a[1].length; });
    var max = sorted.length ? sorted[0][1].length : 1;
    var listHtml = sorted.map(function (e) {
      var c = e[0], list = e[1], n = list.length;
      var types = {};
      list.forEach(function (o) { var t = o["类型"]; if (t) types[t] = (types[t] || 0) + 1; });
      var note = Object.keys(types).join("、") || "—";
      var pct = max ? Math.round((n / max) * 100) : 0;
      return '<div class="map-list-item"><div><div class="map-list-name">' + esc(c) + '</div>' +
        '<div class="map-list-note">' + esc(note) + '</div></div>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%;background:var(--purple);"></div></div>' +
        '<div class="map-list-score">' + n + '</div></div>';
    }).join("");
    setHTML("region-list", listHtml || '<div class="chart-note">暂无商机数据</div>');
  }

  function renderRecent(leads, opps) {
    var items = [];
    leads.forEach(function (o) {
      items.push({
        time: normDate(o["更新时间"]), name: o["线索名称"],
        sub: (o["归属BG"] || "") + (o["归属BG"] ? " / " : "") + (o["类型"] || ""),
        node: "线索录入", nodeCls: "tag-gray", desc: o["线索描述"]
      });
    });
    opps.forEach(function (o) {
      items.push({
        time: normDate(o["更新时间"]), name: o["商机名称"],
        sub: (o["归属BG"] || "") + (o["归属BG"] ? " / " : "") + (o["类型"] || ""),
        node: o["状态"] || "—", nodeCls: statusTag(o["状态"]), desc: o["商机描述"]
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
