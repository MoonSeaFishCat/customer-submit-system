import { createWebhookLog } from "@/lib/db";

// 私有 IP 地址段（RFC 1918 + 本地回环）
const PRIVATE_IP_RANGES = [
  /^127\./,                    // 127.0.0.0/8
  /^10\./,                     // 10.0.0.0/8
  /^172\.(1[6-9]|2[0-9]|3[01])\./, // 172.16.0.0/12
  /^192\.168\./,               // 192.168.0.0/16
  /^169\.254\./,               // 169.254.0.0/16 (Link-local)
  /^::1$/,                     // IPv6 localhost
  /^fe80:/i,                   // IPv6 link-local
  /^fc00:/i,                   // IPv6 unique local
];

function validateWebhookUrl(url) {
  try {
    const parsed = new URL(url);

    // 只允许 http/https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, reason: "只允许 http 或 https 协议" };
    }

    // 检查是否为 IP 地址（IPv4 或 IPv6）
    const hostname = parsed.hostname;

    // 禁止 localhost
    if (hostname === 'localhost') {
      return { valid: false, reason: "禁止访问 localhost" };
    }

    // 检查私有 IP
    for (const pattern of PRIVATE_IP_RANGES) {
      if (pattern.test(hostname)) {
        return { valid: false, reason: "禁止访问内网地址" };
      }
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, reason: "URL 格式错误" };
  }
}

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

      // 验证 URL 安全性
      const validation = validateWebhookUrl(url);
      if (!validation.valid) {
        result = {
          url,
          ok: false,
          statusCode: 0,
          response: {
            error: `URL 验证失败: ${validation.reason}`
          }
        };

        await createWebhookLog({
          submissionId: submission.id,
          templateId: template.id,
          url,
          ok: result.ok,
          statusCode: result.statusCode,
          response: result.response
        });

        results.push(result);
        return;
      }

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(template.webhook_headers || {})
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(8000),
          redirect: 'manual'  // 禁止自动跟随重定向
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
