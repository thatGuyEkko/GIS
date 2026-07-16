# BP 页面数据录入说明

这份文档面向维护 BP 页面数据的同学，重点说明 `data` 目录下几份 CSV 应该怎么填、哪些内容会自动计算、哪些字段会直接影响前端页面展示。

当前 BP 模块已经调整为：

1. BP 列表页直接读取 `data` 目录中的 CSV。
2. BP 详情页统一使用 `bp-details/index.html?bp_code=对应编号` 打开。
3. 页面不再维护多份独立的 `bp-details` 静态内容，详情页内容全部按 `bp_code` 从 CSV 中取数渲染。

## 一、需要维护的文件

BP 页面当前依赖 4 份数据文件：

| 文件名 | 作用 |
|---|---|
| `data/bp_main.csv` | 维护 BP 的主信息、列表摘要、详情页摘要、执行摘要 |
| `data/bp_tag.csv` | 维护项目概要中的标签信息 |
| `data/bp_stage.csv` | 维护阶段划分表格，同时作为顶部财务指标的计算来源 |
| `data/bp_attachment.csv` | 维护详情页附件名称与附件链接 |

这 4 份文件通过同一个字段 `bp_code` 关联。新增一个 BP 时，至少需要先补 `bp_main.csv` 主记录，其他表再按同一个 `bp_code` 继续补充。

## 二、录入前先理解页面怎么取数

### 1. 列表页

BP 列表页会从以下数据读取内容：

- 编号、标题、摘要、状态、负责人、提交时间、更新时间：来自 `bp_main.csv`
- 关联商机、涉及配合 BG、主营产品、市场类型：来自 `bp_tag.csv`

### 2. 详情页

详情页访问方式固定为：

```text
bp-details/index.html?bp_code=2026-1-US
```

页面会根据 URL 中的 `bp_code` 去 4 份 CSV 里查找对应记录：

- 头部标题、摘要、状态、币种、负责人、提交/更新日期：来自 `bp_main.csv`
- 项目概要标签：来自 `bp_tag.csv`
- 执行摘要 4 个说明块：来自 `bp_main.csv`
- 阶段划分表格：来自 `bp_stage.csv`
- 附件列表：来自 `bp_attachment.csv`

只要 `bp_code` 一致，前端就会自动渲染对应详情页，不需要再新建新的 `bp-details` HTML 文件。

## 三、每份 CSV 怎么填

### 1. `bp_main.csv`

#### 用途

这一张表负责 BP 的主体信息，是整份 BP 的主档案。

#### 字段说明

| 字段名 | 是否必填 | 说明 |
|---|---|---|
| `bp_code` | 是 | BP 唯一编号。四张表都靠它关联，必须唯一且保持一致。 |
| `bp_title` | 是 | BP 标题，用于列表页和详情页标题。 |
| `list_summary` | 是 | 列表页摘要。建议 1 句话，方便扫描。 |
| `detail_summary` | 是 | 详情页头部摘要。建议 1 段话，概括项目方向、目标市场和当前策略。 |
| `status_display` | 是 | 页面展示状态，例如 `已通过`、`审批中`、`草稿`、`未通过`、`已驳回`。 |
| `currency_code` | 是 | 币种代码，例如 `USD`、`CNY`。 |
| `owner_name` | 是 | 负责人姓名。 |
| `submitted_date` | 是 | 提交日期，建议使用 `YYYY-MM-DD`。 |
| `updated_date` | 是 | 更新日期，建议使用 `YYYY-MM-DD`。 |
| `product_positioning` | 是 | 执行摘要中的“产品定位”。 |
| `execution_plan_summary` | 是 | 执行摘要中的“执行计划简述”。 |
| `acquisition_summary` | 是 | 执行摘要中的“获客方法简介”。 |
| `supply_chain_summary` | 是 | 执行摘要中的“供应链发展简介”。 |

#### 当前表头

```csv
bp_code,bp_title,list_summary,detail_summary,status_display,currency_code,owner_name,submitted_date,updated_date,product_positioning,execution_plan_summary,acquisition_summary,supply_chain_summary
```

#### 填写建议

1. `bp_code` 建议保持短而稳定，例如 `2026-1-US`。
2. `status_display` 会直接显示在页面标签上，尽量使用统一写法，不要同义词混填。
3. 日期如果不是标准日期格式，列表页会原样展示，不会自动纠错。

### 2. `bp_tag.csv`

#### 用途

这张表用于维护“项目概要”区域的标签内容，也会影响列表页对应列的展示。

#### 字段说明

| 字段名 | 是否必填 | 说明 |
|---|---|---|
| `bp_code` | 是 | 对应 `bp_main.csv` 中的 BP 编号。 |
| `tag_group` | 是 | 标签分组。 |
| `tag_value` | 是 | 标签文本。 |
| `display_order` | 是 | 同一分组内的展示顺序，从小到大排列。 |

#### `tag_group` 可用值

| tag_group | 页面显示位置 |
|---|---|
| `related_opportunity` | 关联商机 |
| `bg` | 涉及配合BG |
| `main_product` | 主营产品 |
| `market_type` | 市场类型 |
| `core_customer` | 核心客群 |

#### 当前表头

```csv
bp_code,tag_group,tag_value,display_order
```

#### 填写建议

1. 同一 BP 可以在同一个分组下写多行，页面会按 `display_order` 排序后展示。
2. 不要把多个标签塞在同一个 `tag_value` 里，应该拆成多行。
3. `display_order` 建议从 `1` 开始连续填写。

### 3. `bp_stage.csv`

#### 用途

这张表最关键。它不仅控制详情页“阶段划分”表格，也负责计算详情页顶部的几个财务指标。

当前页面会从这张表自动计算：

- 整个BP的GMV
- 整个BP的资金投入
- 整个BP的ROI
- 销售成本打正周期
- 累计现金流打正周期
- 每个阶段的ROI

#### 当前表头

```csv
bp_code,display_order,stage_name,stage_topic,stage_summary,period_start_date,period_end_date,fixed_investment_amount,sales_investment_amount,expected_gmv_amount,expected_profit_amount,cumulative_cashflow_amount,sales_cost_positive_flag
```

#### 字段说明

| 字段名 | 是否必填 | 说明 |
|---|---|---|
| `bp_code` | 是 | 对应 BP 编号。 |
| `display_order` | 是 | 阶段顺序，页面按这个顺序展示。 |
| `stage_name` | 是 | 阶段名称，例如 `冷启动`、`成长期`。 |
| `stage_topic` | 是 | 阶段主题。 |
| `stage_summary` | 是 | 阶段简要说明。 |
| `period_start_date` | 是 | 阶段起始时间。 |
| `period_end_date` | 是 | 阶段结束时间。 |
| `fixed_investment_amount` | 是 | 固定资金投入。 |
| `sales_investment_amount` | 是 | 销售投入。 |
| `expected_gmv_amount` | 是 | 该阶段预计销售额 GMV。 |
| `expected_profit_amount` | 是 | 该阶段预计利润。 |
| `cumulative_cashflow_amount` | 是 | 截止该阶段末的累计现金流。 |
| `sales_cost_positive_flag` | 是 | 截止该阶段末销售成本是否打正，填 `TRUE` 或 `FALSE`。 |

#### 这张表有两点和之前不一样

##### 1. 不再维护“期间租金投入”

页面已经去掉“期间租金投入”这一列，因此 CSV 中也不再保留 `rent_investment_amount` 字段。

##### 2. 不再手填 ROI

页面已经改为自动计算 ROI，因此 CSV 中也不再保留 `stage_roi_percent` 字段。

#### ROI 的实际计算口径

##### 阶段 ROI

每个阶段的 ROI 会由前端自动计算：

```text
阶段ROI = 预计利润 / -(销售投入 + 固定资金投入)
```

##### 整个 BP 的 ROI

整个 BP 的 ROI 也由前端自动计算：

```text
整个BP ROI = 整个BP预计利润 / -(整个BP销售投入 + 整个BP固定资金投入)
```

其中：

- 整个BP预计利润 = 所有阶段 `expected_profit_amount` 之和
- 整个BP销售投入 + 固定资金投入 = 所有阶段 `sales_investment_amount + fixed_investment_amount` 之和

#### 金额填写规则

这一张表里的金额字段统一填写原始数值，不要填写：

- `万`
- `亿`
- `%`
- 千分位逗号

例如：

- 正确：`-750000`
- 错误：`-75万`
- 错误：`-750,000`

#### 正负数规则

为了让页面能正确表达资金流向，建议统一按下面方式录入：

| 场景 | 建议写法 |
|---|---|
| 成本、投入、支出 | 负数 |
| 收入、利润、现金回正后累计值 | 按实际正负填写 |

页面现在会按正负值自动渲染颜色：

- 正数：正向颜色
- 负数：负向颜色
- 0：中性颜色

#### 时间填写规则

`period_start_date` 和 `period_end_date` 当前页面是按文本原样展示，不强制要求一定是标准日期。

也就是说，下面几种都可以：

- `2026-07-01`
- `2026Q3`
- `2027H1`

但同一个 BP 内建议保持同一套写法，不要有的阶段写季度，有的阶段写具体日期。

#### 打正字段填写规则

`sales_cost_positive_flag` 只能填写布尔值：

- `TRUE`
- `FALSE`

前端会取第一条 `TRUE` 所在阶段，作为“销售成本打正周期”。

累计现金流打正周期则不需要额外维护，页面会自动找第一条 `cumulative_cashflow_amount >= 0` 的阶段。

### 4. `bp_attachment.csv`

#### 用途

这张表维护详情页底部的附件列表。

#### 字段说明

| 字段名 | 是否必填 | 说明 |
|---|---|---|
| `bp_code` | 是 | 对应 BP 编号。 |
| `display_order` | 是 | 展示顺序。 |
| `attachment_name` | 是 | 附件名称。 |
| `attachment_url` | 是 | 附件链接，建议使用完整的 `https://` 地址。 |

#### 当前表头

```csv
bp_code,display_order,attachment_name,attachment_url
```

#### 填写建议

1. `attachment_name` 直接写用户能看懂的名字。
2. `attachment_url` 建议使用可直接访问的链接。
3. 页面支持按顺序展示多条附件，建议 `display_order` 从 `1` 开始。

## 四、新增一个 BP 的推荐录入顺序

建议按下面顺序维护：

1. 先在 `bp_main.csv` 新增 1 行主记录。
2. 再在 `bp_tag.csv` 按分组补齐标签。
3. 再在 `bp_stage.csv` 补阶段数据。
4. 最后在 `bp_attachment.csv` 补附件。
5. 打开 `bp.html` 检查列表页是否有该 BP。
6. 打开 `bp-details/index.html?bp_code=你的编号` 检查详情页是否能正确渲染。

## 五、常见错误

### 1. 四张表里的 `bp_code` 不一致

这是最常见的问题。只要有一张表里的 `bp_code` 拼写不一致，页面对应模块就会缺数据。

### 2. 金额写成了带单位的文本

例如把 `-400000` 写成 `-40万`。前端不会帮你换算，这会直接导致计算错误。

### 3. 手工填写 ROI

现在已经不需要维护 ROI 字段了。只要维护好：

- `fixed_investment_amount`
- `sales_investment_amount`
- `expected_profit_amount`

页面会自动算阶段 ROI 和整个 BP 的 ROI。

### 4. 还在维护“期间租金投入”

这个字段已经从页面和 CSV 结构中移除，不需要再保留。

### 5. 布尔值写成“是/否”

`sales_cost_positive_flag` 要写 `TRUE` 或 `FALSE`，不要写成中文。

## 六、当前示例

下面是当前项目里 `bp_stage.csv` 的示例表头和写法：

```csv
bp_code,display_order,stage_name,stage_topic,stage_summary,period_start_date,period_end_date,fixed_investment_amount,sales_investment_amount,expected_gmv_amount,expected_profit_amount,cumulative_cashflow_amount,sales_cost_positive_flag
2026-1-US,1,冷启动,小规模验证跑通盈利模型,以华人留学生为种子用户，在低成本投入下验证“获客-转化-二次消费-盈利”闭环；依托校园场景、机票盲盒、集团机酒供应链与 TicketNetwork 白标资源完成冷启动。,2026Q3,2027Q1,-400000,-750000,6000000,1100000,-50000,FALSE
2026-1-US,2,成长期,供应链建设,将已验证打法复制至全美高校，自建本地玩乐与小交通直采供应链，形成高毛利护城河，并利用溢出流量灰度验证美国本土市场能力。,2027Q2,2027Q4,-440000,-1400000,11000000,2000000,140000,TRUE
2026-1-US,3,拓展期,破圈进入美国主流市场,从“针对华人留学生的旅行玩乐平台”升级为“面向美国本土 Z 世代大学生的主流旅行平台”，依托拉美短途独家供给、Meta 比价流量承接、校园裂变与广告变现打开增长与利润空间。,2028Q1,2028Q4,-780000,-4000000,30000000,5600000,1000000,TRUE
```

## 七、给录入人员的最短版本

如果只记 5 件事，记这 5 条：

1. 所有表都靠 `bp_code` 关联。
2. 详情页只用一个入口：`bp-details/index.html?bp_code=...`。
3. `bp_stage.csv` 不再有“期间租金投入”和“ROI”字段。
4. 投入类金额建议统一写负数，页面会按正负值显示颜色。
5. ROI 不用手算，页面会自动按最新公式计算。
