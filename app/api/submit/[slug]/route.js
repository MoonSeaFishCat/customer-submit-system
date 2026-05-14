import { NextResponse } from "next/server";
import { createSubmission, getSubmissionById, getTemplateBySlug, initDb, updateSubmission, updateSubmissionErpOrder } from "@/lib/db";
import { pushSubmission } from "@/lib/submission-push";
import { validateSubmissionData } from "@/lib/validators";
import { searchErpOrders, pickNearestOrder, analyzeInstallCount } from "@/lib/erp";

// 从提交数据中提取旺旺ID或订单号字段值
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
function extractInstallQty(data) {
  if (!data) return 0;
  const qtyKeys = ["AZSL", "qty", "quantity", "count", "num", "数量", "安装数量", "台数", "安装台数"];
  for (const key of qtyKeys) {
    if (data[key] !== undefined && data[key] !== "") return Number(data[key]) || 0;
  }
  return 0;
}

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

  let submission = await createSubmission({
    template,
    data: validation.data,
    source: body.source || "web",
    ip: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "",
    userAgent: request.headers.get("user-agent") || ""
  });

  let pushResult = null;
  if (template.push_mode === "auto") {
    pushResult = await pushSubmission(submission.id);
    submission = pushResult.submission || submission;
  }

  // 异步触发 ERP 订单查询，不阻塞响应
  const erpQuery = extractErpQuery(validation.data);
  if (erpQuery) {
    const submissionId = submission.id;
    const createdAt = submission.created_at;
    const submittedQty = extractInstallQty(validation.data);
    Promise.resolve().then(async () => {
      try {
        console.log("[ERP] 开始查询, query=", erpQuery, "submittedQty=", submittedQty);
        const orders = await searchErpOrders(erpQuery);
        console.log("[ERP] 查询结果数量:", orders.length);
        if (orders.length > 0) {
          const CLOSED_STATUSES = new Set(["TRADE_CLOSED", "TRADE_CLOSED_BY_TAOBAO", "CLOSED", "closed"]);
          const activeOrders = orders.filter((o) =>
            !CLOSED_STATUSES.has(String(o.status || "")) &&
            !String(o.chStatus || "").includes("关闭") &&
            !String(o.sysStatus || "").includes("CLOSED")
          );
          const order = pickNearestOrder(activeOrders.length > 0 ? activeOrders : orders, createdAt);
          const analysis = analyzeInstallCount(orders, createdAt, submittedQty);
          console.log("[ERP] 选中订单 tid=", order.tid, "analysis=", analysis);
          await updateSubmissionErpOrder(submissionId, { ...order, _allOrders: activeOrders, _analysis: analysis });
          console.log("[ERP] 写库成功 submissionId=", submissionId);
        } else {
          console.log("[ERP] 未找到订单");
        }
      } catch (err) {
        console.error("[ERP] 查询异常:", err.message, err.stack);
      }
    });
  }

  return NextResponse.json({ submission, pushResult }, { status: 201 });
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

  const adminOnlyData = Object.fromEntries(
    (template.fields || [])
      .filter((field) => field.adminOnly && Object.prototype.hasOwnProperty.call(current.data || {}, field.key))
      .map((field) => [field.key, current.data[field.key]])
  );

  const submission = await updateSubmission(id, {
    data: {
      ...validation.data,
      ...adminOnlyData
    },
    status: body.status || current.status
  });

  return NextResponse.json({ submission });
}

export async function PATCH(request, context) {
  return PUT(request, context);
}
