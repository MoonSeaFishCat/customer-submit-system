import { Card, CardContent, CardDescription, CardHeader, CardTitle, LinkButton } from "@/components/ui";
import { getTemplates, initDb } from "@/lib/db";

export default async function HomePage() {
  await initDb();
  const templates = await getTemplates();

  return (
    <main className="min-h-screen subtle-grid bg-background">
      <section className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-10 flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-muted-foreground">索汇尔客服部</div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              索汇尔客服部专用信息提交系统
            </h1>
          </div>
          <LinkButton href="/admin" variant="outline" size="sm">
            管理后台
          </LinkButton>
        </div>

        <div>
          <h2 className="mb-4 text-2xl font-semibold">可用提交模板</h2>

          {templates.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {templates.map((template) => (
                <Card key={template.id} className="glass-card transition-colors hover:border-primary/50">
                  <CardHeader>
                    <CardTitle>{template.name}</CardTitle>
                    <CardDescription>{template.description || "点击进入填写页面"}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between gap-4">
                    <span className="text-sm text-muted-foreground">{template.fields.length} 个字段</span>
                    <LinkButton href={`/submit/${template.slug}`} size="sm">
                      填写
                    </LinkButton>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="glass-card">
              <CardContent className="p-10 text-center text-muted-foreground">
                暂无可用提交模板
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </main>
  );
}
