# -*- coding: utf-8 -*-
"""Generate 线索商机录入指导手册 (PDF + Markdown) from the OOMS leads/opportunities spec.

Single source of truth: the *_FIELDS / *_ENUM constants below feed BOTH the PDF and the
Markdown output, so the two never drift apart. Edit the constants, then re-run.
"""
import os

# ---------------------------------------------------------------------------
# Paths & version
# ---------------------------------------------------------------------------
OUTDIR = os.path.dirname(os.path.abspath(__file__))
PDF_OUT = os.path.join(OUTDIR, "线索商机录入指导手册.pdf")
MD_OUT = os.path.join(OUTDIR, "leads-opportunities-entry-guide.md")
VERSION = "v1.3"
UPDATED = "2026-07-20"

# ---------------------------------------------------------------------------
# Single source of truth
# ---------------------------------------------------------------------------
LEADS_FIELDS = [
    ["id", "id", "否", "文本，前缀 L-", "线索唯一标识，手动维护需唯一；留空时新增流程自动生成。"],
    ["线索名称", "name", "是", "文本", "标题，列表与表格主名称。为空不允许提交。"],
    ["目标国家/城市", "country", "否", "文本", "如「泰国曼谷」「印尼」。"],
    ["类型", "type", "否", "枚举 6 选 1", "见「四、类型」。"],
    ["归属BG", "bg", "否", "枚举 9 选 1", "见「四、归属BG」。留空即「未指定」。"],
    ["来源", "source", "否", "枚举 11 选 1", "见「四、来源」。"],
    ["线索描述", "copy", "否", "长文本", "一句话说明来源与价值，展示在副标题。"],
    ["附件", "attach", "否", "链接（可多个）", "填可访问 URL；多个用换行/分号/竖线分隔，渲染为可点击链接（新窗口打开）。"],
    ["创建时间", "created", "否", "YYYY-MM-DD", "新增时自动填当天；历史数据可手动填。"],
    ["更新时间", "updated", "否", "YYYY-MM-DD", "新增时自动填当天。"],
]
LEADS_HEADER = "id,线索名称,目标国家/城市,类型,归属BG,来源,线索描述,附件,创建时间,更新时间"

OPP_FIELDS = [
    ["id", "id", "否", "文本，前缀 O-/C-", "商机(O-)与关闭样本(C-)统一在此文件，手动维护需唯一。"],
    ["商机名称", "name", "是", "文本", "必填，为空不允许提交。"],
    ["目标国家/城市", "country", "否", "文本", "如「日本关西」。"],
    ["类型", "type", "否", "枚举 6 选 1", "与线索共用同一套类型枚举，见「四、类型」。"],
    ["归属BG", "bg", "否", "枚举 9 选 1", "见「四、归属BG」。"],
    ["来源", "source", "否", "枚举 11 选 1", "见「四、来源」。"],
    ["负责人", "owner", "否", "文本", "如「张三」，填在表格「负责人」列。"],
    ["商机评分", "score", "否", "数字 0.0–5.0", "步进 0.1；≥3.5 绿、≥2.5 黄、<2.5 红。"],
    ["商机描述", "copy", "否", "长文本", "展示在卡片与表格副标题。"],
    ["附件", "attach", "否", "链接（可多个）", "填可访问 URL；多个用换行/分号/竖线分隔，渲染为可点击链接（新窗口打开）。"],
    ["状态", "status", "是", "枚举 9 选 1", "见「四、状态」。关闭样本需填三个关闭值之一。"],
    ["创建时间", "created", "否", "YYYY-MM-DD", "新增时自动填当天。"],
    ["更新时间", "updated", "否", "YYYY-MM-DD", "新增时自动填当天。"],
]
OPP_HEADER = "id,商机名称,目标国家/城市,类型,归属BG,来源,负责人,商机评分,商机描述,附件,状态,创建时间,更新时间"

TYPE_ENUM = [
    ["投并购标的", "橙"], ["OTA平台", "蓝"], ["供应链整合", "紫"],
    ["支付金融", "绿"], ["软硬件销售", "青"], ["酒店管理", "灰"],
]
BG_ENUM = ["出行", "酒旅", "境外支付", "同程智造", "HopeGo", "万达酒管", "商分", "投资", "市场中心"]
SOURCE_ENUM = ["内部数据扫描", "合作伙伴接触", "竞品监控", "投行推荐", "行业展会", "海外团队反馈",
               "政策驱动", "新闻舆情监测", "行业报告", "外部咨询", "实地调研"]
STATUS_ENUM = [
    ["待认领", "灰", "线索固定值"],
    ["已纳入评估", "蓝", "在管商机"],
    ["推进中", "绿", "在管商机（默认）"],
    ["观望中", "橙", "在管商机"],
    ["暂停", "灰", "在管商机"],
    ["已完成", "绿", "在管商机（成功闭环，仍留在在管商机栏，不进入关闭样本）"],
    ["筛查未通过", "红", "关闭样本"],
    ["初评未通过", "红", "关闭样本"],
    ["已放弃", "红", "关闭样本"],
]
SCORE_RULES = [["≥ 3.5", "绿（good）"], ["2.5 – 3.4", "黄（mid）"], ["< 2.5", "红（bad）"]]
ID_RULES = [
    ["线索", "L-", "新增时自动 L- + 时间戳"],
    ["商机", "O-", "新增时自动 O- + 时间戳"],
    ["关闭样本", "C-", "手动在 CSV 中写为 C- 前缀的任意唯一值（如 C-20260101）"],
]
CHECK_RULES = [
    ["名称必填", "线索名称 / 商机名称 建议必填；为空则该条记录名称为空。"],
    ["商机评分范围", "建议 0–5、步进 0.1；非数字会原样展示。"],
    ["枚举约束", "直接编辑 CSV 可填任意文本，页面原样展示（标签可能落入默认灰，建议严格按四枚举填）。"],
    ["日期格式", "不强制标准日期；非 YYYY-MM-DD 会原样展示，建议统一 YYYY-MM-DD。"],
]
ERROR_ITEMS = [
    "1. 直接双击 HTML（file://）打不开数据：需启本地 HTTP 服务。",
    "2. 在 leads.csv 误填「状态」列：线索状态固定「待认领」，该文件无状态列，误加会被忽略。",
    "3. 枚举用旧写法（如 OTA平台业务 / 软件销售 / 净瓶监控 / 万达酒馆 / 酒店BG）：请用最新枚举，旧值落入默认灰。",
    "4. 关闭样本误放进 leads.csv：应写在 opportunities.csv，状态填三个关闭值之一。",
    "5. CSV 字段含逗号却没加引号：含逗文本必须用双引号包裹整段，否则拆列错位。",
]
SHORT_ITEMS = [
    "1. 两份文件分工：leads.csv 管线索，opportunities.csv 管商机 + 关闭样本。",
    "2. 线索状态固定「待认领」无状态列；商机 / 关闭有「状态」列。",
    "3. 关闭样本靠状态判定（筛查未通过 / 初评未通过 / 已放弃），写在 opportunities.csv，无单独文件。",
    "4. 枚举用最新一套：类型 6 / 归属BG 9 / 来源 11 / 状态 9。",
    "5. 必须走 HTTP 打开页面；数据完全来自 CSV，直接改 CSV 即改页面。",
]

# ===========================================================================
# PDF output (reportlab)
# ===========================================================================
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont

pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
CJK = "STSong-Light"
BOLD = "STSong-Light"

styles = getSampleStyleSheet()
base = ParagraphStyle("base", parent=styles["Normal"], fontName=CJK,
                      fontSize=9.5, leading=15, wordWrap="CJK", alignment=TA_LEFT)
h1 = ParagraphStyle("h1", parent=base, fontName=BOLD, fontSize=15, leading=22,
                    spaceBefore=10, spaceAfter=6, textColor=colors.HexColor("#1a1a2e"))
h2 = ParagraphStyle("h2", parent=base, fontName=BOLD, fontSize=11.5, leading=17,
                    spaceBefore=8, spaceAfter=4, textColor=colors.HexColor("#16213e"))
body = ParagraphStyle("body", parent=base, spaceAfter=4)
small = ParagraphStyle("small", parent=base, fontSize=8.5, leading=13,
                       textColor=colors.HexColor("#555555"))
cover_title = ParagraphStyle("ct", parent=base, fontName=BOLD, fontSize=26,
                             leading=34, textColor=colors.HexColor("#0f3460"))
cover_sub = ParagraphStyle("cs", parent=base, fontSize=12, leading=20,
                           textColor=colors.HexColor("#444444"))
cell = ParagraphStyle("cell", parent=base, fontSize=8.2, leading=12)
cellb = ParagraphStyle("cellb", parent=base, fontName=BOLD, fontSize=8.2, leading=12)
note = ParagraphStyle("note", parent=base, fontSize=8.5, leading=13,
                      textColor=colors.HexColor("#7a1f1f"),
                      backColor=colors.HexColor("#fbeaea"),
                      borderPadding=5, spaceBefore=3, spaceAfter=6)


def P(t, s=body):
    return Paragraph(t, s)


def cellP(t, bold=False):
    return Paragraph(t, cellb if bold else cell)


def header_row(cells):
    return [cellP(c, bold=True) for c in cells]


def make_table(data, col_widths, header_bg="#0f3460"):
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(header_bg)),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1),
         [colors.white, colors.HexColor("#f4f6fb")]),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return t


def build_pdf_story():
    story = []
    W = A4[0] - 36 * mm

    # ---- Cover ----
    story.append(Spacer(1, 40 * mm))
    story.append(P("线索商机录入指导手册", cover_title))
    story.append(Spacer(1, 6 * mm))
    story.append(P("OOMS 出海商机管理系统 · 模块二 Leads &amp; Opportunities", cover_sub))
    story.append(Spacer(1, 4 * mm))
    story.append(P("面向数据维护同学：如何填写 data/leads.csv 与 data/opportunities.csv，"
                   "以及页面字段、枚举与常见错误。", cover_sub))
    story.append(Spacer(1, 30 * mm))
    story.append(P(f"版本：{VERSION} &nbsp;|&nbsp; 更新：{UPDATED} &nbsp;|&nbsp; 字段规范以本手册与同目录 leads-opportunities-entry-guide.md 为准", small))
    story.append(PageBreak())

    # ---- 一、概述 ----
    story.append(P("一、概述", h1))
    story.append(P("本模块已调整为<b>只读渲染</b>：页面直接读取两份 CSV 渲染，不提供在线新增 / 编辑入口，"
                   "所有维护通过编辑 CSV 完成。", body))
    story.append(P("1. <b>data/leads.csv</b>：维护线索池数据（线索阶段状态固定为「待认领」，无状态列）。", body))
    story.append(P("2. <b>data/opportunities.csv</b>：维护在管商机与关闭样本，靠「状态」列判定归类。", body))
    story.append(P("3. 两份文件按各自 id 区分记录，线索/商机/关闭样本分别使用 <b>L- / O- / C-</b> 前缀；"
                   "列表三栏（线索池 / 在管商机 / 关闭样本）由「文件来源 + 状态」自动生成。", body))

    # ---- 二、页面取数逻辑 ----
    story.append(P("二、页面取数逻辑", h1))
    story.append(P("三栏划分", h2))
    story.append(P("• <b>线索池</b>：来自 leads.csv 的全部记录，状态统一渲染为「待认领」。", body))
    story.append(P("• <b>在管商机</b>：来自 opportunities.csv、且状态不属于关闭状态的记录。", body))
    story.append(P("• <b>关闭样本</b>：来自 opportunities.csv、状态为 筛查未通过 / 初评未通过 / 已放弃 之一。", body))
    story.append(P("指标卡与表格取数", h2))
    story.append(P("顶部 4 张指标卡（线索总数 / 待认领线索 / 在管商机 / 关闭样本）实时计算，不手填。"
                   "下方表格列依次为：名称 / 国家 / 类型 / 状态 / 归属BG / 评分 / 负责人 / 附件 / 创建时间 / 更新时间。"
                   "类型 / 归属BG / 来源 / 状态 均以带颜色标签展示。", body))

    # ---- 三、CSV 字段填写 ----
    story.append(P("三、CSV 字段填写", h1))
    story.append(P("3.1 leads.csv（线索）", h2))
    leads_head = header_row(["CSV 列名", "内部字段", "必填", "类型 / 枚举", "说明"])
    leads_data = [leads_head] + [[cellP(c) for c in r] for r in LEADS_FIELDS]
    story.append(make_table(leads_data, [26 * mm, 18 * mm, 12 * mm, 28 * mm, W - 84 * mm]))
    story.append(P("当前表头", h2))
    story.append(P("<font face='Courier'>" + LEADS_HEADER + "</font>", small))
    story.append(PageBreak())

    story.append(P("3.2 opportunities.csv（商机 + 关闭样本）", h2))
    opp_head = header_row(["CSV 列名", "内部字段", "必填", "类型 / 枚举", "说明"])
    opp_data = [opp_head] + [[cellP(c) for c in r] for r in OPP_FIELDS]
    story.append(make_table(opp_data, [26 * mm, 18 * mm, 12 * mm, 28 * mm, W - 84 * mm]))
    story.append(P("当前表头", h2))
    story.append(P("<font face='Courier'>" + OPP_HEADER + "</font>", small))
    story.append(P("注：商机 CSV 中的「类型」与线索「类型」是同一套枚举（投并购标的 / OTA平台 / 供应链整合 / "
                   "支付金融 / 软硬件销售 / 酒店管理），按类型枚举填写即可。", note))
    story.append(P("关闭样本（示例 C-001~C-003）与普通商机同处一份 opportunities.csv，仅「状态」列填三个关闭值之一，"
                   "页面自动归入「关闭样本」栏，无需单独文件或类别标记。", body))

    story.append(P("3.3 附件填写规范（线索 / 商机共用）", h2))
    story.append(P("「附件」列用于挂载与本条记录相关的可访问链接（方案文档、调研报告、合同扫描件等的分享地址），"
                   "不是本地文件上传。", body))
    story.append(P("• 填什么：一个或多个以 http:// / https:// / ftp:// 开头的 URL。", body))
    story.append(P("• 多个链接：用换行、英文分号 ; 或竖线 | 分隔，页面逐个渲染为可点击链接，点击在新窗口打开。", body))
    story.append(P("• 留空：不填则不显示附件区。", body))
    story.append(P("• 非链接文本：若内容不是合法 URL（不以上述协议开头），按纯文本展示，不会变成链接，也不执行脚本（防 XSS）。", body))
    story.append(P("• 单条 URL 内可含逗号（如查询参数 ?a=1,2）；附件列用换行/分号/竖线分隔，不与 CSV 列分隔冲突。", body))
    story.append(P("• 示例：https://example.com/kansai-hotel-deal 或 https://a.com/x ; https://b.com/y", small))

    # ---- 四、枚举值字典 ----
    story.append(PageBreak())
    story.append(P("四、枚举值字典", h1))
    story.append(P("类型（6 选 1，线索 / 商机共用）", h2))
    t_data = [header_row(["取值", "页面标签颜色"])] + [[cellP(a), cellP(b)] for a, b in TYPE_ENUM]
    story.append(make_table(t_data, [60 * mm, W - 60 * mm]))
    story.append(P("归属BG（9 选 1，可留空 = 未指定）", h2))
    story.append(P(" / ".join(BG_ENUM), body))
    story.append(P("来源（11 选 1）", h2))
    story.append(P(" / ".join(SOURCE_ENUM), body))
    story.append(P("状态（9 选 1）", h2))
    st_data = [header_row(["取值", "页面标签颜色", "归类"])] + [[cellP(a), cellP(b), cellP(c)] for a, b, c in STATUS_ENUM]
    story.append(make_table(st_data, [40 * mm, 40 * mm, W - 80 * mm]))
    story.append(P("商机评分着色规则", h2))
    sc_data = [header_row(["分数", "颜色"])] + [[cellP(a), cellP(b)] for a, b in SCORE_RULES]
    story.append(make_table(sc_data, [60 * mm, W - 60 * mm]))

    # ---- 五、ID 规则 / 六、格式 / 七、校验 ----
    story.append(PageBreak())
    story.append(P("五、ID 规则", h1))
    id_data = [header_row(["类别", "前缀", "生成方式"])] + [[cellP(a), cellP(b), cellP(c)] for a, b, c in ID_RULES]
    story.append(make_table(id_data, [36 * mm, 24 * mm, W - 60 * mm]))
    story.append(P("六、CSV 格式要求", h1))
    story.append(P("• 编码：UTF-8（带 BOM 也可，页面解析时自动去除）。", body))
    story.append(P("• 分隔符：英文逗号 , 。", body))
    story.append(P("• 文本含逗号、换行或双引号时，必须用英文双引号包裹；字段内双引号写成两个双引号 \"\"。", body))
    story.append(P("• 不要有多余空行或表头拼写错误，否则该列会被忽略或错位。", body))
    story.append(P("七、校验规则", h1))
    chk_data = [header_row(["规则", "说明"])] + [[cellP(a), cellP(b)] for a, b in CHECK_RULES]
    story.append(make_table(chk_data, [40 * mm, W - 40 * mm]))

    # ---- 八、本地预览 ----
    story.append(P("八、本地预览与运行要求", h1))
    story.append(P("页面依赖 fetch 读取 CSV，<b>必须经 HTTP 访问</b>，双击 file:// 打开会因安全策略读不到数据。", body))
    story.append(P("启动本地服务（推荐用项目自带的 <font face='Courier'>OOMS_workflow/serve.py</font>，"
                   "不要用 <font face='Courier'>python3 -m http.server</font>：后者无 no-store 缓存控制，"
                   "刷新看不到最新 CSV）：", body))
    story.append(P("<font face='Courier'>cd ~/Desktop/OOMS_workflow</font>", small))
    story.append(P("<font face='Courier'>python3 serve.py   # 端口 8123，文档根 = ~/Desktop/GIS</font>", small))
    story.append(P("浏览器打开：", small))
    story.append(P("• 商机看板（主入口）：<font face='Courier'>http://127.0.0.1:8123/index.html</font>", small))
    story.append(P("• 线索 / 商机录入浏览：<font face='Courier'>http://127.0.0.1:8123/leads.html</font>", small))
    story.append(P("注意：看板页 index.html 用绝对路径 /data/*.csv 取数，必须以 GIS 为根目录通过本服务访问；"
                   "直接双击 file:// 或更换文档根都会读不到数据。", body))

    # ---- 九、常见错误 ----
    story.append(P("九、常见错误", h1))
    for it in ERROR_ITEMS:
        story.append(P(it, body))

    # ---- 十、最短版本 ----
    story.append(P("十、给录入人员的最短版本（5 条）", h1))
    for it in SHORT_ITEMS:
        story.append(P(it, body))
    return story


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont(CJK, 8)
    canvas.setFillColor(colors.HexColor("#999999"))
    canvas.drawString(18 * mm, 12 * mm, "OOMS 出海商机管理系统 · 线索商机录入指导手册")
    canvas.drawRightString(A4[0] - 18 * mm, 12 * mm, "第 %d 页" % doc.page)
    canvas.restoreState()


def write_pdf():
    doc = SimpleDocTemplate(PDF_OUT, pagesize=A4,
                            leftMargin=18 * mm, rightMargin=18 * mm,
                            topMargin=18 * mm, bottomMargin=18 * mm,
                            title="线索商机录入指导手册", author="OOMS")
    doc.build(build_pdf_story(), onFirstPage=footer, onLaterPages=footer)
    print("PDF written to", PDF_OUT)


# ===========================================================================
# Markdown output
# ===========================================================================
def _md_table(headers, rows):
    lines = ["| " + " | ".join(headers) + " |",
             "| " + " | ".join(["---"] * len(headers)) + " |"]
    for r in rows:
        lines.append("| " + " | ".join(r) + " |")
    return "\n".join(lines)


def build_md():
    L = []
    L.append(f"# 线索商机录入指导手册")
    L.append("")
    L.append(f"> OOMS 出海商机管理系统 · 模块二 Leads & Opportunities")
    L.append(f"> 版本：**{VERSION}** ｜ 更新：**{UPDATED}** ｜ 本手册与同目录 PDF 同源，由 `generate_entry_manual.py` 生成")
    L.append("")
    L.append("---")
    L.append("")

    L.append("## 一、概述")
    L.append("")
    L.append("本模块已调整为**只读渲染**：页面直接读取两份 CSV 渲染，不提供在线新增 / 编辑入口，所有维护通过编辑 CSV 完成。")
    L.append("")
    L.append("1. **data/leads.csv**：维护线索池数据（线索阶段状态固定为「待认领」，无状态列）。")
    L.append("2. **data/opportunities.csv**：维护在管商机与关闭样本，靠「状态」列判定归类。")
    L.append("3. 两份文件按各自 id 区分记录，线索 / 商机 / 关闭样本分别使用 **L- / O- / C-** 前缀；列表三栏（线索池 / 在管商机 / 关闭样本）由「文件来源 + 状态」自动生成。")
    L.append("")

    L.append("## 二、页面取数逻辑")
    L.append("")
    L.append("**三栏划分**")
    L.append("")
    L.append("- **线索池**：来自 leads.csv 的全部记录，状态统一渲染为「待认领」。")
    L.append("- **在管商机**：来自 opportunities.csv、且状态不属于关闭状态的记录。")
    L.append("- **关闭样本**：来自 opportunities.csv、状态为 筛查未通过 / 初评未通过 / 已放弃 之一。")
    L.append("")
    L.append("**指标卡与表格取数**")
    L.append("")
    L.append("顶部 4 张指标卡（线索总数 / 待认领线索 / 在管商机 / 关闭样本）实时计算，不手填。下方表格列依次为：名称 / 国家 / 类型 / 状态 / 归属BG / 评分 / 负责人 / 附件 / 创建时间 / 更新时间。类型 / 归属BG / 来源 / 状态 均以带颜色标签展示。")
    L.append("")

    L.append("## 三、CSV 字段填写")
    L.append("")
    L.append("### 3.1 leads.csv（线索）")
    L.append("")
    L.append(_md_table(["CSV 列名", "内部字段", "必填", "类型 / 枚举", "说明"], LEADS_FIELDS))
    L.append("")
    L.append("**当前表头**")
    L.append("")
    L.append("```")
    L.append(LEADS_HEADER)
    L.append("```")
    L.append("")

    L.append("### 3.2 opportunities.csv（商机 + 关闭样本）")
    L.append("")
    L.append(_md_table(["CSV 列名", "内部字段", "必填", "类型 / 枚举", "说明"], OPP_FIELDS))
    L.append("")
    L.append("**当前表头**")
    L.append("")
    L.append("```")
    L.append(OPP_HEADER)
    L.append("```")
    L.append("")
    L.append("> 商机 CSV 中的「类型」与线索「类型」是同一套枚举（投并购标的 / OTA平台 / 供应链整合 / 支付金融 / 软硬件销售 / 酒店管理），按类型枚举填写即可。")
    L.append("")
    L.append("关闭样本（示例 C-001~C-003）与普通商机同处一份 opportunities.csv，仅「状态」列填三个关闭值之一，页面自动归入「关闭样本」栏，无需单独文件或类别标记。")
    L.append("")

    L.append("### 3.3 附件填写规范（线索 / 商机共用）")
    L.append("")
    L.append("「附件」列用于挂载与本条记录相关的可访问链接（方案文档、调研报告、合同扫描件等的分享地址），不是本地文件上传。")
    L.append("")
    L.append("- **填什么**：一个或多个以 `http://` / `https://` / `ftp://` 开头的 URL。")
    L.append("- **多个链接**：用换行、英文分号 `;` 或竖线 `|` 分隔，页面逐个渲染为可点击链接，点击在新窗口打开。")
    L.append("- **留空**：不填则不显示附件区。")
    L.append("- **非链接文本**：若内容不是合法 URL（不以上述协议开头），按纯文本展示，不会变成链接，也不执行脚本（防 XSS）。")
    L.append("- **单条 URL 内可含逗号**（如查询参数 `?a=1,2`）；附件列用换行 / 分号 / 竖线分隔，不与 CSV 列分隔冲突。")
    L.append("- **示例**：`https://example.com/kansai-hotel-deal` 或 `https://a.com/x ; https://b.com/y`")
    L.append("")

    L.append("## 四、枚举值字典")
    L.append("")
    L.append("**类型（6 选 1，线索 / 商机共用）**")
    L.append("")
    L.append(_md_table(["取值", "页面标签颜色"], TYPE_ENUM))
    L.append("")
    L.append("**归属BG（9 选 1，可留空 = 未指定）**")
    L.append("")
    L.append(" / ".join(BG_ENUM))
    L.append("")
    L.append("**来源（11 选 1）**")
    L.append("")
    L.append(" / ".join(SOURCE_ENUM))
    L.append("")
    L.append("**状态（9 选 1）**")
    L.append("")
    L.append(_md_table(["取值", "页面标签颜色", "归类"], STATUS_ENUM))
    L.append("")
    L.append("**商机评分着色规则**")
    L.append("")
    L.append(_md_table(["分数", "颜色"], SCORE_RULES))
    L.append("")

    L.append("## 五、ID 规则")
    L.append("")
    L.append(_md_table(["类别", "前缀", "生成方式"], ID_RULES))
    L.append("")

    L.append("## 六、CSV 格式要求")
    L.append("")
    L.append("- **编码**：UTF-8（带 BOM 也可，页面解析时自动去除）。")
    L.append("- **分隔符**：英文逗号 `,`。")
    L.append("- **文本含逗号、换行或双引号时**，必须用英文双引号包裹；字段内双引号写成两个双引号 `\"\"`。")
    L.append("- 不要有多余空行或表头拼写错误，否则该列会被忽略或错位。")
    L.append("")

    L.append("## 七、校验规则")
    L.append("")
    L.append(_md_table(["规则", "说明"], CHECK_RULES))
    L.append("")

    L.append("## 八、本地预览与运行要求")
    L.append("")
    L.append("页面依赖 fetch 读取 CSV，**必须经 HTTP 访问**，双击 `file://` 打开会因安全策略读不到数据。")
    L.append("")
    L.append("启动本地服务（推荐用项目自带的 `OOMS_workflow/serve.py`，不要用 `python3 -m http.server`：后者无 no-store 缓存控制，刷新看不到最新 CSV）：")
    L.append("")
    L.append("```bash")
    L.append("cd ~/Desktop/OOMS_workflow")
    L.append("python3 serve.py      # 默认端口 8123，文档根 = ~/Desktop/GIS")
    L.append("```")
    L.append("")
    L.append("浏览器打开：")
    L.append("- 商机看板（主入口）：`http://127.0.0.1:8123/index.html`")
    L.append("- 线索 / 商机录入浏览：`http://127.0.0.1:8123/leads.html`")
    L.append("")
    L.append("注意：看板页 `index.html` 用绝对路径 `/data/*.csv` 取数，必须以 GIS 为根目录通过本服务访问；直接双击 `file://` 或更换文档根都会读不到数据。")
    L.append("")

    L.append("## 九、常见错误")
    L.append("")
    for it in ERROR_ITEMS:
        L.append(it)
    L.append("")

    L.append("## 十、给录入人员的最短版本（5 条）")
    L.append("")
    for it in SHORT_ITEMS:
        L.append(it)
    L.append("")

    return "\n".join(L)


def write_md():
    text = build_md()
    with open(MD_OUT, "w", encoding="utf-8") as f:
        f.write(text)
    print("Markdown written to", MD_OUT)


if __name__ == "__main__":
    write_pdf()
    write_md()
