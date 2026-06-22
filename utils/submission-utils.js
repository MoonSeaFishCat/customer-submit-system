// 提交记录相关工具函数

/**
 * 格式化日期时间
 */
export function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * 获取所有提交记录的数据字段键
 */
export function getAllDataKeys(submissions) {
  const keys = new Set();
  submissions.forEach((s) => Object.keys(s.data || {}).forEach((k) => keys.add(k)));
  return Array.from(keys);
}

/**
 * 从模板列表构建字段标签映射
 */
export function buildFieldLabelMap(templates) {
  const map = new Map();
  templates.forEach((t) =>
    (t.fields || []).forEach((f) => {
      if (f.key && f.label && !map.has(f.key)) map.set(f.key, f.label);
    })
  );
  return map;
}

/**
 * 标准化重复值检测的值
 */
export function normalizeDuplicateValue(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "object") return JSON.stringify(value).trim().toLowerCase();
  return String(value).trim().toLowerCase();
}

/**
 * 转义 HTML 字符
 */
export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/**
 * 格式化导出单元格值
 */
export function formatExportCellValue(value) {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.join("、");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * 构建 Excel HTML 导出内容
 */
export function buildExcelHtml(allRows, tableFieldKeys, getFieldLabel, templateName, count) {
  const exportedAt = formatDate(new Date().toISOString());
  const headers = tableFieldKeys.map((key) => getFieldLabel(key));
  const columnCount = Math.max(headers.length, 1);
  const columnWidths = headers.map(() => '<col style="width: 180px" />').join("");
  const bodyRows = allRows.length > 0
    ? allRows.map((s, i) =>
        `<tr>${tableFieldKeys.map((key) =>
          `<td class="cell ${i % 2 === 1 ? "cell-alt" : ""}">${escapeHtml(formatExportCellValue(s.data?.[key]))}</td>`
        ).join("")}</tr>`
      ).join("")
    : `<tr><td class="empty" colspan="${columnCount}">暂无数据</td></tr>`;
  return {
    templateName,
    timestamp: exportedAt.replace(/[:\s]/g, "-"),
    html: `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8" />
<style>body{margin:0;font-family:"Microsoft YaHei",Arial,sans-serif;color:#0f172a;background:#fff}
table.excel-table{border-collapse:collapse;table-layout:fixed;width:100%;font-size:12px}
.title{height:34px;padding:14px 16px;color:#fff;background:#1d4ed8;border:1px solid #1e40af;font-size:20px;font-weight:700;text-align:center;vertical-align:middle}
.meta{height:24px;padding:8px 12px;color:#475569;background:#eff6ff;border:1px solid #bfdbfe;font-size:12px;text-align:left;vertical-align:middle}
th{height:30px;padding:8px 10px;color:#fff;background:#2563eb;border:1px solid #93c5fd;font-size:12px;font-weight:700;text-align:center;vertical-align:middle;white-space:nowrap}
td.cell{min-height:24px;padding:7px 10px;color:#111827;background:#fff;border:1px solid #dbeafe;text-align:left;vertical-align:top;word-break:break-all;white-space:normal}
td.cell-alt{background:#f8fbff}td.empty{padding:22px 10px;color:#64748b;background:#f8fafc;border:1px solid #dbeafe;text-align:center}
</style></head><body>
<table class="excel-table">${columnWidths}
<tr><td class="title" colspan="${columnCount}">${escapeHtml(templateName)} - 查询结果</td></tr>
<tr><td class="meta" colspan="${columnCount}">导出时间：${escapeHtml(exportedAt)}　共 ${count} 条记录</td></tr>
<tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr>
${bodyRows}
</table></body></html>`
  };
}

/**
 * 下载 Excel 文件
 */
export function downloadExcel(html, templateName, timestamp) {
  const blob = new Blob(["ufeff" + html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${String(templateName).replace(/[\\/:*?"<>|]/g, "-").slice(0, 80)}-查询结果-${timestamp}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
