import { NextResponse } from "next/server";
import { initDb, getSubmissionById, updateSubmissionErpOrder, updateSubmissionErpOverride } from "@/lib/db";
import { requireAdmin, verifyApiKey } from "@/lib/auth";
import { searchErpOrders, searchErpOrder, pickNearestOrder, analyzeInstallCount } from "@/lib/erp";

async function requireAdminOrApiKey(request) {
  try {
    await requireAdmin();
    return true;
  } catch {
    return await verifyApiKey(request);
  }
}

// GET /api/erp/order?query=旺旺ID或订单号
export async function GET(request) {
  await initDb();
  if (!(await requireAdminOrApiKey(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim();
  if (!query) {
    return NextResponse.json({ error: "缺少 query 参数" }, { status: 400 });
  }

  try {
    const order = await searchErpOrder(query);
    return NextResponse.json({ ok: true, order });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

// POST /api/erp/order
// { submissionId, query?, installQtyField? }
// installQtyField: 提交数据中表示安装数量的字段 key，默认自动探测
export async function POST(request) {
  await initDb();
  if (!(await requireAdminOrApiKey(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { submissionId, query, installQtyField } = body;

  if (!submissionId) {
    return NextResponse.json({ error: "缺少 submissionId" }, { status: 400 });
  }

  const submission = await getSubmissionById(submissionId);
  if (!submission) {
    return NextResponse.json({ error: "提交记录不存在" }, { status: 404 });
  }

  const erpQuery = query?.trim() || extractErpQuery(submission.data);
  if (!erpQuery) {
    return NextResponse.json(
      { ok: false, error: "无法从提交数据中提取旺旺ID或订单号，请手动传入 query" },
      { status: 400 }
    );
  }

  try {
    const orders = await searchErpOrders(erpQuery);
    if (orders.length === 0) {
      return NextResponse.json({ ok: false, order: null, error: "ERP 中未找到对应订单" });
    }

    const CLOSED_STATUSES = new Set(["TRADE_CLOSED", "TRADE_CLOSED_BY_TAOBAO", "CLOSED", "closed"]);
    const activeOrders = orders.filter((o) =>
      !CLOSED_STATUSES.has(String(o.status || "")) &&
      !String(o.chStatus || "").includes("关闭") &&
      !String(o.sysStatus || "").includes("CLOSED")
    );

    // 选与提交时间最近的订单（用于展示主订单信息）
    const order = pickNearestOrder(activeOrders.length > 0 ? activeOrders : orders, submission.created_at);

    // 提取安装数量：优先用指定字段，否则自动探测
    const submittedQty = extractInstallQty(submission.data, installQtyField);

    // 分析近15天内所有订单的安装服务数量
    const analysis = analyzeInstallCount(orders, submission.created_at, submittedQty);

    // 存库：主订单 + 有效订单列表 + 分析结果
    const enriched = { ...order, _allOrders: activeOrders, _analysis: analysis };
    const updated = await updateSubmissionErpOrder(submissionId, enriched);

    return NextResponse.json({ ok: true, order: enriched, analysis, submission: updated });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

// PATCH /api/erp/order  { submissionId, override: "no_anomaly" | null }
export async function PATCH(request) {
  await initDb();
  if (!(await requireAdminOrApiKey(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { submissionId, override } = body;
  if (!submissionId) {
    return NextResponse.json({ error: "缺少 submissionId" }, { status: 400 });
  }

  const updated = await updateSubmissionErpOverride(submissionId, override || null);
  if (!updated) {
    return NextResponse.json({ error: "提交记录不存在" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, submission: updated });
}

function extractErpQuery(data) {
  if (!data || typeof data !== "object") return null;
  const candidates = ["text_wwid", "buyerNick", "buyer_nick", "wangwang", "旺旺", "nick", "tid", "order_id", "orderId", "订单号"];
  for (const key of candidates) {
    if (data[key] && String(data[key]).trim()) return String(data[key]).trim();
  }
  for (const [, v] of Object.entries(data)) {
    const s = String(v || "").trim();
    if (s && /^[0-9]{10,}$/.test(s)) return s;
  }
  return null;
}

// 从提交数据中提取安装数量
function extractInstallQty(data, fieldKey) {
  if (!data) return 0;
  if (fieldKey && data[fieldKey] !== undefined) return Number(data[fieldKey]) || 0;
  const qtyKeys = ["AZSL", "qty", "quantity", "count", "num", "数量", "安装数量", "台数", "安装台数"];
  for (const key of qtyKeys) {
    if (data[key] !== undefined && data[key] !== "") return Number(data[key]) || 0;
  }
  return 0;
}
