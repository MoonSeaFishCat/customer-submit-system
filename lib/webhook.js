import { createWebhookLog } from "@/lib/db";

export async function dispatchWebhooks({ template, submission }) {
  const urls = Array.isArray(template.webhook_urls) ? template.webhook_urls.filter(Boolean) : [];
  if (urls.length === 0) return [];

  const payload = {
    event: "submission.created",
    template: {
      id: template.id,
      slug: template.slug,
      name: template.name
    },
    submission: {
      id: submission.id,
      data: submission.data,
      status: submission.status,
      source: submission.source,
      created_at: submission.created_at
    }
  };

  const results = [];

  await Promise.all(
    urls.map(async (url) => {
      let result = {
        url,
        ok: false,
        statusCode: 0,
        response: null
      };

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(template.webhook_headers || {})
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(8000)
        });

        const text = await res.text();
        result = {
          url,
          ok: res.ok,
          statusCode: res.status,
          response: {
            body: text.slice(0, 2000)
          }
        };
      } catch (error) {
        result = {
          url,
          ok: false,
          statusCode: 0,
          response: {
            error: error.message
          }
        };
      }

      await createWebhookLog({
        submissionId: submission.id,
        templateId: template.id,
        url,
        ok: result.ok,
        statusCode: result.statusCode,
        response: result.response
      });

      results.push(result);
    })
  );

  return results;
}
