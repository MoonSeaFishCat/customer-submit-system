import { NextResponse } from "next/server";
import { createTemplate, getTemplates, initDb } from "@/lib/db";
import { requireAdmin, verifyApiKey } from "@/lib/auth";
import { templateSchema } from "@/lib/validators";

export async function GET(request) {
  await initDb();
  const includeInactive = request.nextUrl.searchParams.get("includeInactive") === "1";

  if (includeInactive) {
    try {
      await requireAdmin();
    } catch {
      if (!verifyApiKey(request)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
  }

  const templates = await getTemplates({ includeInactive });
  return NextResponse.json({ templates });
}

export async function POST(request) {
  await initDb();

  try {
    await requireAdmin();
  } catch {
    if (!verifyApiKey(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const body = await request.json();
  const parsed = templateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const template = await createTemplate(parsed.data);
  return NextResponse.json({ template }, { status: 201 });
}
