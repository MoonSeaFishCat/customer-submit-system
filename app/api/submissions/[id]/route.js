import { NextResponse } from "next/server";
import { deleteSubmission, getSubmissionById, getTemplateBySlug, getWebhookLogs, initDb, updateSubmission } from "@/lib/db";
import { requireAdmin, verifyApiKey } from "@/lib/auth";
import { validateSubmissionData } from "@/lib/validators";

async function requireAdminOrApiKey(request) {
  try {
    await requireAdmin();
    return true;
  } catch {
    return await verifyApiKey(request);
  }
}

export async function GET(request, { params }) {
  await initDb();

  if (!(await requireAdminOrApiKey(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const submission = await getSubmissionById(id);

  if (!submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  const webhookLogs = await getWebhookLogs(id);
  return NextResponse.json({ submission, webhookLogs });
}

export async function PUT(request, { params }) {
  await initDb();

  if (!(await requireAdminOrApiKey(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const current = await getSubmissionById(id);

  if (!current) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  const nextData =
    body.merge === true || body.patch
      ? {
          ...(current.data || {}),
          ...(body.patch || body.data || {})
        }
      : body.data;

  const template = await getTemplateBySlug(current.template_slug, { includeInactive: true });

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const validation = validateSubmissionData(template, nextData || {}, { includeAdminOnly: true });

  if (!validation.ok) {
    return NextResponse.json({ error: "Validation failed", fields: validation.errors }, { status: 400 });
  }

  const submission = await updateSubmission(id, {
    data: validation.data,
    status: body.status
  });

  if (!submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  return NextResponse.json({ submission });
}

export async function PATCH(request, context) {
  return PUT(request, context);
}

export async function DELETE(request, { params }) {
  await initDb();

  if (!(await requireAdminOrApiKey(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const submission = await deleteSubmission(id);

  if (!submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, submission });
}
