# Erasmus Student Handover MVP 方案核查与实施计划

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 核实原方案的市场、产品、合规和技术可行性，并把它收敛为能够在 Valencia/MERCURI 小范围验证“真实资源交接”的 MVP。

**Architecture:** 先以人工运营的供给验证通过冷启动门槛，再建设单城的 Next.js + Supabase 信息板。公开帖子与私密联系方式分离；所有有效性、所有权和管理权限由 PostgreSQL 约束与 RLS 保证；完成状态与联系事件形成可测量闭环。

**Tech Stack:** Next.js App Router、TypeScript、Tailwind CSS、Supabase Auth/PostgreSQL/Storage、Vitest、Playwright、pgTAP、Vercel。

---

## 一、核查结论

**结论：有条件继续（Conditional Go），但原文不应直接作为开发清单。**

方案抓住了真实痛点，也正确选择了“单城、结构化、自动失效、站外联系”四个差异点。不过它仍然混合了三个不同阶段：需求验证、单城 MVP、可复制的多城平台。若全部按 MVP 开发，会同时引入冷启动、住宿诈骗、隐私、内容治理和多角色后台，验证周期过长。

必须先改的六点：

1. 首轮只运营 **Valencia + MERCURI/可直接触达的交换生**；首页不展示其他空城市，也不需要城市选择器。
2. 首轮只接受 `Offering`；`Looking for` 先用需求登记表收集，避免供需方向翻倍和信息流稀释。
3. 分类收敛为 `Room handover lead` 与 `Item`；免费物品是 `Item.price = 0`，不是独立分类。
4. “住宿”只表示房间交接线索，不做短租旅游、整套房源 marketplace、付款、合同或担保；发布者必须确认租约/房东允许转租或承租人替换。
5. 联系方式不得进入公开帖子查询；只向已登录且已验证邮箱的用户按次揭示，并记录唯一联系事件。
6. 举报不能只有一个按钮：至少要区分普通社区举报与“涉嫌违法内容通知”，记录处理结果并通知举报人与发布者；公开试点前由西班牙/EU 合资格法律人士复核。

## 二、证据核查

| 原方案判断 | 核查结果 | 修正 |
|---|---|---|
| 2024 年 Erasmus+ 流动参与人数接近 150 万 | 数字基本正确，但覆盖学生、教师、培训者、青年工作者等，不能当作学生市场规模 | 只用于说明项目规模；Valencia 可服务市场必须通过学校/项目人数和本地访谈另算 |
| 住宿与生活成本是重要痛点 | 有证据支持；ESN 调研把住宿、生活成本列为交换期主要问题 | 可保留，但“二手交接”仍需单独验证，不能由住宿痛点推导 |
| 结构化、时效性可形成差异 | 是合理假设，不是已验证事实 | 用“7 天内获得有效联系”和“确认交接率”验证，而不是只看注册量 |
| 住宿赛道有成熟竞争者 | 已确认；Valencia 当前已有大量房间供给及带验证/保护的服务 | 产品不能以“房源更多”为竞争点，只能验证同届学生交接、时间匹配和可信圈层 |
| 举报 + 免责声明足够 | 不足 | 增加可追踪的通知—处理机制、管理决定记录、申诉路径与法律复核 |
| Next.js + Supabase 足够支撑 MVP | 可行 | 需要 RLS、私密联系方式、Storage 策略、迁移和数据库测试；管理员权限不能存在可由用户修改的 metadata 中 |

依据：

- [Erasmus+ 2024 年报告摘要](https://erasmus-plus.ec.europa.eu/whats-new/news/almost-15-million-people-went-on-an-erasmus-mobility-in-2024-according-to-latest-report)
- [ESNsurvey XV](https://www.esn.org/sites/default/files/news/xv-esnsurvey_final-report.pdf)
- [HousingAnywhere Valencia 学生住宿页](https://housinganywhere.com/s/Valencia--Spain/student-accommodation)
- [Idealista Valencia 学生合租房源页](https://www.idealista.com/alquiler-habitacion/valencia/valencia/con-compartidos_con-estudiantes/)
- [欧盟委员会 DSA 问答](https://digital-strategy.ec.europa.eu/en/faqs/digital-services-act-questions-and-answers)
- [欧盟委员会 DSA notice-and-action 说明](https://digital-strategy.ec.europa.eu/en/policies/dsa-notice-and-action-mechanism)
- [西班牙 AEPD：默认数据保护](https://www.aepd.es/derechos-y-deberes/cumple-tus-deberes/medidas-de-cumplimiento/proteccion-de-datos-por-defecto)
- [Valencia 市政府材料：转租须由租约允许](https://sede.valencia.es/sede/descarga/doc/DOCUMENT_1_20250008599993)
- [Supabase RLS 文档](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Storage 权限文档](https://supabase.com/docs/guides/storage/security/access-control)
- [Supabase Cron 文档](https://supabase.com/docs/guides/cron)

> 合规部分是产品风险识别，不构成法律意见。服务提供者所在地、是否构成经济活动、住宿内容和商业模式都会改变适用义务。

## 三、用 “Subtract” 约束得到的三个版本

> 约束：删除到只剩能够证明“学生交接比群聊更容易完成”的最小闭环。

### 方案 A：人工 Concierge Board

发布者通过表单提交信息，运营者审核后在单页信息板展示；联系与完成状态由运营者手工登记。

- 周期：2–4 天
- 技术：Next.js 单页或现成表单 + 私有表格
- 优点：最快验证供给、需求与运营负担
- 缺点：不可扩展、人工工作较多

### 方案 B：单城 Cohort Board（推荐的产品 MVP）

Valencia 单城、邀请圈层、仅供给帖；支持结构化发布、筛选、登录后联系、完成/过期、举报和最小管理队列。

- 周期：约 2–3 周的聚焦开发，前提是方案 A 达标
- 技术：Next.js + Supabase + Vercel
- 优点：足以验证真实交接，同时控制隐私和审核风险
- 缺点：不是公开多城 marketplace，早期增长上限较低

### 方案 C：原方案的 Marketplace Lite

多城市、供需双向、住宿/二手/赠送、完整个人中心、提醒和管理后台。

- 周期：至少 6–10 周且需要持续运营
- 技术：Next.js + Supabase + 邮件服务 + 内容治理流程
- 优点：产品完整、可复制
- 缺点：在验证需求前承担冷启动与合规成本，不建议作为第一版

**决策：先 A，达到门槛后做 B；C 只在 Valencia 的交接率达标后进入规划。**

## 四、验证门槛与指标定义

### Gate 0：问题与供给验证（开发前）

1. 访谈 15–20 名 MERCURI/Valencia 交换生，至少覆盖即将离开和即将到达两端。
2. 记录他们最近一次找房/处理物品的渠道、耗时、失败原因和诈骗经历，不只询问“会不会使用”。
3. 收集至少 20 条愿意在两周内公开的真实供给，其中至少 8 条房间交接线索、10 条物品，余量不限。
4. 明确一名运营负责人和报告处理 SLA；无人负责时不得公开上线。

**通过条件：** 至少 10 名受访者提供近期真实案例，且至少 12 名发布者愿意让其信息进入人工试点。

### Gate 1：人工试点（2–4 周）

精确定义指标：

- `7 日有效联系率` = 发布后 7 天内获得至少 1 位唯一、符合条件联系人的帖子数 / 同期发布帖数。
- `14 日确认交接率` = 14 天内被发布者标记为成功交接的帖子数 / 已观察满 14 天的帖子数。
- `首次联系中位时长` = 发布到首位唯一联系人揭示联系方式的中位小时数。
- `过期健康度` = 默认列表中实际已失效但仍显示的帖子数 / 默认列表帖子数。
- `安全护栏` = 每百帖举报数、诈骗举报数、举报处理时长、联系方式滥用投诉数。

**进入开发 Gate 2 的建议门槛：** 20 条真实供给、至少 8 次唯一有效联系、至少 5 次发布者确认交接，且没有未解决的高危诈骗事件。

### Gate 2：产品 MVP（4 周试点）

建议成功门槛：

- 30 条合格发布；
- 7 日有效联系率 ≥ 40%；
- 至少 8 次确认交接；
- 过期健康度 ≤ 5%；
- 高危举报 24 小时内首次处理；
- 至少 30% 的发布者表示愿意再次发布。

注册数、页面浏览量和联系按钮总点击数只做辅助指标，不能单独证明成功。

## 五、产品 MVP 的确定范围

### 必须包含

- Valencia 固定城市信息流；
- 邮箱 magic link/OTP 登录与邮箱验证；不做密码和忘记密码；
- 两类供给帖：`housing_lead`、`item`；
- 图片、区域、价格、可用时间、过期时间、必要描述；
- 发布、编辑、撤回、保留、完成、自动失效；
- 登录后揭示站外联系方式；
- 详情查看、联系方式揭示和完成事件；
- 普通举报、违法内容通知入口和最小管理员处理队列；
- 隐私、条款、安全指南与禁止发布清单；
- 移动端和基础无障碍。

### 明确排除

- 多城市选择与 Coming Soon 页面；
- `Looking for` 公开帖子；
- 独立 `Give Away` 分类；
- 评论、站内聊天、点赞、收藏、关注；
- 地图、推荐、翻译、支付、押金、合同；
- 旅行短租、旅游住宿、整套房源、职业房东/中介；
- 自动邮件提醒；首版依靠列表查询时剔除过期帖，定时提醒延后；
- 可由运营人员直接在 Supabase Dashboard 完成的城市/分类配置后台。

## 六、修正后的关键规则

1. **身份表述：** 邮箱验证只能标记为 `Email verified`，学校由用户填写时不得展示为 `Student verified`。
2. **最少资料：** 注册只要求邮箱和显示名称；学校、到达/离开日期均为可选，并逐字段控制是否公开。
3. **联系方式隔离：** `posts` 的匿名查询永远不返回联系方式；由服务端 endpoint 在权限检查和事件记录后返回一次站外链接。
4. **住宿授权：** 发布房间交接线索前，用户必须确认有权发布且租约/房东允许相关交接；不得上传合同、护照或精确门牌。
5. **状态简化：** 使用 `active | reserved | completed | expired | hidden`；成功原因另存 `room_handed_over | sold | given_away | withdrawn`，不要把类别语义混进状态。
6. **时效优先：** 活跃列表必须同时满足 `status IN ('active','reserved') AND expires_at > now()`；Cron 只负责物化 `expired` 状态，不能成为隐藏过期帖的唯一保障。
7. **价格单一来源：** 价格只存于 `posts.price_minor` 和 `currency`；住宿不再重复保存 `monthly_rent`。
8. **管理权：** 管理员角色放在不可由用户修改的 `app_metadata` 或数据库角色表，不使用 `raw_user_meta_data`。
9. **图片：** 限制 MIME、大小和数量；去除 EXIF；文件路径按用户与帖子隔离；删除帖子时清理对象。
10. **内容治理：** 所有隐藏/删除决定写入审计记录；保留举报人通知和发布者申诉所需的数据。

## 七、建议数据模型

| 表 | 关键字段 | 说明 |
|---|---|---|
| `profiles` | `user_id`, `display_name`, `university`, `is_suspended`, timestamps | 邮箱留在 `auth.users`；公开资料通过安全视图输出 |
| `cities` | `id`, `slug`, `name`, `country_code`, `is_active` | 首版只 seed `valencia`，UI 不显示选择器 |
| `posts` | `id`, `owner_id`, `city_id`, `kind`, `title`, `description`, `area`, `price_minor`, `currency`, `available_from`, `expires_at`, `status`, `completion_reason`, timestamps | 统一状态和价格；添加字段约束与查询索引 |
| `housing_details` | `post_id`, `monthly_period`, `deposit_minor`, `furnished`, `bills_included`, `handover_permission_ack` | 不存精确住址或合同副本 |
| `item_details` | `post_id`, `item_category`, `condition`, `quantity`, `pickup_area` | `price_minor = 0` 表示赠送 |
| `post_contacts` | `post_id`, `method`, `value_encrypted_or_private` | 仅服务端读取；不进入公开 view |
| `post_images` | `id`, `post_id`, `owner_id`, `storage_path`, `sort_order` | 存路径而不是任意外部 URL |
| `contact_events` | `post_id`, `viewer_id`, `created_at` | 用唯一用户/帖子/时间窗去重，衡量有效联系 |
| `reports` | `id`, `post_id`, `reporter_id/email`, `notice_type`, `reason`, `details`, `status`, timestamps | 允许未登录者提交违法内容通知 |
| `moderation_actions` | `id`, `report_id`, `actor_id`, `action`, `reason`, `created_at` | 决策审计与通知依据 |

必须建立的索引：

- `posts(city_id, kind, status, expires_at, created_at DESC)`；
- `posts(owner_id, created_at DESC)`；
- `reports(status, created_at)`；
- `contact_events(post_id, viewer_id, created_at)`。

## 八、目标文件结构

当前仓库只有未提交的空 Git 仓库，因此以下均为计划中的新路径：

```text
package.json
.env.example
src/app/(public)/page.tsx
src/app/(public)/posts/[id]/page.tsx
src/app/(public)/safety/page.tsx
src/app/(public)/privacy/page.tsx
src/app/(public)/terms/page.tsx
src/app/(auth)/login/page.tsx
src/app/(member)/posts/new/page.tsx
src/app/(member)/posts/[id]/edit/page.tsx
src/app/(member)/dashboard/page.tsx
src/app/admin/reports/page.tsx
src/app/api/posts/[id]/contact/route.ts
src/app/api/reports/route.ts
src/lib/supabase/client.ts
src/lib/supabase/server.ts
src/lib/auth/require-user.ts
src/lib/posts/queries.ts
src/lib/posts/schema.ts
src/lib/moderation/schema.ts
src/components/posts/post-card.tsx
src/components/posts/post-form.tsx
src/components/safety/housing-warning.tsx
supabase/config.toml
supabase/seed.sql
supabase/migrations/202608030001_initial_schema.sql
supabase/migrations/202608030002_rls_and_storage.sql
supabase/migrations/202608030003_metrics_and_moderation.sql
supabase/migrations/202608030004_expiry_job.sql
supabase/tests/database/rls.test.sql
supabase/tests/database/lifecycle.test.sql
tests/unit/post-schema.test.ts
tests/e2e/browse.spec.ts
tests/e2e/publish.spec.ts
tests/e2e/contact.spec.ts
tests/e2e/report.spec.ts
docs/operations/moderation-runbook.md
docs/operations/pilot-scorecard.md
```

## 九、逐步实施计划

### Task 1：完成开发前验证

**Objective:** 用真实行为证据替代对需求和供给的猜测。

**Files:**

- Create: `docs/research/interview-script.md`
- Create: `docs/research/validation-results.md`
- Create: `docs/operations/pilot-scorecard.md`

**Steps:**

1. 写出访谈问题，避免“你会使用吗”类诱导问法。
2. 逐个记录最近一次找房/处理物品的行为、耗时和结果。
3. 建立匿名化供给清单并获得发布同意。
4. 按 Gate 0 算出结果；未通过时停止产品开发并重新定位。
5. 由产品负责人签署 go/no-go 结论。

**Validation:** `validation-results.md` 包含样本、原始问题、汇总口径、反例和 Gate 结论，且不保存不必要的个人信息。

### Task 2：冻结范围与运营责任

**Objective:** 在写代码前锁定内容规则、审核责任和成功指标。

**Files:**

- Create: `docs/product/mvp-scope.md`
- Create: `docs/operations/moderation-runbook.md`
- Create: `docs/operations/prohibited-content.md`

**Steps:**

1. 将第五节的包含/排除项逐条写入 scope。
2. 指定举报收件人、24 小时高危处理 SLA 和升级联系人。
3. 定义诈骗、违法商品、歧视性住宿偏好、重复帖的处理规则。
4. 由法律人士复核 DSA、GDPR/LSSI、条款和住宿表述。
5. 记录未解决问题；任何高风险法律问题阻断公开试点。

**Validation:** 产品、运营和法律负责人对 scope 与 runbook 留下明确版本和批准日期。

### Task 3：脚手架与测试基线

**Objective:** 建立可重复运行的 Next.js、Supabase 和测试环境。

**Files:**

- Create: `package.json`
- Create: `.env.example`
- Create: `src/app/layout.tsx`
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `supabase/config.toml`

**Steps:**

1. 初始化 Next.js App Router + TypeScript + Tailwind。
2. 增加 `lint`、`typecheck`、`test`、`test:e2e` 脚本。
3. 配置浏览器与服务端 Supabase client，service role key 仅允许服务端环境读取。
4. 写一个失败的环境变量校验单测并确认失败。
5. 实现最小校验并确认单测通过。
6. 提交 `chore: scaffold Valencia handover MVP`。

**Validation:** `npm run lint && npm run typecheck && npm run test` 全部成功；`.env.example` 无真实密钥。

### Task 4：数据库约束、RLS 与 Storage

**Objective:** 从数据库层保证最小数据模型、所有权和联系方式隔离。

**Files:**

- Create: `supabase/migrations/202608030001_initial_schema.sql`
- Create: `supabase/migrations/202608030002_rls_and_storage.sql`
- Create: `supabase/seed.sql`
- Create: `supabase/tests/database/rls.test.sql`
- Create: `supabase/tests/database/lifecycle.test.sql`

**Steps:**

1. 先写 pgTAP 失败测试：匿名用户只能读未过期活跃帖。
2. 写失败测试：普通用户不能读取 `post_contacts`。
3. 写失败测试：用户只能改自己的帖子和图片。
4. 建表、约束、索引和 `valencia` seed。
5. 开启所有公开 schema 表的 RLS，并实现最小策略。
6. 为 Storage 写按 `owner_id/post_id` 限制的策略。
7. 运行数据库测试并修到全绿。
8. 提交 `feat: add secured handover schema`。

**Validation:** `supabase db reset` 成功；`supabase test db` 通过；使用 anon key 无法读取联系方式或非公开资料。

### Task 5：认证与最小资料

**Objective:** 让已验证用户进入发布和联系流程，不制造虚假的“学生认证”。

**Files:**

- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/auth/confirm/route.ts`
- Create: `src/lib/auth/require-user.ts`
- Create: `tests/e2e/auth.spec.ts`

**Steps:**

1. 写未登录访问发布页会跳转登录的失败 E2E 测试。
2. 接入 magic link/OTP 登录和 callback。
3. 只收集显示名称；将学校等设为可选。
4. 将 UI 文案固定为 `Email verified`。
5. 运行认证 E2E 并确认未验证用户不能发布/联系。
6. 提交 `feat: add verified email access`。

**Validation:** 登录、退出、过期链接和未验证访问均有明确结果；无密码重置入口。

### Task 6：发布、浏览与生命周期

**Objective:** 跑通 Valencia 供给帖的创建、发现与完成闭环。

**Files:**

- Create: `src/lib/posts/schema.ts`
- Create: `src/lib/posts/queries.ts`
- Create: `src/components/posts/post-form.tsx`
- Create: `src/components/posts/post-card.tsx`
- Create: `src/app/(public)/page.tsx`
- Create: `src/app/(public)/posts/[id]/page.tsx`
- Create: `src/app/(member)/posts/new/page.tsx`
- Create: `src/app/(member)/posts/[id]/edit/page.tsx`
- Create: `src/app/(member)/dashboard/page.tsx`
- Create: `tests/unit/post-schema.test.ts`
- Create: `tests/e2e/browse.spec.ts`
- Create: `tests/e2e/publish.spec.ts`

**Steps:**

1. 写字段边界、日期、价格和 housing 授权确认的失败单测。
2. 实现共享 schema，服务端再次校验所有输入。
3. 实现创建/编辑并补齐所有权测试。
4. 实现 Valencia 信息流和 `kind/price/date` 筛选。
5. 确保查询条件直接排除 `expires_at <= now()`。
6. 实现 reserved/completed/withdrawn 操作和成功原因。
7. 跑 unit + E2E 并修到全绿。
8. 提交 `feat: complete listing lifecycle`。

**Validation:** 发布者能完成全流程；匿名用户看不到草稿、隐藏、过期帖；免费物品由价格 0 正确筛出。

### Task 7：联系方式保护与核心测量

**Objective:** 在不公开泄露联系方式的情况下记录有效联系。

**Files:**

- Create: `src/app/api/posts/[id]/contact/route.ts`
- Create: `tests/e2e/contact.spec.ts`
- Modify: `src/app/(public)/posts/[id]/page.tsx`

**Steps:**

1. 写匿名用户不能获得联系方式的失败测试。
2. 写被暂停用户、过期帖和隐藏帖不能获得联系方式的失败测试。
3. 实现服务端权限检查、去重 contact event 和安全站外 URL。
4. 限制单用户短时间内的批量联系方式揭示并记录异常。
5. 验证 HTML、RSC payload 和公开 Supabase 查询均不含 `contact_value`。
6. 提交 `feat: gate contacts and track qualified interest`。

**Validation:** E2E 证明只有合格用户可联系；同一用户重复点击不虚增“唯一有效联系”。

### Task 8：举报、审核与法律页面

**Objective:** 提供可运营、可追踪的基础安全机制。

**Files:**

- Create: `src/lib/moderation/schema.ts`
- Create: `src/app/api/reports/route.ts`
- Create: `src/app/admin/reports/page.tsx`
- Create: `src/app/(public)/safety/page.tsx`
- Create: `src/app/(public)/privacy/page.tsx`
- Create: `src/app/(public)/terms/page.tsx`
- Create: `src/components/safety/housing-warning.tsx`
- Create: `tests/e2e/report.spec.ts`

**Steps:**

1. 写匿名违法内容通知和登录后社区举报的失败测试。
2. 实现结构化 notice、确认回执和管理状态。
3. 实现管理员隐藏/恢复与不可变审核记录。
4. 将安全提醒固定显示在 housing 详情页和联系动作前。
5. 写清联系方式用途、保存期限、用户删除/导出渠道和禁止内容。
6. 让法律人士复核最终页面，记录版本和日期。
7. 提交 `feat: add report and moderation workflow`。

**Validation:** 普通用户无法执行管理动作；举报处理有完整审计；举报人可获知结果，发布者有申诉入口。

### Task 9：过期任务、图片隐私和上线 QA

**Objective:** 清除陈旧信息并完成生产风险检查。

**Files:**

- Create: `supabase/migrations/202608030004_expiry_job.sql`
- Modify: `supabase/tests/database/lifecycle.test.sql`
- Modify: `src/components/posts/post-form.tsx`
- Create: `tests/e2e/accessibility.spec.ts`
- Create: `docs/operations/launch-checklist.md`

**Steps:**

1. 写过期状态更新幂等性的失败数据库测试。
2. 增加每日 Cron；任务失败也不能使过期帖重新出现在信息流。
3. 限制图片 MIME、大小和数量，重编码去除 EXIF。
4. 测试删除帖子时图片清理与失败重试。
5. 对移动端、键盘、表单错误、空状态和慢网进行 E2E/人工 QA。
6. 运行完整测试并完成 launch checklist。
7. 提交 `chore: harden pilot launch`。

**Validation:** `npm run lint && npm run typecheck && npm run test && npm run test:e2e` 全绿；`supabase test db` 全绿；无严重无障碍、隐私或权限问题。

### Task 10：四周试点复盘

**Objective:** 用预先定义的 Gate 2 指标决定继续、调整或停止。

**Files:**

- Modify: `docs/operations/pilot-scorecard.md`
- Create: `docs/product/pilot-retrospective.md`

**Steps:**

1. 按发布 cohort 计算 7 日联系率和 14 日确认交接率。
2. 单独拆分 housing 与 item，避免总数掩盖无效分类。
3. 审查举报、联系方式滥用、过期健康度和运营工时。
4. 访谈成功者、未获联系者和中途放弃者。
5. 依据阈值做 `continue / narrow / stop` 决策。
6. 仅当 Valencia 达标时规划第二城市；每次只新增一个城市并重新验证供给密度。

**Validation:** 复盘包含分母、时间窗、缺失数据、反例和明确决策，不用注册量代替交接结果。

## 十、主要风险与应对

| 风险 | 影响 | 计划内应对 |
|---|---|---|
| 空市场/信息密度不足 | 用户首次访问后不再回来 | 人工收集供给达到 Gate 0 才开发；不开放空城市 |
| 成熟平台竞争 | 住宿和物品均已有强替代品 | 只验证同届学生、时间交接、可信圈层，不比较库存规模 |
| 非法或未授权转租 | 用户和平台遭受财务/法律风险 | 限制为交接线索、发布确认、禁止旅游短租、固定安全提示与审核 |
| 联系方式抓取/骚扰 | 隐私伤害、信任崩溃 | 登录验证、服务端揭示、限频、日志、暂停用户 |
| 诈骗与违法内容 | 高危用户损害与合规风险 | notice-and-action、审核 SLA、审计、申诉和公开禁止清单 |
| RLS 配置错误 | 大规模数据泄露或越权修改 | 所有策略以 pgTAP 先行；匿名/用户/管理员矩阵测试 |
| 指标虚荣化 | 错误判断 PMF | 使用唯一联系、确认交接、时间窗和分类 cohort |
| 运营无人负责 | 举报积压、帖子失效 | 上线前指定负责人；运营 SLA 是 go/no-go 条件 |

## 十一、仍需由项目方确认的问题

这些问题不妨碍完成本次核查，但会阻断公开上线：

1. 服务提供者/运营主体设立在哪个国家，是否为经济活动；
2. MERCURI/CEU 是否愿意协助验证学生身份、分发邀请或承担任何运营责任；
3. 首批发布是否允许职业房东/中介；本计划默认不允许；
4. 举报与安全事件由谁处理，周末能否覆盖；
5. 产品界面首发语言；本计划默认英文，法律文本根据主体所在地提供所需语言；
6. 联系方式保存期限、账号删除期限和举报证据保留期限；
7. 是否有 20 条真实供给可以在试点前完成审核并上线。

## 十二、最终建议

不要把当前文档称为 “MVP 1.0 产品方案”，更准确的拆法是：

- `Validation 0.1`：人工 Concierge Board；
- `Product MVP 0.2`：Valencia 单城 Cohort Board；
- `Marketplace 1.0`：只在单城指标达标后再讨论多城、Looking for、提醒和更完整后台。

这样保留原方案最有价值的洞察——结构化、时效性和到达/离开交接——同时把真正需要验证的假设提前，把法律、隐私和审核问题放入上线门槛，而不是留到功能完成之后。
