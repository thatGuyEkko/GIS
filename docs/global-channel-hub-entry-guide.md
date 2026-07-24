# 全球渠道信息共享看板 CSV 录入说明

这份说明只用来告诉录入人员怎么填写 CSV。

当前看板一共读取 4 份文件：

- `data/channel_main.csv`
- `data/channel_sales_info.csv`
- `data/channel_supply_info.csv`
- `data/contacts.csv`

其中：

- `channel_main.csv` 是主表，必须先录
- 另外 3 张表都通过 `channel_id` 关联主表

---

## 一、录入前先看这几个规则

1. 4 张表里，同一个渠道的 `channel_id` 必须完全一致。
2. `channel_main.csv` 没有这条渠道，其它表填了也不会生效。
3. `channel_sales_info.csv` 里，同一个 `channel_id` 只能有 1 行。
4. `channel_supply_info.csv` 里，同一个 `channel_id` 只能有 1 行。
5. `contacts.csv` 里，同一个 `channel_id` 可以有多行，一行代表 1 个联系人。
6. 多个值写在同一个单元格里，用英文逗号 `,` 分隔，建议整格加双引号。
7. 空值直接留空，不要写 `-`、`/`、`无`。
8. CSV 文件建议统一保存为 `UTF-8`。

示例：

```csv
"销售渠道,供应渠道"
"SG,AE,JP"
"API,商家后台"
"en,zh"
```

---

## 二、`channel_main.csv`

这张表是渠道主档案，每个渠道 1 行。

### 字段说明

| 字段名 | 说明 |
| --- | --- |
| `channel_id` | 渠道唯一编号，4 张表靠它关联。 |
| `channel_name` | 渠道名称。 |
| `channel_types` | 渠道类型，可填 `销售渠道`、`供应渠道`，如果两种都有就写 `"销售渠道,供应渠道"`。 |
| `regions` | 覆盖国家 / 地区，多个值用英文逗号分隔，必须输入ISO国家二字码，如 `SG`、`AE`、`JP`。 |
| `short_intro` | 简短介绍，用在列表里。 |
| `intro` | 详细介绍，用在详情里。可留空。 |

### 录入注意

- 一条渠道只写 1 行。
- `channel_types` 决定这个渠道有没有销售能力、供应能力。
- `regions` 建议统一写大写地区码，不要一部分写中文、一部分写代码。

---

## 三、`channel_sales_info.csv`

这张表写销售侧信息。只有销售渠道才需要填。

### 字段说明

| 字段名 | 说明 |
| --- | --- |
| `channel_id` | 对应主表里的渠道编号。 |
| `sales_sub_types` | 销售子类型，如 `OTA`、`TMC`、`旅行社`。 |
| `sales_products` | 可售产品，如 `机票`、`酒店`、`玩乐门票`。 |
| `sales_biz_types` | 销售模式，如 `B2B`、`B2C`、`B2B2C`。 |
| `sales_api_methods` | 对接方式，如 `API`、`商家后台`、`线下`。 |
| `sales_languages` | 可支持语言，必须输入ISO语言二字码，如 `en`、`zh`、`ja`。 |

### 录入注意

- 同一个渠道只保留 1 行。
- 一个字段里有多个值时，不要拆成多行，写在同一个单元格里。
- 如果渠道没有销售能力，这张表不用写。

---

## 四、`channel_supply_info.csv`

这张表写供应侧信息。只有供应渠道才需要填。

### 字段说明

| 字段名 | 说明 |
| --- | --- |
| `channel_id` | 对应主表里的渠道编号。 |
| `supply_sub_types` | 供应商类型，如 `航司`、`景区`、`酒店集团/单体酒店`。 |
| `supply_products` | 可供产品，如 `机票`、`酒店`、`玩乐门票`。 |
| `supply_api_methods` | 对接方式，如 `API`、`商家后台`、`线下`。 |

### 录入注意

- 同一个渠道只保留 1 行。
- 多个产品、多个对接方式都写在同一个单元格里。
- 如果渠道没有供应能力，这张表不用写。

---

## 五、`contacts.csv`

这张表写联系人信息。一行代表 1 位联系人。

### 字段说明

| 字段名 | 说明 |
| --- | --- |
| `contact_id` | 联系人唯一编号。 |
| `channel_id` | 对应的渠道编号。 |
| `last_name` | 姓。 |
| `first_name` | 名。 |
| `title` | 职位。 |
| `languages` | 可沟通语言，多个值用英文逗号分隔，建议写代码，如 `en`、`zh`。 |
| `responsibility` | 负责范围或职责说明。 |
| `is_sales` | 是否是销售对接人，填 `Y` 或 `N`。 |
| `is_supply` | 是否是供应对接人，填 `Y` 或 `N`。 |
| `phone` | 电话。 |
| `email` | 邮箱。 |
| `social_type_1` | 第 1 个社交方式名称，如 `LinkedIn`、`WeChat`。 |
| `social_link_1` | 第 1 个社交方式链接。 |
| `social_type_2` | 第 2 个社交方式名称。 |
| `social_link_2` | 第 2 个社交方式链接。 |

### 录入注意

- 一行只写 1 位联系人。
- `last_name` 和 `first_name` 至少填一个。
- `is_sales`、`is_supply` 只写 `Y` 或 `N`。
- `social_type_*` 和 `social_link_*` 要成对填写。

---

## 六、最容易出错的地方

1. `channel_id` 写得不一致，导致关联不上。
2. 销售表或供应表里，同一个渠道写了多行。
3. 多个值拆成了多行，而不是写在同一个单元格里。
4. 联系人职责没有写 `Y` / `N`，导致识别不准确。
5. 单元格里本身有逗号，但没有加双引号。

---

## 七、最简录入顺序

1. 先在 `channel_main.csv` 新增渠道主信息。
2. 有销售能力，就补 `channel_sales_info.csv`。
3. 有供应能力，就补 `channel_supply_info.csv`。
4. 最后在 `contacts.csv` 补联系人。
