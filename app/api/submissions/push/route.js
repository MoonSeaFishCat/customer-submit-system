import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAdmin, verifyApiKey } from "@/lib/auth";
import { pushSubmission } from "@/lib/submission-push";

async function requireAdminOrApiKey(request) {
  try {
    await requireAdmin();
    return true;
  } catch {
    return await verifyApiKey(request);
  }
}

export async function POST(request) {
  await initDb();

  if (!(await requireAdminOrApiKey(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const ids = Array.from(new Set((Array.isArray(body.ids) ? body.ids : [body.id]).filter(Boolean)));

  if (ids.length === 0) {
    return NextResponse.json({ error: "请选择需要推送的记录" }, { status: 400 });
  }

  const results = [];
  for (const id of ids) {
    results.push(await pushSubmission(id));
  }

  return NextResponse.json({
    ok: results.every((item) => item.ok),
    results
  });
}
