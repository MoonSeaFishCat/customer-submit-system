import { NextResponse } from "next/server";
import { createSubmission, getSubmissions, getTemplateBySlug, initDb } from "@/lib/db";
import { requireAdmin, verifyApiKey } from "@/lib/auth";
import { pushSubmission } from "@/lib/submission-push";
import { validateSubmissionData } from "@/lib/validators";

async function requireAdminOrApiKey(request) {
  try {
    await requireAdmin();
    return true;
  } catch {
    return await verifyApiKey(request);
  }
}

export async function GET(request) {
  await initDb();

  if (!(await requireAdminOrApiKey(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const templateSlug = sp.get("template") || undefined;
  const limit = sp.get("limit") || 100;
  const search = sp.get("search") || undefined;
  const startDate = sp.get("startDate") || undefined;
  const endDate = sp.get("endDate") || undefined;
  const status = sp.get("status") || undefined;
  const source = sp.get("source") || undefined;
  const pushStatus = sp.get("pushStatus") || undefined;
  const erpStatus = sp.get("erpStatus") || undefined;
  const ip = sp.get("ip") || undefined;
  const fieldFiltersJson = sp.get("fieldFilters") || undefined;
  const pageSize = sp.get("pageSize") ? Number(sp.get("pageSize")) : undefined;
  const page = sp.get("page") ? Number(sp.get("page")) : 1;

  let fieldFilters = [];
  if (fieldFiltersJson) {
    try {
      fieldFilters = JSON.parse(fieldFiltersJson);
    } catch (e) {
      return NextResponse.json({ error: "Invalid fieldFilters format" }, { status: 400 });
    }
  }

  const result = await getSubmissions({
    templateSlug,
    limit,
    page,
    pageSize,
    search,
    startDate,
    endDate,
    status,
    source,
    pushStatus,
    erpStatus,
    ip,
    fieldFilters
  });

  if (pageSize) {
    return NextResponse.json(result);
  }
  return NextResponse.json({ submissions: result });
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

  const validation = validateSubmissionData(template, body.data || {}, { includeAdminOnly: true });

  if (!validation.ok) {
    return NextResponse.json({ error: "Validation failed", fields: validation.errors }, { status: 400 });
  }

  let submission = await createSubmission({
    template,
    data: validation.data,
    source: body.source || "api",
    ip: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "",
    userAgent: request.headers.get("user-agent") || ""
  });

  let pushResult = null;
  if (template.push_mode === "auto") {
    pushResult = await pushSubmission(submission.id);
    submission = pushResult.submission || submission;
  }

  return NextResponse.json({ submission, pushResult }, { status: 201 });
}
