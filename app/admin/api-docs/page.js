import { redirect } from "next/navigation";
import AdminShell from "@/components/admin-shell";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, LinkButton } from "@/components/ui";
import { isAdminAuthenticated } from "@/lib/auth";

const endpoints = [
  {
    method: "GET",
    path: "/api/submit/{slug}",
    auth: "无",
    title: "获取公开模板",
    description: "前端公开提交页使用。返回指定 slug 的启用模板。",
    response: `{
  "template": {
    "id": "tpl_xxx",
    "slug": "customer-info",
    "name": "客户资料登记",
    "fields": []
  }
}`
  },
  {
    method: "POST",
    path: "/api/submit/{slug}",
    auth: "无",
    title: "公开提交信息",
    description: "用户无需登录，按模板字段提交信息。会触发 Webhook。",
    body: `{
  "name": "张三",
  "phone": "13800000000",
  "business": "售前咨询",
  "message": "需要报价"
}`,
    response: `{
  "submission": {
    "id": "sub_xxx",
    "template_slug": "customer-info",
    "data": {}
  }
}`
  },
  {
    method: "GET",
    path: "/api/templates",
    auth: "可选",
    title: "获取模板列表",
    description: "默认只返回启用模板。includeInactive=1 时需要管理员 Cookie 或 API Key。",
    query: "includeInactive=1",
    response: `{
  "templates": []
}`
  },
  {
    method: "POST",
    path: "/api/templates",
    auth: "需要",
    title: "创建模板",
    description: "创建新模板，支持字段配置和 Webhook 配置。",
    body: `{
  "name": "投诉登记",
  "slug": "complaint",
  "description": "投诉信息收集",
  "fields": [
    {
      "key": "name",
      "label": "姓名",
      "type": "text",
      "required": true
    }
  ],
  "webhook_urls": ["https://example.com/webhook"],
  "webhook_headers": {
    "x-token": "secret"
  },
  "active": true
}`
  },
  {
    method: "GET",
    path: "/api/templates/{id}",
    auth: "需要",
    title: "获取模板详情",
    description: "通过模板 ID 获取完整模板配置。"
  },
  {
    method: "PATCH / PUT",
    path: "/api/templates/{id}",
    auth: "需要",
    title: "修改模板 / 启用禁用模板",
    description: "局部或完整修改模板配置。启用/禁用模板时只需要传 active 字段。",
    body: `{
  "name": "新模板名称",
  "active": false,
  "fields": []
}`
  },
  {
    method: "DELETE",
    path: "/api/templates/{id}",
    auth: "需要",
    title: "删除模板",
    description: "删除模板配置。历史提交记录会保留，但公开提交页无法再使用该模板。",
    response: `{
  "ok": true,
  "template": {
    "id": "tpl_xxx",
    "name": "客户资料登记"
  }
}`
  },
  {
    method: "GET",
    path: "/api/submissions",
    auth: "需要",
    title: "查询提交记录",
    description: "查询提交记录，支持按模板和数量限制。",
    query: "template=customer-info&limit=100",
    response: `{
  "submissions": []
}`
  },
  {
    method: "POST",
    path: "/api/submissions",
    auth: "需要",
    title: "通过 API 创建提交",
    description: "服务端或第三方系统写入提交记录。会触发 Webhook。",
    body: `{
  "template_slug": "customer-info",
  "source": "api",
  "data": {
    "name": "李四",
    "phone": "13900000000",
    "business": "售后问题"
  }
}`
  },
  {
    method: "GET",
    path: "/api/submissions/{id}",
    auth: "需要",
    title: "获取提交详情",
    description: "返回提交详情和 Webhook 日志。",
    response: `{
  "submission": {},
  "webhookLogs": []
}`
  },
  {
    method: "PATCH / PUT",
    path: "/api/submissions/{id}",
    auth: "需要",
    title: "修改提交或合并写入额外字段",
    description: "可覆盖 data，也可 merge/patch 合并写入新增字段。新增字段不会显示到公开模板表单。",
    body: `{
  "merge": true,
  "patch": {
    "internal_note": "已回访",
    "owner": "客服A"
  }
}`
  },
  {
    method: "POST",
    path: "/api/admin/login",
    auth: "无",
    title: "管理员登录",
    description: "使用 ADMIN_SECRET 创建管理员 Cookie 会话。",
    body: `{
  "secret": "your-admin-secret"
}`
  },
  {
    method: "POST",
    path: "/api/admin/logout",
    auth: "Cookie",
    title: "管理员退出",
    description: "清理管理员 Cookie 会话。"
  }
];

function MethodBadge({ method }) {
  const color = method.includes("GET")
    ? "bg-emerald-100 text-emerald-700"
    : method.includes("POST")
      ? "bg-blue-100 text-blue-700"
      : "bg-amber-100 text-amber-700";

  return <span className={`rounded px-2 py-1 text-xs font-semibold ${color}`}>{method}</span>;
}

function CodeBlock({ children }) {
  if (!children) return null;

  return (
    <pre className="mt-2 overflow-auto rounded-md bg-muted p-3 text-xs leading-relaxed">
      {children}
    </pre>
  );
}

export default async function AdminApiDocsPage() {
  const authenticated = await isAdminAuthenticated();

  if (!authenticated) {
    redirect("/admin/login");
  }

  return (
    <AdminShell
      title="接口文档"
      description="管理员后台 API 说明，包含鉴权、模板、提交、Webhook 相关接口。"
      active="api-docs"
      actions={
        <>
          <LinkButton href="/admin" variant="outline" size="sm">仪表盘</LinkButton>
          <LinkButton href="/admin/submissions" variant="outline" size="sm">提交查询</LinkButton>
        </>
      }
    >
      <div className="space-y-6">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>鉴权方式</CardTitle>
            <CardDescription>公开提交接口无需鉴权；管理接口支持管理员 Cookie 或 API Key。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-md border p-4">
              <h3 className="font-semibold">Header API Key</h3>
              <CodeBlock>{`x-api-key: your-api-secret`}</CodeBlock>
              <CodeBlock>{`Authorization: Bearer your-api-secret`}</CodeBlock>
            </div>
            <div className="rounded-md border p-4">
              <h3 className="font-semibold">环境变量</h3>
              <CodeBlock>{`ADMIN_SECRET=change-this-admin-secret
API_SECRET=change-this-api-secret`}</CodeBlock>
              <p className="mt-2 text-sm text-muted-foreground">API_SECRET 未配置时默认复用 ADMIN_SECRET。</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>字段类型</CardTitle>
            <CardDescription>模板 fields 支持的字段类型。</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {["text", "tel", "email", "number", "textarea", "select", "date", "checkbox"].map((type) => (
                <Badge key={type} variant="secondary">{type}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {endpoints.map((endpoint) => (
            <Card key={`${endpoint.method}-${endpoint.path}`} className="glass-card">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <MethodBadge method={endpoint.method} />
                  <code className="rounded bg-muted px-2 py-1 text-sm">{endpoint.path}</code>
                  <Badge variant={endpoint.auth === "无" ? "outline" : "secondary"}>鉴权：{endpoint.auth}</Badge>
                </div>
                <CardTitle className="pt-2 text-lg">{endpoint.title}</CardTitle>
                <CardDescription>{endpoint.description}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-2">
                <div>
                  {endpoint.query ? (
                    <>
                      <h4 className="font-medium">Query</h4>
                      <CodeBlock>{endpoint.query}</CodeBlock>
                    </>
                  ) : null}

                  {endpoint.body ? (
                    <>
                      <h4 className="font-medium">Request Body</h4>
                      <CodeBlock>{endpoint.body}</CodeBlock>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">无请求体</p>
                  )}
                </div>
                <div>
                  <h4 className="font-medium">Response 示例</h4>
                  <CodeBlock>{endpoint.response || `{
  "ok": true
}`}</CodeBlock>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Webhook Payload</CardTitle>
            <CardDescription>提交成功后会向模板配置的 Webhook URL 发送 POST JSON。</CardDescription>
          </CardHeader>
          <CardContent>
            <CodeBlock>{`{
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
}`}</CodeBlock>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
