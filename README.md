# 客服专用信息提交系统

基于 Next.js App Router + 纯 JavaScript 实现，界面采用 V0/shadcn 风格组件与 Tailwind CSS。

## 功能

- 前端无需登录，用户按模板提交信息
- 支持多模板，每个模板独立字段配置
- 支持多人同时提交，数据写入服务端数据库
- 管理员使用单个密钥登录后台
- 管理员后台采用左侧导航 + 右侧内容结构，包含仪表盘、模板配置、提交查询
- 仪表盘可查看模板总数、最近提交、今日提交、Webhook 模板数、模板提交分布和近期提交
- 管理员可在独立查询页面以表格形式查看提交详情，支持模板、状态、来源、日期、字段值和关键词高级筛选
- 管理员可通过可视化配置新建/修改模板、字段、启用状态、Webhook 地址和请求头
- 数据库支持 SQLite 和 MySQL
- 支持 API 写入提交、修改提交、创建/修改模板
- 提交后自动向模板配置的 Webhook URL 发送 POST JSON

## 快速开始

```bash
npm install
copy .env.example .env.local
npm run init-db
npm run dev
```

默认管理员密钥来自 `.env.local` 的 `ADMIN_SECRET`。未配置时为 `admin-change-me`，生产环境必须修改。

访问：

- 首页：`http://localhost:3000`
- 默认提交页：`http://localhost:3000/submit/customer-info`
- 管理后台仪表盘：`http://localhost:3000/admin`
- 模板配置页面：`http://localhost:3000/admin/templates`
- 提交结果查询：`http://localhost:3000/admin/submissions`

## 数据库

### SQLite

`.env.local`：

```env
DB_CLIENT=sqlite
SQLITE_PATH=data/customer-submit.sqlite
```

### MySQL

先创建数据库，例如 `customer_submit_system`，然后配置：

```env
DB_CLIENT=mysql
MYSQL_URL=mysql://user:password@127.0.0.1:3306/customer_submit_system
```

首次启动或执行 `npm run init-db` 会自动创建表。

## 模板字段配置

后台已提供可视化字段配置，无需手写 JSON。可以直接添加字段、删除字段、上下排序、选择字段类型、设置必填、占位提示、帮助说明和下拉选项。

API 创建/修改模板时仍使用字段 JSON，示例：

```json
[
  {
    "key": "name",
    "label": "客户姓名",
    "type": "text",
    "required": true,
    "placeholder": "请输入客户姓名"
  },
  {
    "key": "business",
    "label": "业务类型",
    "type": "select",
    "required": true,
    "options": ["售前咨询", "售后问题", "投诉建议"]
  },
  {
    "key": "message",
    "label": "详细说明",
    "type": "textarea",
    "required": false
  }
]
```

字段类型支持：

- `text`
- `tel`
- `email`
- `number`
- `textarea`
- `select`
- `date`
- `checkbox`

## API 鉴权

管理员 Cookie 或请求头 API Key 均可访问管理 API。

请求头：

```http
x-api-key: your-api-secret
```

也支持：

```http
Authorization: Bearer your-api-secret
```

API Key 会在数据库初始化时随机生成并保存在 `app_meta` 表中。登录后台后可在「接口文档」页面查看当前 `x-api-key`。

## API 示例

### 获取公开模板

```bash
curl http://localhost:3000/api/submit/customer-info
```

### 公开提交

```bash
curl -X POST http://localhost:3000/api/submit/customer-info ^
  -H "content-type: application/json" ^
  -d "{\"name\":\"张三\",\"phone\":\"13800000000\",\"business\":\"售前咨询\",\"message\":\"需要报价\"}"
```

### API 创建提交

```bash
curl -X POST http://localhost:3000/api/submissions ^
  -H "content-type: application/json" ^
  -H "x-api-key: your-api-secret" ^
  -d "{\"template_slug\":\"customer-info\",\"data\":{\"name\":\"李四\",\"phone\":\"13900000000\",\"business\":\"售后问题\"}}"
```

### 修改提交

覆盖提交数据：

```bash
curl -X PATCH http://localhost:3000/api/submissions/sub_xxx ^
  -H "content-type: application/json" ^
  -H "x-api-key: your-api-secret" ^
  -d "{\"status\":\"done\",\"data\":{\"name\":\"李四\",\"phone\":\"13900000000\",\"business\":\"售后问题\",\"message\":\"已处理\"}}"
```

合并写入额外字段：

```bash
curl -X PATCH http://localhost:3000/api/submissions/sub_xxx ^
  -H "content-type: application/json" ^
  -H "x-api-key: your-api-secret" ^
  -d "{\"merge\":true,\"patch\":{\"internal_note\":\"已回访\",\"owner\":\"客服A\"}}"
```

`merge:true` 或传入 `patch` 时会把字段合并进该提交记录的 `data`。这些新增字段只存在于提交记录中，不会写入模板字段配置，因此不会显示到公开提交表单，但会在后台查询表格和详情中显示。

### 创建模板

```bash
curl -X POST http://localhost:3000/api/templates ^
  -H "content-type: application/json" ^
  -H "x-api-key: your-api-secret" ^
  -d "{\"name\":\"投诉登记\",\"slug\":\"complaint\",\"fields\":[{\"key\":\"name\",\"label\":\"姓名\",\"type\":\"text\",\"required\":true}],\"webhook_urls\":[]}"
```

### 修改模板

```bash
curl -X PATCH http://localhost:3000/api/templates/tpl_xxx ^
  -H "content-type: application/json" ^
  -H "x-api-key: your-api-secret" ^
  -d "{\"active\":false}"
```

## Webhook

在模板配置里填写 Webhook URL，每行一个。提交成功后系统会 POST：

```json
{
  "event": "submission.created",
  "template": {
    "id": "tpl_xxx",
    "slug": "customer-info",
    "name": "客户资料登记"
  },
  "submission": {
    "id": "sub_xxx",
    "data": {},
    "status": "new",
    "source": "web",
    "created_at": "2026-05-07T00:00:00.000Z"
  }
}
```

Webhook Headers 可配置为 JSON，例如：

```json
{
  "x-webhook-token": "your-token"
}
```

## 生产建议

- 修改 `ADMIN_SECRET`，并妥善保存后台「接口文档」中展示的 API Key
- 使用 HTTPS
- MySQL 部署时配置连接池账号权限
- 将 SQLite 数据目录持久化挂载
- 根据业务增加限流、验证码、字段脱敏和审计日志
