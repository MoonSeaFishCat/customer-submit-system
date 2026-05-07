import { NextResponse } from "next/server";
import { addTemplateSubmissionField, initDb } from "@/lib/db";
import { requireAdmin, verifyApiKey } from "@/lib/auth";
import { slugify } from "@/lib/utils";

async function requireAdminOrApiKey(request) {
  try {
    await requireAdmin();
    return true;
  } catch {
    return verifyApiKey(request);
  }
}

export async function POST(request) {
  await initDb();

  if (!(await requireAdminOrApiKey(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const templateSlug = body.template_slug || body.templateSlug;
  const label = String(body.label || "").trim();

  if (!templateSlug) {
    return NextResponse.json({ error: "模板不能为空" }, { status: 400 });
  }

  if (!label) {
    return NextResponse.json({ error: "字段名称不能为空" }, { status: 400 });
  }

  const keyBase = slugify(body.key || label).replace(/-/g, "_") || "extra_field";
  const key = `${keyBase}_${Date.now().toString(36)}`;

  const result = await addTemplateSubmissionField(templateSlug, {
    key,
    label,
    type: "textarea",
    width: "half"
  });

  if (!result) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  return NextResponse.json({
    field: { key, label, type: "textarea", width: "half" },
    template: result.template,
    submissions: result.submissions
  });
}
