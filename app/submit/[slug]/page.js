import { notFound } from "next/navigation";
import SubmitForm from "@/components/submit-form";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, LinkButton } from "@/components/ui";
import { getTemplateBySlug, initDb } from "@/lib/db";

export default async function SubmitPage({ params }) {
  await initDb();
  const { slug } = await params;
  const template = await getTemplateBySlug(slug);

  if (!template) {
    notFound();
  }

  return (
    <main className="min-h-screen subtle-grid">
      <section className="page-shell max-w-3xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <Badge variant="secondary">公开提交页</Badge>
            <h1 className="mt-3 text-3xl font-bold">{template.name}</h1>
            <p className="mt-2 text-muted-foreground">{template.description || "请按要求填写信息。"}</p>
          </div>
          <LinkButton href="/" variant="outline" size="sm">返回首页</LinkButton>
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>填写信息</CardTitle>
            <CardDescription>无需登录，可多人同时提交。带 * 的字段为必填。</CardDescription>
          </CardHeader>
          <CardContent>
            <SubmitForm template={template} />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
