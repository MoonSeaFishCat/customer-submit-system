import { NextResponse } from "next/server";
import { createSubmission, getSubmissions, getTemplateBySlug, initDb } from "@/lib/db";
import { requireAdmin, verifyApiKey } from "@/lib/auth";
import { validateSubmissionData } from "@/lib/validators";
import { dispatchWebhooks } from "@/lib/webhook";

async function requireAdminOrApiKey(request) {
  try {
    await requireAdmin();
    return true;
  } catch {
    return verifyApiKey(request);
  }
}

export async function GET(request) {
  await initDb();

  if (!(await requireAdminOrApiKey(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const templateSlug = request.nextUrl.searchParams.get("template") || undefined;
  const limit = request.nextUrl.searchParams.get("limit") || 100;
  const submissions = await getSubmissions({ templateSlug, limit });

  return NextResponse.json({ submissions });
}

export async function POST(request) {
  await initDb();

  if (!(await requireAdminOrApiKey(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const slug = body.template_slug || body.templateSlug || body.slug;
  const template = await getTemplateBySlug(slug, { includeInactive: true });

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const validation = validateSubmissionData(template, body.data || {});

  if (!validation.ok) {
    return NextResponse.json({ error: "Validation failed", fields: validation.errors }, { status: 400 });
  }

  const submission = await createSubmission({
    template,
    data: validation.data,
    source: body.source || "api",
    ip: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "",
    userAgent: request.headers.get("user-agent") || ""
  });

  const webhooks = await dispatchWebhooks({ template, submission });

  return NextResponse.json({ submission, webhooks }, { status: 201 });
}
