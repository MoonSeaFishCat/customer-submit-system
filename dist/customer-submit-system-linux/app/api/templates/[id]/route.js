import { NextResponse } from "next/server";
import { deleteTemplate, getTemplateById, initDb, updateTemplate } from "@/lib/db";
import { requireAdmin, verifyApiKey } from "@/lib/auth";
import { templateSchema } from "@/lib/validators";

async function requireAdminOrApiKey(request) {
  try {
    await requireAdmin();
    return true;
  } catch {
    return verifyApiKey(request);
  }
}

export async function GET(request, { params }) {
  await initDb();

  if (!(await requireAdminOrApiKey(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const template = await getTemplateById(id);

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  return NextResponse.json({ template });
}

export async function PUT(request, { params }) {
  await initDb();

  if (!(await requireAdminOrApiKey(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = templateSchema.partial().safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const template = await updateTemplate(id, parsed.data);

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  return NextResponse.json({ template });
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
  const template = await deleteTemplate(id);

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, template });
}
