"use client";

/**
 * ERP 订单弹窗组件
 */
export default function ErpOrderModal({ erpModal, onClose }) {
  if (!erpModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="关闭" />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl">
        <div className={`flex items-center justify-between border-b px-4 py-3 ${erpModal.order?._analysis?.anomaly ? "bg-red-50" : "bg-slate-50"}`}>
          <h3 className={`font-semibold ${erpModal.order?._analysis?.anomaly ? "text-red-700" : "text-slate-700"}`}>
            {erpModal.order?._analysis?.anomaly ? "⚠ 快麦订单详情（数量异常）" : "快麦订单详情"}
          </h3>
          <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={onClose}>关闭</button>
        </div>
        <div className="flex-1 overflow-auto p-4 text-sm">
          {erpModal.loading ? (
            <p className="text-muted-foreground">查询中，请稍候...</p>
          ) : erpModal.error ? (
            <div className="space-y-2">
              <p className="font-medium text-red-600">查询失败</p>
              <pre className="rounded bg-red-50 p-3 text-xs text-red-700 whitespace-pre-wrap">{erpModal.error}</pre>
              <p className="text-xs text-muted-foreground">submissionId: {erpModal.submission.id}</p>
              <p className="text-xs text-muted-foreground">旺旺ID字段值: {erpModal.submission.data?.text_wwid || "（空）"}</p>
            </div>
          ) : erpModal.order ? (
            <ErpOrderCard order={erpModal.order} />
          ) : (
            <p className="text-muted-foreground">暂无 ERP 订单数据</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ErpOrderCard({ order }) {
  const analysis = order._analysis;
  const anomaly = analysis?.anomaly === true;
  const allOrders = Array.isArray(order._allOrders) && order._allOrders.length > 0
    ? order._allOrders
    : [order];

  return (
    <div className="space-y-2">
      {anomaly && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          ⚠ 安装数量异常：登记 {analysis.submittedQty} 台，ERP 近15天订单含 {analysis.erpQty} 台安装服务
          {analysis.matchedOrders?.length > 0 && (
            <span className="ml-1 font-normal">（匹配订单：{analysis.matchedOrders.join("、")}）</span>
          )}
        </div>
      )}
      {analysis && !anomaly && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          ✓ 安装数量匹配：近15天共 {analysis.erpQty} 台
        </div>
      )}

      {allOrders.map((o, idx) => (
        <ErpSingleOrder key={o.tid || o.sid || idx} order={o} isNearest={o.tid === order.tid && o.sid === order.sid} />
      ))}
    </div>
  );
}

function ErpSingleOrder({ order, isNearest }) {
  const INSTALL_IDS = new Set([
    "1051581569538","1051582141548","1049851259551","3771342413533151692",
    "10210090243690","10113616546438","105059077014","1050590702360",
  ]);

  const fields = [
    ["店铺", order.shopName],
    ["平台", order.shopSourceName || order.shopSource],
    ["订单号", order.tid],
    ["快递单号", order.outSid],
    ["快递公司", order.expressName || order.logisticsCompanyName],
    ["付款金额", order.paymentDisplay || order.payment],
    ["付款时间", order.payTime ? new Date(order.payTime).toLocaleString("zh-CN") : ""],
    ["发货时间", order.consignTime ? new Date(order.consignTime).toLocaleString("zh-CN") : ""],
    ["卖家备注", order.sellerMemo],
    ["状态", order.chStatus || order.sysStatus],
  ].filter(([, v]) => v !== undefined && v !== null && v !== "");

  return (
    <div className={`rounded-lg border p-3 text-xs ${isNearest ? "border-blue-300 bg-blue-50/40" : "border-slate-200 bg-white"}`}>
      {isNearest && <div className="mb-1.5 text-xs font-semibold text-blue-600">▶ 最近订单</div>}
      <div className="space-y-1">
        {fields.map(([label, value]) => (
          <div key={label} className="flex gap-1.5">
            <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
            <span className="break-all text-slate-800">{String(value)}</span>
          </div>
        ))}
      </div>
      {Array.isArray(order.orders) && order.orders.length > 0 && (
        <div className="mt-2 border-t pt-2">
          <div className="mb-1 font-medium text-slate-600">子订单商品</div>
          {order.orders.map((sub, i) => {
            const isInstallById =
              INSTALL_IDS.has(String(sub.numIid || "")) ||
              INSTALL_IDS.has(String(sub.outerIid || "")) ||
              INSTALL_IDS.has(String(sub.skuId || ""));
            const isInstallByTitle = String(sub.sysTitle || sub.title || "").includes("AZ-上门安装服务");
            const isInstall = isInstallById || isInstallByTitle;
            return (
              <div key={i} className={`mb-1 rounded px-2 py-1 ${isInstall ? "bg-blue-100 font-medium text-blue-800" : "bg-slate-50"}`}>
                <span>{sub.sysTitle || sub.title}</span>
                {sub.skuPropertiesName ? <span className="ml-1 text-muted-foreground">({sub.skuPropertiesName})</span> : null}
                <span className="ml-1">×{sub.num}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
