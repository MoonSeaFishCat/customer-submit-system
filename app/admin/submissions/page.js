import { redirect } from "next/navigation";
import AdminShell from "@/components/admin-shell";
import AdminSubmissionList from "@/components/admin-submission-list";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, LinkButton } from "@/components/ui";
import { isAdminAuthenticated } from "@/lib/auth";
import { getSubmissions, getTemplates, initDb } from "@/lib/db";

export default async function AdminSubmissionsPage({ searchParams }) {
  const authenticated = await isAdminAuthenticated();

  if (!authenticated) {
    redirect("/admin/login");
  }

  await initDb();

  const params = await searchParams;
  const templateSlug = params?.template || undefined;
  const limit = Number(params?.limit || 500);

  const templates = await getTemplates({ includeInactive: true });
  const submissions = await getSubmissions({ templateSlug, limit });

  return (
    <AdminShell
      title="提交结果查询"
      description="快速检索提交结果，查看字段详情、来源信息和 Webhook 投递日志。"
      active="submissions"
      actions={
        <>
          <LinkButton href="/admin" variant="outline" size="sm">仪表盘</LinkButton>
          <LinkButton href="/admin/templates" variant="outline" size="sm">模板配置</LinkButton>
        </>
      }
    >
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>{submissions.length}</CardTitle>
            <CardDescription>当前结果数</CardDescription>
          </CardHeader>
        </Card>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>{templates.length}</CardTitle>
            <CardDescription>模板总数</CardDescription>
          </CardHeader>
        </Card>
        <Card className="glass-card md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">API 查询</CardTitle>
            <CardDescription>
              可使用 <code>/api/submissions?template=模板slug&limit=100</code> 配合 x-api-key 调用。
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Card className="glass-card">
        <CardContent className="pt-6">
          <AdminSubmissionList submissions={submissions} templates={templates} />
        </CardContent>
      </Card>
    </AdminShell>
  );
}
