import { ClipboardList, Database, KeyRound, Webhook } from "lucide-react";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, LinkButton } from "@/components/ui";
import { getTemplates, initDb } from "@/lib/db";

export default async function HomePage() {
  await initDb();
  const templates = await getTemplates();

  return (
    <main className="min-h-screen subtle-grid">
      <section className="page-shell">
        <div className="mb-10 max-w-3xl">
          <Badge variant="secondary">Customer Submit System</Badge>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            客服专用多模板信息提交系统
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            前端免登录，按模板提交；管理员使用密钥登录，可管理模板、查看详情、通过 API 写入/修改，并支持 Webhook 推送。
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <LinkButton href="/admin">进入管理员后台</LinkButton>
            {templates[0] ? (
              <LinkButton href={`/submit/${templates[0].slug}`} variant="outline">
                打开默认提交页
              </LinkButton>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {[
            ["多模板", "不同客服场景使用不同字段", ClipboardList],
            ["并发提交", "服务端 API 写入数据库", Database],
            ["密钥管理", "管理员无需账号体系", KeyRound],
            ["Webhook", "提交后推送外部系统", Webhook]
          ].map(([title, desc, Icon]) => (
            <Card key={title} className="glass-card">
              <CardHeader>
                <Icon className="h-6 w-6 text-primary" />
                <CardTitle className="text-lg">{title}</CardTitle>
                <CardDescription>{desc}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>

        <div className="mt-10">
          <h2 className="mb-4 text-2xl font-semibold">可用提交模板</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {templates.map((template) => (
              <Card key={template.id}>
                <CardHeader>
                  <CardTitle>{template.name}</CardTitle>
                  <CardDescription>{template.description || "暂无描述"}</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{template.fields.length} 个字段</span>
                  <LinkButton href={`/submit/${template.slug}`} size="sm">
                    填写
                  </LinkButton>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
