import { redirect } from "next/navigation";
import { Activity, ClipboardList, FileText, Send, Settings } from "lucide-react";
import AdminShell from "@/components/admin-shell";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, LinkButton } from "@/components/ui";
import { isAdminAuthenticated } from "@/lib/auth";
import { getSubmissions, getTemplates, initDb } from "@/lib/db";

function getTodayCount(submissions) {
  const today = new Date().toISOString().slice(0, 10);
  return submissions.filter((submission) => String(submission.created_at || "").startsWith(today)).length;
}

function getTemplateStats(templates, submissions) {
  return templates.map((template) => ({
    ...template,
    count: submissions.filter((submission) => submission.template_slug === template.slug).length
  }));
}

export default async function AdminPage() {
  const authenticated = await isAdminAuthenticated();

  if (!authenticated) {
    redirect("/admin/login");
  }

  await initDb();
  const templates = await getTemplates({ includeInactive: true });
  const submissions = await getSubmissions({ limit: 500 });
  const templateStats = getTemplateStats(templates, submissions);
  const recentSubmissions = submissions.slice(0, 8);

  return (
    <AdminShell
      title="仪表盘"
      description="总览模板、提交量、近期提交和快捷入口。"
      active="dashboard"
      actions={<LinkButton href="/admin/templates" size="sm">配置模板</LinkButton>}
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardDescription>模板总数</CardDescription>
              <ClipboardList className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{templates.length}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                {templates.filter((template) => template.active).length} 个启用中
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardDescription>最近提交</CardDescription>
              <FileText className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{submissions.length}</div>
              <p className="mt-1 text-xs text-muted-foreground">最近 500 条记录</p>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardDescription>今日提交</CardDescription>
              <Activity className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{getTodayCount(submissions)}</div>
              <p className="mt-1 text-xs text-muted-foreground">按服务器日期统计</p>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardDescription>Webhook 模板</CardDescription>
              <Send className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {templates.filter((template) => (template.webhook_urls || []).length > 0).length}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">已配置推送地址</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>模板提交分布</CardTitle>
              <CardDescription>按模板统计最近提交记录数量。</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {templateStats.map((template) => {
                  const max = Math.max(...templateStats.map((item) => item.count), 1);
                  const percent = Math.round((template.count / max) * 100);

                  return (
                    <div key={template.id} className="space-y-2">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <div>
                          <span className="font-medium">{template.name}</span>
                          <span className="ml-2 text-muted-foreground">/{template.slug}</span>
                        </div>
                        <Badge variant={template.active ? "secondary" : "outline"}>
                          {template.count} 条
                        </Badge>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  );
                })}

                {templateStats.length === 0 ? (
                  <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                    暂无模板
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle>快捷操作</CardTitle>
              <CardDescription>常用后台入口。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <LinkButton href="/admin/templates" className="w-full justify-start" variant="outline">
                <Settings className="h-4 w-4" />
                可视化模板配置
              </LinkButton>
              <LinkButton href="/admin/submissions" className="w-full justify-start" variant="outline">
                <FileText className="h-4 w-4" />
                查询提交结果
              </LinkButton>
              {templates[0] ? (
                <LinkButton href={`/submit/${templates[0].slug}`} className="w-full justify-start" variant="outline">
                  <ClipboardList className="h-4 w-4" />
                  打开默认提交页
                </LinkButton>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>近期提交</CardTitle>
            <CardDescription>展示最近 8 条提交记录。</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentSubmissions.map((submission) => (
                <a
                  key={submission.id}
                  href="/admin/submissions"
                  className="block rounded-md border p-4 transition-colors hover:bg-accent"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">{submission.id}</div>
                    <Badge variant="secondary">{submission.status}</Badge>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    /{submission.template_slug} · {new Date(submission.created_at).toLocaleString()}
                  </div>
                  <div className="mt-2 line-clamp-1 text-sm">
                    {Object.entries(submission.data || {}).map(([key, value]) => `${key}: ${value}`).join("，")}
                  </div>
                </a>
              ))}

              {recentSubmissions.length === 0 ? (
                <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                  暂无提交记录
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
