import { NextResponse } from "next/server";
import { createAdminSession, verifyAdminSecret } from "@/lib/auth";

export async function POST(request) {
  const body = await request.json();

  if (!verifyAdminSecret(body.secret)) {
    return NextResponse.json({ error: "管理员密钥错误" }, { status: 401 });
  }

  await createAdminSession();
  return NextResponse.json({ ok: true });
}
