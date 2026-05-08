import { redirect } from "next/navigation";
import AdminShell from "@/components/admin-shell";
import TemplateEditor from "@/components/template-editor";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, LinkButton } from "@/components/ui";
import { isAdminAuthenticated } from "@/lib/auth";
import { getTemplates, initDb } from "@/lib/db";

export default async function AdminTemplatesPage() {
  const authenticated = await isAdminAuthenticated();

  if (!authenticated) {
    redirect("/admin/login");
  }

  await initDb();
  const templates = await getTemplates({ includeInactive: true });

  return (
    <AdminShell
      title="模板配置"
      description="使用可视化方式配置提交模板、字段、Webhook 和启用状态。"
      active="templates"
      actions={
        <>
          <LinkButton href="/admin" variant="outline" size="sm">仪表盘</LinkButton>
          <LinkButton href="/admin/submissions" variant="outline" size="sm">提交查询</LinkButton>
        </>
      }
    >
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>可视化模板配置</CardTitle>
          <CardDescription>
            添加、删除、排序字段，配置字段类型、必填项、下拉选项和 Webhook。保存后公开提交页会立即使用新模板。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TemplateEditor templates={templates} />
        </CardContent>
      </Card>
    </AdminShell>
  );
}
