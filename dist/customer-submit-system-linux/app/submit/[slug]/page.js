import { notFound } from "next/navigation";
import SubmitForm from "@/components/submit-form";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, LinkButton } from "@/components/ui";
import { getSubmissions, getTemplateBySlug, initDb } from "@/lib/db";

export default async function SubmitPage({ params }) {
  await initDb();
  const { slug } = await params;
  const template = await getTemplateBySlug(slug);

  if (!template) {
    notFound();
  }

  const submissions = await getSubmissions({ templateSlug: template.slug, limit: 1000 });

  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.16),transparent_34%),linear-gradient(180deg,#f8fbff_0%,#eef4ff_42%,#f8fafc_100%)]">
      <section className="subtle-grid relative px-4 py-6 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute right-8 top-10 h-40 w-40 rounded-full bg-blue-300/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-12 left-10 h-52 w-52 rounded-full bg-cyan-300/20 blur-3xl" />

        <div className="relative mx-auto max-w-[1600px] space-y-6">
          <div className="overflow-hidden rounded-3xl border bg-white/90 shadow-xl shadow-blue-950/5 backdrop-blur">
            <div className="relative p-6 sm:p-8">
              <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-blue-600 via-cyan-500 to-indigo-500" />

              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge variant="secondary" className="border-blue-100 bg-blue-50 text-blue-700">
                      公开提交页
                    </Badge>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                      当前模板已启用
                    </span>
                  </div>

                  <h1 className="mt-4 break-words text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                    {template.name}
                  </h1>
                  <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
                    {template.description || "请按要求填写信息，带星号的字段为必填。"}
                  </p>
                </div>

                <div className="flex flex-col gap-3 rounded-2xl border bg-slate-50/80 p-4 text-sm text-slate-600 sm:min-w-64">
                  <div className="flex items-center justify-between gap-4">
                    <span>字段数量</span>
                    <span className="font-semibold text-slate-950">{template.fields?.length || 0} 个</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span>已有记录</span>
                    <span className="font-semibold text-slate-950">{submissions.length} 条</span>
                  </div>
                  <LinkButton href="/" variant="outline" size="sm" className="mt-1 w-full bg-white">
                    返回首页
                  </LinkButton>
                </div>
              </div>
            </div>
          </div>

          <Card className="overflow-hidden rounded-3xl border-white/70 bg-white/95 shadow-2xl shadow-blue-950/8 backdrop-blur">
            <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-blue-50/70">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-2xl">信息填写表</CardTitle>
                  <CardDescription className="mt-2 text-sm">
                    点击“新增填写”添加一行，填写完成后点击右侧“保存提交”。系统会自动校验必填项。
                  </CardDescription>
                </div>
                <div className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/20">
                  云表格模式
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <SubmitForm template={template} submissions={submissions} />
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
