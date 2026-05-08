import { redirect } from "next/navigation";
import AdminShell from "@/components/admin-shell";
import { AlertBox, Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, LinkButton } from "@/components/ui";
import { isAdminAuthenticated } from "@/lib/auth";
import { getApiKey, initDb } from "@/lib/db";

const fieldTypes = [
  { type: "text", name: "单行文本", use: "姓名、标题、普通短内容" },
  { type: "tel", name: "电话", use: "手机号、座机号" },
  { type: "email", name: "邮箱", use: "邮箱地址，会校验格式" },
  { type: "number", name: "数字", use: "数量、金额、评分" },
  { type: "textarea", name: "多行文本", use: "备注、详细说明" },
  { type: "select", name: "下拉选择", use: "固定选项，例如业务类型" },
  { type: "date", name: "日期", use: "预约日期、跟进日期" },
  { type: "checkbox", name: "复选框", use: "是否确认、是否同意" }
];

const scenarios = [
  {
    title: "场景一：外部系统提交一条客户信息",
    steps: [
      "先到「模板配置」里确认模板名称和访问标识。",
      "把接口地址中的 {slug} 替换成模板访问标识。",
      "请求体里填写字段 key 和对应内容。",
      "提交成功后会返回 submission.id，这就是提交编号。"
    ],
    code: `POST /api/submit/customer-info
Content-Type: application/json

{
  "name": "张三",
  "phone": "13800000000",
  "message": "想了解报价"
}`
  },
  {
    title: "场景二：后台系统查询最近提交记录",
    steps: [
      "这个接口属于管理接口，需要带 API 密钥。",
      "template 可以只查某个模板，不传则查全部。",
      "limit 表示最多返回多少条，建议不要太大。"
    ],
    code: `GET /api/submissions?template=customer-info&limit=100
x-api-key: 你的 API_SECRET`
  },
  {
    title: "场景三：给一条提交记录补充内部备注",
    steps: [
      "先通过查询接口拿到提交编号 submission.id。",
      "使用 PATCH 接口，merge 设置为 true。",
      "patch 里只写要补充或修改的字段，不会清空原来的数据。"
    ],
    code: `PATCH /api/submissions/sub_xxx
x-api-key: 你的 API_SECRET
Content-Type: application/json

{
  "merge": true,
  "patch": {
    "internal_note": "已电话回访",
    "owner": "客服A"
  }
}`
  }
];

const endpoints = [
  {
    group: "公开提交接口",
    method: "GET",
    path: "/api/submit/{slug}",
    auth: "不需要密钥",
    title: "获取某个公开模板",
    useFor: "给前端页面或外部系统读取模板结构，比如有哪些字段、哪些字段必填。",
    easyTip: "{slug} 是模板访问标识，可以在模板配置页看到公开提交地址。",
    params: [
      ["slug", "模板访问标识，例如 customer-info"]
    ],
    bodyText: "无请求体，直接访问地址即可。",
    example: `GET /api/submit/customer-info`,
    response: `{
  "template": {
    "id": "tpl_xxx",
    "slug": "customer-info",
    "name": "客户资料登记",
    "fields": [
      {
        "key": "name",
        "label": "客户姓名",
        "type": "text",
        "required": true
      }
    ]
  }
}`
  },
  {
    group: "公开提交接口",
    method: "POST",
    path: "/api/submit/{slug}",
    auth: "不需要密钥",
    title: "提交一条公开表单数据",
    useFor: "让用户、落地页、第三方页面直接提交客户信息。提交成功后会触发推送配置。",
    easyTip: "字段名要使用模板字段的 key；如果字段设置了默认值，不传也会自动使用默认值。",
    params: [
      ["slug", "模板访问标识，例如 customer-info"],
      ["字段 key", "例如 name、phone、message，对应模板里的字段标识"]
    ],
    bodyText: "请求体可以直接写字段，也可以用 data 包起来；推荐直接写字段，最简单。",
    example: `POST /api/submit/customer-info
Content-Type: application/json

{
  "name": "张三",
  "phone": "13800000000",
  "message": "需要报价"
}`,
    response: `{
  "submission": {
    "id": "sub_xxx",
    "template_slug": "customer-info",
    "status": "new",
    "data": {
      "name": "张三",
      "phone": "13800000000",
      "message": "需要报价"
    }
  }
}`
  },
  {
    group: "模板管理接口",
    method: "GET",
    path: "/api/templates",
    auth: "一般不需要；查停用模板需要密钥",
    title: "获取模板列表",
    useFor: "查看系统里有哪些模板。默认只返回启用中的模板。",
    easyTip: "如果要连停用模板一起看，加 includeInactive=1，并带上 API 密钥。",
    params: [
      ["includeInactive", "可选。传 1 表示包含停用模板"]
    ],
    bodyText: "无请求体。",
    example: `GET /api/templates

GET /api/templates?includeInactive=1
x-api-key: 你的 API_SECRET`,
    response: `{
  "templates": [
    {
      "id": "tpl_xxx",
      "name": "客户资料登记",
      "slug": "customer-info",
      "active": true
    }
  ]
}`
  },
  {
    group: "模板管理接口",
    method: "POST",
    path: "/api/templates",
    auth: "需要密钥",
    title: "创建一个新模板",
    useFor: "让外部系统通过接口自动创建表单模板。",
    easyTip: "不熟悉接口时，建议优先在后台「模板配置」页面创建，更直观。",
    params: [
      ["name", "模板名称，必填"],
      ["fields", "字段列表，至少 1 个"],
      ["webhook_urls", "可选，提交成功后要推送的地址"],
      ["active", "可选，true 表示启用"]
    ],
    bodyText: "请求体需要包含模板名称和字段列表。",
    example: `POST /api/templates
x-api-key: 你的 API_SECRET
Content-Type: application/json

{
  "name": "投诉登记",
  "description": "收集客户投诉信息",
  "fields": [
    {
      "key": "name",
      "label": "客户姓名",
      "type": "text",
      "required": true
    },
    {
      "key": "phone",
      "label": "联系电话",
      "type": "tel",
      "required": true
    }
  ],
  "active": true
}`,
    response: `{
  "template": {
    "id": "tpl_xxx",
    "name": "投诉登记",
    "slug": "tpl-xxxx",
    "active": true
  }
}`
  },
  {
    group: "模板管理接口",
    method: "GET",
    path: "/api/templates/{id}",
    auth: "需要密钥",
    title: "查看某个模板详情",
    useFor: "根据模板 ID 查看完整配置。",
    easyTip: "{id} 是模板 ID，不是 slug。模板 ID 一般长得像 tpl_xxx。",
    params: [
      ["id", "模板 ID，例如 tpl_xxx"]
    ],
    bodyText: "无请求体。",
    example: `GET /api/templates/tpl_xxx
x-api-key: 你的 API_SECRET`,
    response: `{
  "template": {
    "id": "tpl_xxx",
    "name": "客户资料登记",
    "fields": []
  }
}`
  },
  {
    group: "模板管理接口",
    method: "PATCH / PUT",
    path: "/api/templates/{id}",
    auth: "需要密钥",
    title: "修改模板或启用/停用模板",
    useFor: "修改模板名称、字段、推送地址，或者只切换启用状态。",
    easyTip: "只想停用模板时，只传 active: false 就可以。",
    params: [
      ["id", "模板 ID"],
      ["active", "true 启用，false 停用"],
      ["fields", "字段列表。传了会覆盖原字段配置"]
    ],
    bodyText: "可以只传要修改的字段。",
    example: `PATCH /api/templates/tpl_xxx
x-api-key: 你的 API_SECRET
Content-Type: application/json

{
  "active": false
}`,
    response: `{
  "template": {
    "id": "tpl_xxx",
    "name": "客户资料登记",
    "active": false
  }
}`
  },
  {
    group: "模板管理接口",
    method: "DELETE",
    path: "/api/templates/{id}",
    auth: "需要密钥",
    title: "删除模板",
    useFor: "删除不再使用的模板配置。",
    easyTip: "删除模板后，历史提交记录仍保留，但公开提交页不能再使用这个模板。",
    params: [
      ["id", "模板 ID"]
    ],
    bodyText: "无请求体。",
    example: `DELETE /api/templates/tpl_xxx
x-api-key: 你的 API_SECRET`,
    response: `{
  "ok": true,
  "template": {
    "id": "tpl_xxx",
    "name": "客户资料登记"
  }
}`
  },
  {
    group: "提交记录接口",
    method: "GET",
    path: "/api/submissions",
    auth: "需要密钥",
    title: "查询提交记录",
    useFor: "后台系统、客服系统、报表系统拉取提交数据。",
    easyTip: "如果只查某个模板，加 template；如果只看最近几十条，加 limit。",
    params: [
      ["template", "可选，模板访问标识 slug"],
      ["limit", "可选，最多返回多少条，默认 100"]
    ],
    bodyText: "无请求体。",
    example: `GET /api/submissions?template=customer-info&limit=100
x-api-key: 你的 API_SECRET`,
    response: `{
  "submissions": [
    {
      "id": "sub_xxx",
      "template_slug": "customer-info",
      "status": "new",
      "data": {
        "name": "张三",
        "phone": "13800000000"
      }
    }
  ]
}`
  },
  {
    group: "提交记录接口",
    method: "POST",
    path: "/api/submissions",
    auth: "需要密钥",
    title: "后台接口创建提交记录",
    useFor: "第三方系统或客服系统把客户资料写入本系统。",
    easyTip: "和公开提交不同，这个接口需要写 template_slug，并且要带 API 密钥。",
    params: [
      ["template_slug", "模板访问标识，必填"],
      ["source", "来源，可选，例如 api、crm、admin"],
      ["data", "提交内容，字段名用模板字段 key"]
    ],
    bodyText: "请求体需要包含 template_slug 和 data。",
    example: `POST /api/submissions
x-api-key: 你的 API_SECRET
Content-Type: application/json

{
  "template_slug": "customer-info",
  "source": "api",
  "data": {
    "name": "李四",
    "phone": "13900000000",
    "message": "售后问题"
  }
}`,
    response: `{
  "submission": {
    "id": "sub_xxx",
    "template_slug": "customer-info",
    "status": "new"
  },
  "webhooks": []
}`
  },
  {
    group: "提交记录接口",
    method: "GET",
    path: "/api/submissions/{id}",
    auth: "需要密钥",
    title: "查看一条提交详情",
    useFor: "查看某条提交的完整内容和推送日志。",
    easyTip: "{id} 是提交编号，一般长得像 sub_xxx。",
    params: [
      ["id", "提交编号"]
    ],
    bodyText: "无请求体。",
    example: `GET /api/submissions/sub_xxx
x-api-key: 你的 API_SECRET`,
    response: `{
  "submission": {
    "id": "sub_xxx",
    "data": {}
  },
  "webhookLogs": []
}`
  },
  {
    group: "提交记录接口",
    method: "PATCH / PUT",
    path: "/api/submissions/{id}",
    auth: "需要密钥",
    title: "修改提交记录或补充备注",
    useFor: "修改客户信息、更新状态、补充内部备注。",
    easyTip: "推荐用 merge + patch，这样只改指定字段，不会把原数据清空。",
    params: [
      ["id", "提交编号"],
      ["merge", "true 表示合并写入"],
      ["patch", "要补充或修改的字段"],
      ["status", "可选，提交状态，例如 new、done"]
    ],
    bodyText: "推荐传 merge: true 和 patch。",
    example: `PATCH /api/submissions/sub_xxx
x-api-key: 你的 API_SECRET
Content-Type: application/json

{
  "merge": true,
  "patch": {
    "internal_note": "已回访",
    "owner": "客服A"
  },
  "status": "done"
}`,
    response: `{
  "submission": {
    "id": "sub_xxx",
    "status": "done",
    "data": {
      "internal_note": "已回访",
      "owner": "客服A"
    }
  }
}`
  },
  {
    group: "提交记录接口",
    method: "DELETE",
    path: "/api/submissions/{id}",
    auth: "需要密钥",
    title: "删除一条提交记录",
    useFor: "删除错误提交或测试数据。",
    easyTip: "删除后不可恢复，请谨慎操作。",
    params: [
      ["id", "提交编号"]
    ],
    bodyText: "无请求体。",
    example: `DELETE /api/submissions/sub_xxx
x-api-key: 你的 API_SECRET`,
    response: `{
  "ok": true,
  "submission": {
    "id": "sub_xxx"
  }
}`
  },
  {
    group: "管理员登录接口",
    method: "POST",
    path: "/api/admin/login",
    auth: "不需要密钥",
    title: "管理员登录",
    useFor: "后台登录页面使用，一般不需要第三方系统调用。",
    easyTip: "secret 就是 .env 里的 ADMIN_SECRET。",
    params: [
      ["secret", "管理员密码，对应 ADMIN_SECRET"]
    ],
    bodyText: "传入管理员密码。",
    example: `POST /api/admin/login
Content-Type: application/json

{
  "secret": "你的 ADMIN_SECRET"
}`,
    response: `{
  "ok": true
}`
  },
  {
    group: "管理员登录接口",
    method: "POST",
    path: "/api/admin/logout",
    auth: "需要管理员登录状态",
    title: "管理员退出",
    useFor: "后台退出登录。",
    easyTip: "后台页面点击退出时会自动调用。",
    params: [],
    bodyText: "无请求体。",
    example: `POST /api/admin/logout`,
    response: `{
  "ok": true
}`
  }
];

function MethodBadge({ method }) {
  const color = method.includes("GET")
    ? "bg-emerald-100 text-emerald-700"
    : method.includes("POST")
      ? "bg-blue-100 text-blue-700"
      : method.includes("DELETE")
        ? "bg-red-100 text-red-700"
        : "bg-amber-100 text-amber-700";

  return <span className={`rounded px-2 py-1 text-xs font-semibold ${color}`}>{method}</span>;
}

function CodeBlock({ children }) {
  if (!children) return null;

  return (
    <pre className="mt-2 overflow-auto rounded-md bg-slate-950 p-3 text-xs leading-relaxed text-slate-50">
      {children}
    </pre>
  );
}

function ParamTable({ rows }) {
  if (!rows || rows.length === 0) {
    return <p className="text-sm text-muted-foreground">无参数。</p>;
  }

  return (
    <div className="mt-2 overflow-hidden rounded-md border">
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([name, desc]) => (
            <tr key={name} className="border-b last:border-b-0">
              <td className="w-36 bg-muted px-3 py-2 font-medium">{name}</td>
              <td className="px-3 py-2 text-muted-foreground">{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StepList({ items }) {
  return (
    <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ol>
  );
}

function fillApiKey(text, apiKey) {
  return text?.replaceAll("你的 API_SECRET", apiKey);
}

export default async function AdminApiDocsPage() {
  const authenticated = await isAdminAuthenticated();

  if (!authenticated) {
    redirect("/admin/login");
  }

  await initDb();
  const apiKey = await getApiKey();

  const groupedEndpoints = endpoints.reduce((groups, endpoint) => {
    if (!groups[endpoint.group]) groups[endpoint.group] = [];
    groups[endpoint.group].push(endpoint);
    return groups;
  }, {});

  return (
    <AdminShell
      title="接口文档"
      description="小白也能看懂的 API 使用说明：什么时候用、怎么传、返回什么。"
      active="api-docs"
      actions={
        <>
          <LinkButton href="/admin" variant="outline" size="sm">仪表盘</LinkButton>
          <LinkButton href="/admin/submissions" variant="outline" size="sm">提交查询</LinkButton>
        </>
      }
    >
      <div className="space-y-6">
        <AlertBox type="info" title="先看这一段：接口是什么？">
          接口就是给外部系统调用的地址。比如你的官网、CRM、客服系统想把客户信息提交到这里，就按下面示例发送数据。
          如果只是人工操作，优先使用后台页面；如果要系统对系统自动对接，再使用接口。
        </AlertBox>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>最快上手：只要 4 步</CardTitle>
            <CardDescription>第一次对接接口时，照着这个顺序来最不容易出错。</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              {[
                ["1", "创建模板", "在「模板配置」里创建表单，并记下公开提交地址里的 slug。"],
                ["2", "确认字段 key", "每个字段都有 key，例如 name、phone。提交数据时必须用 key。"],
                ["3", "选择接口", "公开提交用 /api/submit/{slug}；后台系统写入用 /api/submissions。"],
                ["4", "发送 JSON", "按示例发送 JSON，成功后会返回提交编号。"]
              ].map(([number, title, desc]) => (
                <div key={number} className="rounded-lg border bg-background p-4">
                  <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {number}
                  </div>
                  <div className="font-semibold">{title}</div>
                  <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>几个常见词解释</CardTitle>
            <CardDescription>接口文档里会反复出现这些词，先理解它们就很好读。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-md border p-4">
              <h3 className="font-semibold">slug：模板访问标识</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                公开提交地址里最后一段就是 slug。例如地址是 <code>/submit/customer-info</code>，那么 slug 就是 <code>customer-info</code>。
              </p>
            </div>
            <div className="rounded-md border p-4">
              <h3 className="font-semibold">key：字段标识</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                字段名称给人看，字段 key 给接口用。例如字段名称是「客户姓名」，key 是 <code>name</code>，接口提交时要写 <code>"name": "张三"</code>。
              </p>
            </div>
            <div className="rounded-md border p-4">
              <h3 className="font-semibold">submission：提交记录</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                用户或系统提交一次表单，就会生成一条 submission。返回里的 <code>id</code> 就是这条记录的编号。
              </p>
            </div>
            <div className="rounded-md border p-4">
              <h3 className="font-semibold">Webhook：自动推送</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                提交成功后，系统会把这条数据自动 POST 到你配置的外部地址，适合通知 CRM、企业微信机器人等。
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>密钥怎么填？</CardTitle>
            <CardDescription>公开提交接口不需要密钥；后台管理类接口必须带密钥。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-md border p-4">
              <h3 className="font-semibold">推荐写法：请求头 x-api-key</h3>
              <p className="mt-2 text-sm text-muted-foreground">第三方系统调用后台接口时，在请求头加这一行：</p>
              <CodeBlock>{`x-api-key: ${apiKey}`}</CodeBlock>
            </div>
            <div className="rounded-md border p-4">
              <h3 className="font-semibold">当前系统 API 密钥</h3>
              <p className="mt-2 text-sm text-muted-foreground">系统初始化数据库时会随机生成 API 密钥，并保存在数据库 app_meta 中：</p>
              <CodeBlock>{apiKey}</CodeBlock>
              <p className="mt-2 text-sm text-muted-foreground">请妥善保存并只提供给可信系统。删除数据库或清空 app_meta 后会重新生成。</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>字段类型对照表</CardTitle>
            <CardDescription>创建模板或理解 fields 时会用到。</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {fieldTypes.map((field) => (
                <div key={field.type} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{field.name}</span>
                    <Badge variant="secondary">{field.type}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{field.use}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>常见对接场景</CardTitle>
            <CardDescription>不知道该用哪个接口时，先从这里找对应场景。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {scenarios.map((scenario) => (
              <div key={scenario.title} className="rounded-lg border p-4">
                <h3 className="font-semibold">{scenario.title}</h3>
                <div className="mt-3 grid gap-4 lg:grid-cols-2">
                  <StepList items={scenario.steps} />
                  <CodeBlock>{fillApiKey(scenario.code, apiKey)}</CodeBlock>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {Object.entries(groupedEndpoints).map(([group, items]) => (
          <div key={group} className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">{group}</h2>
              <p className="mt-1 text-sm text-muted-foreground">下面是这个分类下可调用的接口。</p>
            </div>

            {items.map((endpoint) => (
              <Card key={`${endpoint.method}-${endpoint.path}`} className="glass-card">
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <MethodBadge method={endpoint.method} />
                    <code className="rounded bg-muted px-2 py-1 text-sm">{endpoint.path}</code>
                    <Badge variant={endpoint.auth.includes("不需要") ? "outline" : "secondary"}>权限：{endpoint.auth}</Badge>
                  </div>
                  <CardTitle className="pt-2 text-lg">{endpoint.title}</CardTitle>
                  <CardDescription>{endpoint.useFor}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <AlertBox type="info" title="小提示" className="py-3">
                    {endpoint.easyTip}
                  </AlertBox>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div>
                      <h4 className="font-medium">需要填写什么？</h4>
                      <ParamTable rows={endpoint.params} />

                      <h4 className="mt-4 font-medium">请求体说明</h4>
                      <p className="mt-2 text-sm text-muted-foreground">{endpoint.bodyText}</p>

                      <h4 className="mt-4 font-medium">请求示例</h4>
                      <CodeBlock>{fillApiKey(endpoint.example, apiKey)}</CodeBlock>
                    </div>
                    <div>
                      <h4 className="font-medium">成功返回示例</h4>
                      <CodeBlock>{endpoint.response}</CodeBlock>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ))}

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>推送数据格式</CardTitle>
            <CardDescription>模板配置了推送地址后，每次提交成功都会向该地址发送下面这种 JSON。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <AlertBox type="warning" title="注意">
              你的接收地址需要支持 POST 请求，并能接收 JSON。系统会等待最多 8 秒；只要接收端返回 HTTP 2xx 状态码，就会判定为推送成功。
            </AlertBox>

            <div>
              <h3 className="font-semibold">系统会发送给你的内容</h3>
              <p className="mt-1 text-sm text-muted-foreground">也就是你的 Webhook 接收服务会收到的请求体：</p>
              <CodeBlock>{`{
  "event": "submission.created",
  "template": {
    "id": "tpl_xxx",
    "slug": "customer-info",
    "name": "客户资料登记"
  },
  "submission": {
    "id": "sub_xxx",
    "data": {
      "name": "张三",
      "phone": "13800000000"
    },
    "status": "new",
    "source": "web",
    "created_at": "2026-05-07T00:00:00.000Z"
  }
}`}</CodeBlock>
            </div>

            <div className="rounded-lg border p-4">
              <h3 className="font-semibold">你的 Webhook 服务需要返回什么？</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                最重要的是 HTTP 状态码返回 200 到 299 之间。响应体格式不强制，但推荐返回 JSON，方便后台日志查看。
              </p>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div>
                  <h4 className="font-medium">推荐成功响应</h4>
                  <CodeBlock>{`HTTP/1.1 200 OK
Content-Type: application/json

{
  "ok": true,
  "message": "received"
}`}</CodeBlock>
                  <p className="mt-2 text-sm text-muted-foreground">
                    返回 200、201、204 等 2xx 状态码都会被判定为成功。
                  </p>
                </div>
                <div>
                  <h4 className="font-medium">失败响应示例</h4>
                  <CodeBlock>{`HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "ok": false,
  "message": "missing phone"
}`}</CodeBlock>
                  <p className="mt-2 text-sm text-muted-foreground">
                    返回 4xx、5xx，或者超过 8 秒没有响应，都会被记录为推送失败。
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <h3 className="font-semibold">最简单的接收端示例</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                如果你用 Node.js / Express 接收 Webhook，可以类似这样返回：
              </p>
              <CodeBlock>{`app.post("/webhook/customer-submit", express.json(), (req, res) => {
  console.log("收到提交数据：", req.body);

  // 先快速返回成功，耗时任务建议放到后台异步处理
  res.status(200).json({
    ok: true,
    message: "received"
  });
});`}</CodeBlock>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>常见错误说明</CardTitle>
            <CardDescription>接口调用失败时，可以先对照这里排查。</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {[
                ["401 Unauthorized", "没有带 API 密钥，或者密钥不正确。检查请求头 x-api-key。"],
                ["404 Template not found", "模板没找到。检查 slug 或模板 ID 是否写错。"],
                ["404 Submission not found", "提交记录没找到。检查 submission.id 是否写错。"],
                ["400 Validation failed", "提交内容不符合模板要求，例如必填字段没填、邮箱格式不对、下拉选项不在范围内。"]
              ].map(([title, desc]) => (
                <div key={title} className="rounded-md border p-4">
                  <div className="font-semibold">{title}</div>
                  <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
