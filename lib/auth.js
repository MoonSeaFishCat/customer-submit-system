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
  return process.env.ADMIN_SECRET || "admin-change-me";
}

function sign(value) {
  return crypto.createHmac("sha256", getAdminSecret()).update(value).digest("hex");
}

export async function createAdminSession() {
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  const payload = `${expiresAt}`;
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

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  if (sign(payload) !== signature) return false;

  const expiresAt = Number(payload);
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
