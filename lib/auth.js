import { cookies } from "next/headers";
import crypto from "node:crypto";
import { getApiKey } from "@/lib/db";

const COOKIE_NAME = "customer_submit_admin";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

function shouldUseSecureCookie() {
  if (process.env.COOKIE_SECURE !== undefined) {
    return process.env.COOKIE_SECURE === "true";
  }

  return false;
}

function getAdminSecret() {
  const secret = process.env.ADMIN_SECRET;

  // 检查是否使用默认密钥
  if (!secret || secret === "admin-change-me" || secret === "change-this-admin-secret") {
    console.error("\n⚠️  安全警告: 检测到使用默认管理员密钥！\n");
    console.error("请立即修改 .env 文件中的 ADMIN_SECRET 为强密码。\n");
    console.error("建议使用随机生成的强密码，例如：");
    console.error(`  ADMIN_SECRET=${crypto.randomBytes(32).toString('hex')}\n`);

    // 生产环境拒绝启动
    if (process.env.NODE_ENV === "production") {
      throw new Error("生产环境禁止使用默认管理员密钥，请修改 ADMIN_SECRET");
    }
  }

  return secret || "admin-change-me";
}

function sign(value) {
  return crypto.createHmac("sha256", getAdminSecret()).update(value).digest("hex");
}

export async function createAdminSession() {
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  const nonce = crypto.randomBytes(16).toString('hex');
  const payload = `${expiresAt}.${nonce}`;
  const token = `${payload}.${sign(payload)}`;
  const store = await cookies();

  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(),
    path: "/",
    maxAge: SESSION_TTL_SECONDS
  });
}

export async function clearAdminSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function isAdminAuthenticated() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const [expiresAtStr, nonce, signature] = parts;
  if (!expiresAtStr || !nonce || !signature) return false;

  const payload = `${expiresAtStr}.${nonce}`;
  if (sign(payload) !== signature) return false;

  const expiresAt = Number(expiresAtStr);
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

export async function requireAdmin() {
  const ok = await isAdminAuthenticated();
  if (!ok) {
    const error = new Error("未授权，请先使用管理员密钥登录");
    error.status = 401;
    throw error;
  }
}

export function verifyAdminSecret(secret) {
  const expected = getAdminSecret();
  if (!secret || !expected) return false;

  const a = Buffer.from(String(secret));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
}

export async function verifyApiKey(request) {
  const configured = await getApiKey();
  const provided =
    request.headers.get("x-api-key") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!provided || !configured) return false;

  const a = Buffer.from(String(provided));
  const b = Buffer.from(String(configured));
  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
}
