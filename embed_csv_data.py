#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
把 data/*.csv 内联进 index.html / leads.html / bp.html，并注入 fetch 垫片。

效果：
- 双击 file:// 打开：浏览器对本地文件 fetch 返回 404（resolved 而非 reject）-> 自动回退到内联数据 -> 正常显示
- 经 serve.py 打开：fetch 成功（HTTP 2xx）-> 使用最新 CSV（内联仅作离线兜底）
- 服务挂掉 / 网络错误：fetch reject -> 同样回退内联

重跑本脚本即可用最新 CSV 刷新内联数据。
"""
import json
import os
import re

GIS = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(GIS, "data")
HTMLS = ["index.html", "leads.html", "bp.html", "bp-details/index.html"]
CSV_FILES = {
    "/data/leads.csv": "leads.csv",
    "/data/opportunities.csv": "opportunities.csv",
    "/data/bp_main.csv": "bp_main.csv",
    "/data/bp_tag.csv": "bp_tag.csv",
    "/data/bp_stage.csv": "bp_stage.csv",
    "/data/bp_attachment.csv": "bp_attachment.csv",
}


def build_block():
    embed = {}
    for url, fname in CSV_FILES.items():
        with open(os.path.join(DATA, fname), encoding="utf-8") as f:
            embed[url] = f.read()
    emb_json = json.dumps(embed, ensure_ascii=False)
    # 防止 CSV 内容里出现 </script> 提前闭合脚本块
    emb_json = emb_json.replace("</", "<\\/")
    return (
        "<!-- OOMS_EMBED_START -->\n"
        "<script>\n"
        "window.__OOMS_EMBED = " + emb_json + ";\n"
        "(function(){\n"
        "  var real = window.fetch ? window.fetch.bind(window) : null;\n"
        "  function embed(key) {\n"
        "    if (window.__OOMS_EMBED && Object.prototype.hasOwnProperty.call(window.__OOMS_EMBED, key)) {\n"
        "      return new Response(window.__OOMS_EMBED[key], {status:200, headers:{'Content-Type':'text/csv;charset=utf-8'}});\n"
        "    }\n"
        "    return null;\n"
        "  }\n"
        "  window.fetch = function(u, o){\n"
        "    var key = (typeof u === 'string') ? u : (u && u.url);\n"
        "    if (!real) {\n"
        "      var e0 = embed(key);\n"
        "      if (e0) return Promise.resolve(e0);\n"
        "      return Promise.reject(new Error('fetch unavailable and no embedded data for ' + key));\n"
        "    }\n"
        "    return real(u, o).then(function(resp){\n"
        "      if (resp.ok) return resp;            // HTTP 2xx：使用真实最新数据\n"
        "      var e1 = embed(key);                 // 非 2xx（如 file:// 下 404）：回退内联\n"
        "      if (e1) return e1;\n"
        "      return resp;                         // 无内联，原样交给调用方报错\n"
        "    }).catch(function(err){\n"
        "      var e2 = embed(key);                 // 网络错误：回退内联\n"
        "      if (e2) return e2;\n"
        "      throw err;\n"
        "    });\n"
        "  };\n"
        "})();\n"
        "</script>\n"
        "<!-- OOMS_EMBED_END -->"
    )


def inject(html_path, block):
    with open(html_path, encoding="utf-8") as f:
        html = f.read()
    html = re.sub(
        r"<!-- OOMS_EMBED_START -->.*?<!-- OOMS_EMBED_END -->", "", html, flags=re.S
    )
    if "</head>" in html:
        html = html.replace("</head>", block + "\n</head>", 1)
    else:
        html = block + "\n" + html
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html)


if __name__ == "__main__":
    block = build_block()
    for h in HTMLS:
        inject(os.path.join(GIS, h), block)
    print("已注入内联 CSV 数据到:", HTMLS)
