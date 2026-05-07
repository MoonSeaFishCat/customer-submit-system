import { NextResponse } from "next/server";
import { createSubmission, getTemplateBySlug, initDb } from "@/lib/db";
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
