import { getSubmissionById, getTemplateBySlug, updateSubmissionPushStatus } from "@/lib/db";
import { dispatchWebhooks } from "@/lib/webhook";

export async function pushSubmission(id) {
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

    const latestSubmission = await getSubmissionById(id);
    const webhooks = await dispatchWebhooks({ template, submission: latestSubmission || submission });
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
