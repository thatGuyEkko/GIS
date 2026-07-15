# 商业BP页面数据结构说明

本文档仅描述当前商业BP页面原型所使用的数据结构，面向静态 CSV 数据源维护。

当前页面数据拆分为 4 张表：

1. `bp_main.csv`：BP 主记录
2. `bp_tag.csv`：BP 标签记录
3. `bp_stage.csv`：BP 阶段划分记录
4. `bp_attachment.csv`：BP 附件记录

## 1. 文件清单

| 文件名 | 用途 |
|---|---|
| `bp_main.csv` | 存储 BP 列表页与详情页的主信息 |
| `bp_tag.csv` | 存储页面标签类字段，如关联商机、BG、主营产品、市场类型、核心客群 |
| `bp_stage.csv` | 存储详情页“阶段划分”表格数据，并作为顶部财务指标计算来源 |
| `bp_attachment.csv` | 存储详情页附件名称和附件链接 |

## 2. `bp_main.csv`

### 2.1 用途

用于承载以下页面内容：

- BP 列表页：编号、标题、摘要、状态、负责人、提交时间、更新时间
- BP 详情页：标题、头部摘要、状态、币种、负责人、提交时间、更新时间
- BP 详情页：执行摘要 4 个文本字段

### 2.2 字段结构

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `bp_code` | `varchar(32)` | 是 | BP 编号，主键，如 `BP-2026-001` |
| `bp_title` | `varchar(200)` | 是 | BP 标题 |
| `list_summary` | `varchar(255)` | 是 | 列表页摘要 |
| `detail_summary` | `text` | 是 | 详情页头部摘要 |
| `status_display` | `varchar(16)` | 是 | 页面状态展示值 |
| `currency_code` | `char(3)` | 是 | 币种，如 `CNY` / `BRL` |
| `owner_name` | `varchar(64)` | 是 | 负责人 |
| `submitted_date` | `date` | 是 | 提交日期，格式 `YYYY-MM-DD` |
| `updated_date` | `date` | 是 | 更新日期，格式 `YYYY-MM-DD` |
| `product_positioning` | `text` | 是 | 执行摘要 - 产品定位 |
| `execution_plan_summary` | `text` | 是 | 执行摘要 - 执行计划简述 |
| `acquisition_summary` | `text` | 是 | 执行摘要 - 获客方法简介 |
| `supply_chain_summary` | `text` | 是 | 执行摘要 - 供应链发展简介 |

### 2.3 示例

```csv
bp_code,bp_title,list_summary,detail_summary,status_display,currency_code,owner_name,submitted_date,updated_date,product_positioning,execution_plan_summary,acquisition_summary,supply_chain_summary
BP-2026-001,日本关西酒店直签商业计划书,"大阪/京都核心区直签，预测整体 GMV 2.4 亿","围绕大阪与京都核心商圈推进酒店直签，构建商旅和休闲双场景的稳定供给网络。",已通过,CNY,张三,2026-06-25,2026-07-01,"面向日本关西高频出行场景的直签酒店供给方案，以高星商旅和核心旅游区库存为重点。","先完成技术联调与首批商圈酒店签约，再扩展到高星连锁和更稳定的价格运营体系，逐步把供给网络做厚。","以站内商旅流量承接为基础，叠加关西目的地专题、会员权益联动和价格分层投放，优先拿下高意向用户。","从大阪和京都核心商圈的直签酒店切入，逐步扩展到高星连锁与特色住宿资源，并同步沉淀价格与房态运营机制。"
```

## 3. `bp_tag.csv`

### 3.1 用途

用于承载详情页“项目概要”和列表页中的所有标签字段：

- 关联商机
- 涉及配合BG
- 主营产品
- 市场类型
- 核心客群

### 3.2 字段结构

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `bp_code` | `varchar(32)` | 是 | 关联 `bp_main.bp_code` |
| `tag_group` | `varchar(32)` | 是 | 标签分组 |
| `tag_value` | `varchar(100)` | 是 | 标签内容 |
| `display_order` | `int` | 是 | 同一分组内的展示顺序 |

### 3.3 `tag_group` 固定取值

| 值 | 对应页面字段 |
|---|---|
| `related_opportunity` | 关联商机 |
| `bg` | 涉及配合BG |
| `main_product` | 主营产品 |
| `market_type` | 市场类型 |
| `core_customer` | 核心客群 |

### 3.4 枚举建议

#### `bg`

- `酒旅`
- `出行`
- `市场`
- `商旅`
- `体验`

#### `main_product`

- `机票`
- `轨道交通`
- `公车`
- `接送机`
- `租车`
- `酒店`
- `民宿`

#### `market_type`

- `入境游`
- `出境游`
- `境内游`

### 3.5 示例

```csv
bp_code,tag_group,tag_value,display_order
BP-2026-001,related_opportunity,日本关西直签,1
BP-2026-001,related_opportunity,大阪商圈拓展,2
BP-2026-001,related_opportunity,京都高星酒店补齐,3
BP-2026-001,bg,酒旅,1
BP-2026-001,bg,商旅,2
BP-2026-001,bg,市场,3
BP-2026-001,main_product,酒店,1
BP-2026-001,market_type,出境游,1
BP-2026-001,core_customer,跨境休闲客,1
BP-2026-001,core_customer,差旅客,2
BP-2026-001,core_customer,中高端酒店用户,3
```

## 4. `bp_stage.csv`

### 4.1 用途

用于承载详情页“阶段划分”表格。

同时，页面顶部的以下指标不再单独存储，统一从该表计算：

- 整个BP的GMV
- 整个BP的资金投入
- 整个BP的ROI
- 销售成本打正周期
- 累计现金流打正周期

### 4.2 字段结构

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `bp_code` | `varchar(32)` | 是 | 关联 `bp_main.bp_code` |
| `display_order` | `int` | 是 | 阶段展示顺序 |
| `stage_name` | `varchar(32)` | 是 | 阶段名称，如 `阶段1` |
| `stage_topic` | `varchar(200)` | 是 | 阶段主题 |
| `stage_summary` | `text` | 是 | 阶段简要说明 |
| `period_start_date` | `date` | 是 | 期间开始日期，格式 `YYYY-MM-DD` |
| `period_end_date` | `date` | 是 | 期间结束日期，格式 `YYYY-MM-DD` |
| `rent_investment_amount` | `decimal(18,2)` | 是 | 期间租金投入 |
| `fixed_investment_amount` | `decimal(18,2)` | 是 | 固定资金投入 |
| `sales_investment_amount` | `decimal(18,2)` | 是 | 销售投入 |
| `expected_gmv_amount` | `decimal(18,2)` | 是 | 预计销售额 GMV |
| `expected_profit_amount` | `decimal(18,2)` | 是 | 预计利润 |
| `stage_roi_percent` | `decimal(8,2)` | 是 | 当前阶段 ROI |
| `cumulative_cashflow_amount` | `decimal(18,2)` | 是 | 截止该阶段末的累计现金流 |
| `sales_cost_positive_flag` | `boolean` | 是 | 截止该阶段末销售成本是否已打正 |

### 4.3 页面计算口径

#### 整个BP的GMV

`sum(expected_gmv_amount)`

#### 整个BP的资金投入

`sum(rent_investment_amount + fixed_investment_amount + sales_investment_amount)`

#### 整个BP的ROI

`sum(expected_profit_amount) / sum(rent_investment_amount + fixed_investment_amount + sales_investment_amount)`

#### 销售成本打正周期

取第一条 `sales_cost_positive_flag = true` 对应阶段的期末位置。

#### 累计现金流打正周期

取第一条 `cumulative_cashflow_amount >= 0` 对应阶段的期末位置。

### 4.4 示例

```csv
bp_code,display_order,stage_name,stage_topic,stage_summary,period_start_date,period_end_date,rent_investment_amount,fixed_investment_amount,sales_investment_amount,expected_gmv_amount,expected_profit_amount,stage_roi_percent,cumulative_cashflow_amount,sales_cost_positive_flag
BP-2026-001,1,阶段1,完成技术对接与 API 联调,打通库存价格订单回传链路并完成联调验收,2026-07-01,2026-08-31,0,9000000,2800000,0,-11800000,0,-11800000,false
BP-2026-001,2,阶段2,首批 30 家酒店上线,覆盖机场与核心商圈重点酒店形成首轮稳定可售库存,2026-09-01,2026-10-31,0,6500000,1900000,78000000,8200000,97,-3600000,true
BP-2026-001,3,阶段3,扩展高端连锁合作,完成高星酒店补齐优化商旅客群价格与房型结构,2026-11-01,2026-12-31,0,4500000,1300000,162000000,21000000,362,17400000,true
```

## 5. `bp_attachment.csv`

### 5.1 用途

用于承载详情页中的附件信息。

页面展示字段包括：

- 附件名称
- 附件链接

每个 BP 最多允许 10 条附件记录。

### 5.2 字段结构

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `bp_code` | `varchar(32)` | 是 | 关联 `bp_main.bp_code` |
| `display_order` | `int` | 是 | 附件展示顺序，建议从 1 开始 |
| `attachment_name` | `varchar(255)` | 是 | 附件名称 |
| `attachment_url` | `text` | 是 | 附件链接 |

### 5.3 示例

```csv
bp_code,display_order,attachment_name,attachment_url
BP-2026-001,1,日本关西酒店直签商业计划书V1,https://example.com/files/bp-2026-001-v1.pdf
BP-2026-001,2,关西核心商圈酒店签约清单,https://example.com/files/bp-2026-001-hotel-list.xlsx
BP-2026-001,3,关西市场测算附件,https://example.com/files/bp-2026-001-market-model.xlsx
```

## 6. 页面统计项来源

列表页顶部统计无需单独存表，均可由现有 4 张表计算：

| 页面指标 | 计算方式 |
|---|---|
| 当前 BP 台账 | `bp_main` 总行数 |
| BP总数 | `bp_main` 总行数 |
| 关联商机 | `bp_tag` 中 `tag_group = related_opportunity` 的去重数量 |
| 协同BG | `bp_tag` 中 `tag_group = bg` 的去重数量 |
| 市场类型 | `bp_tag` 中 `tag_group = market_type` 的去重数量 |

## 7. 维护规则

1. `bp_code` 是四张表之间的唯一关联键。
2. 同一个 BP 必须先有 `bp_main.csv` 主记录，再补充标签、阶段和附件数据。
3. `bp_stage.csv` 中 `display_order` 必须连续，页面按该顺序展示阶段。
4. `bp_attachment.csv` 中每个 `bp_code` 最多保留 10 条记录。
5. 所有日期统一使用 `YYYY-MM-DD`。
6. `bp_stage.csv` 中金额字段统一存原始数值，不存 `万`、`亿`、`%` 等展示格式。
7. 页面展示时再将数值格式化为 `万`、`亿`、`%` 等形式。

