import { NextResponse } from "next/server";
import { createSubmission, getSubmissionById, getTemplateBySlug, initDb, updateSubmission } from "@/lib/db";
import { validateSubmissionData } from "@/lib/validators";
import { dispatchWebhooks } from "@/lib/webhook";

export async function GET(request, { params }) {
  await initDb();
  const { slug } = await params;
  const template = await getTemplateBySlug(slug);

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  return NextResponse.json({ template });
}

export async function POST(request, { params }) {
  await initDb();
  const { slug } = await params;
  const template = await getTemplateBySlug(slug);

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const body = await request.json();
  const rawData = body.data || body;
  const validation = validateSubmissionData(template, rawData);

  if (!validation.ok) {
    return NextResponse.json({ error: "Validation failed", fields: validation.errors }, { status: 400 });
  }

  const submission = await createSubmission({
    template,
    data: validation.data,
    source: body.source || "web",
    ip: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "",
    userAgent: request.headers.get("user-agent") || ""
  });

  dispatchWebhooks({ template, submission }).catch((error) => {
    console.error("Webhook dispatch failed", error);
  });

  return NextResponse.json({ submission }, { status: 201 });
}

export async function PUT(request, { params }) {
  await initDb();
  const { slug } = await params;
  const template = await getTemplateBySlug(slug);

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const body = await request.json();
  const id = body.id || body.submissionId;

  if (!id) {
    return NextResponse.json({ error: "提交记录编号不能为空" }, { status: 400 });
  }

  const current = await getSubmissionById(id);

  if (!current || current.template_slug !== slug) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  const rawData = body.data || {};
  const validation = validateSubmissionData(template, rawData);

  if (!validation.ok) {
    return NextResponse.json({ error: "Validation failed", fields: validation.errors }, { status: 400 });
  }

  const submission = await updateSubmission(id, {
    data: validation.data,
    status: body.status || current.status
  });

  return NextResponse.json({ submission });
}

export async function PATCH(request, context) {
  return PUT(request, context);
}
