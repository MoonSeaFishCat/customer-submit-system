import { NextResponse } from "next/server";
import { getSubmissionById, getTemplateBySlug, initDb, updateSubmissionPushStatus } from "@/lib/db";
import { requireAdmin, verifyApiKey } from "@/lib/auth";
import { dispatchWebhooks } from "@/lib/webhook";

async function requireAdminOrApiKey(request) {
  try {
    await requireAdmin();
    return true;
  } catch {
    return await verifyApiKey(request);
  }
}

async function pushSubmission(id) {
  const submission = await getSubmissionById(id);

  if (!submission) {
    return {
      id,
      ok: false,
      error: "Submission not found"
    };
  }

  const template = await getTemplateBySlug(submission.template_slug, { includeInactive: true });

  if (!template) {
    await updateSubmissionPushStatus(id, "failed", undefined);
    return {
      id,
      ok: false,
      submission: await getSubmissionById(id),
      error: "Template not found"
    };
  }

  await updateSubmissionPushStatus(id, "pushing", undefined);

  try {
    const urls = Array.isArray(template.webhook_urls) ? template.webhook_urls.filter(Boolean) : [];

    if (urls.length === 0) {
      const nextSubmission = await updateSubmissionPushStatus(id, "not_configured", null);

      return {
        id,
        ok: false,
        submission: nextSubmission,
        webhooks: [],
        error: "未配置 Webhook 地址，无法推送"
      };
    }

    const webhooks = await dispatchWebhooks({ template, submission });
    const ok = webhooks.length > 0 && webhooks.every((item) => item.ok);
    const nextSubmission = await updateSubmissionPushStatus(id, ok ? "success" : "failed", ok ? new Date().toISOString() : null);

    return {
      id,
      ok,
      submission: nextSubmission,
      webhooks,
      error: ok ? null : "部分或全部 Webhook 推送失败"
    };
  } catch (error) {
    const nextSubmission = await updateSubmissionPushStatus(id, "failed", undefined);

    return {
      id,
      ok: false,
      submission: nextSubmission,
      error: error.message || "推送失败"
    };
  }
}

export async function POST(request) {
  await initDb();

  if (!(await requireAdminOrApiKey(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const ids = Array.from(new Set((Array.isArray(body.ids) ? body.ids : [body.id]).filter(Boolean)));

  if (ids.length === 0) {
    return NextResponse.json({ error: "请选择需要推送的记录" }, { status: 400 });
  }

  const results = [];
  for (const id of ids) {
    results.push(await pushSubmission(id));
  }

  return NextResponse.json({
    ok: results.every((item) => item.ok),
    results
  });
}
