"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ConfirmDialog from "@/components/confirm-dialog";
import ToastNotice from "@/components/toast-notice";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Select, Textarea } from "@/components/ui";

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function getAllDataKeys(submissions) {
  const keys = new Set();
  submissions.forEach((s) => Object.keys(s.data || {}).forEach((k) => keys.add(k)));
  return Array.from(keys);
}

function buildFieldLabelMap(templates) {
  const map = new Map();
  templates.forEach((t) =>
    (t.fields || []).forEach((f) => {
      if (f.key && f.label && !map.has(f.key)) map.set(f.key, f.label);
    })
  );
  return map;
}

function normalizeDuplicateValue(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "object") return JSON.stringify(value).trim().toLowerCase();
  return String(value).trim().toLowerCase();
}

const PAGE_SIZE = 20;

export default function AdminSubmissionList({ submissions: initialSubmissions, initialTotal, templates }) {
  const [rows, setRows] = useState(initialSubmissions);
  const [total, setTotal] = useState(initialTotal ?? initialSubmissions.length);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [templateItems, setTemplateItems] = useState(templates);
  const [templateSlug, setTemplateSlug] = useState(templates[0]?.slug || "");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [keyword, setKeyword] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [visibleFieldKeys, setVisibleFieldKeys] = useState([]);
  const [newColumnName, setNewColumnName] = useState("");
  const [selected, setSelected] = useState(null);
  const [patchJson, setPatchJson] = useState("{\n  \"internal_note\": \"\"\n}");
  const [patchMessage, setPatchMessage] = useState("");
  const [notice, setNotice] = useState(null);
  const [draftRows, setDraftRows] = useState({});
  const [newRows, setNewRows] = useState([]);
  const [checkedIds, setCheckedIds] = useState([]);
  const [pushingIds, setPushingIds] = useState([]);
  const [confirmAction, setConfirmAction] = useState(null);
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const dragStateRef = useRef(null);

  // ERP 弹窗状态
  const [erpModal, setErpModal] = useState(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  async function fetchPage(p, overrides = {}) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      const slug = overrides.templateSlug !== undefined ? overrides.templateSlug : templateSlug;
      const q = overrides.keyword !== undefined ? overrides.keyword : keyword;
      const st = overrides.status !== undefined ? overrides.status : status;
      const src = overrides.source !== undefined ? overrides.source : source;
      const df = overrides.dateFrom !== undefined ? overrides.dateFrom : dateFrom;
      const dt = overrides.dateTo !== undefined ? overrides.dateTo : dateTo;
      if (slug) params.set("template", slug);
      if (q) params.set("search", q);
      if (st) params.set("status", st);
      if (src) params.set("source", src);
      if (df) params.set("startDate", df);
      if (dt) params.set("endDate", dt);
      params.set("page", String(p));
      params.set("pageSize", String(overrides.pageSize !== undefined ? overrides.pageSize : pageSize));
      const res = await fetch("/api/submissions?" + params.toString());
      const data = await res.json();
      const newRows = data.submissions || [];
      setRows(newRows);
      setTotal(data.total || 0);
      setPage(p);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { setTemplateItems(templates); }, [templates]);

  useEffect(() => { fetchPage(1); }, []);

  useEffect(() => {
    if (!selected) return;
    function onKeyDown(e) { if (e.key === "Escape") setSelected(null); }
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKeyDown); document.body.style.overflow = ""; };
  }, [selected]);

  useEffect(() => { setVisibleFieldKeys([]); }, [templateSlug]);

  const fieldLabelMap = useMemo(() => buildFieldLabelMap(templateItems), [templateItems]);

  function notify(text, type = "info", title) {
    setNotice({
      text,
      type,
      title: title || (type === "success" ? "操作成功" : type === "error" ? "操作失败" : type === "warning" ? "请注意" : "操作提示")
    });
  }

  function getFieldLabel(key) { return fieldLabelMap.get(key) || key; }

  function getFieldDefinition(key) {
    return (currentTemplate?.fields || []).find((f) => f.key === key) || { key, label: getFieldLabel(key), type: "text" };
  }

  function renderAdminEditableCell({ rowId, data, key, duplicate = false, onUpdate }) {
    const field = getFieldDefinition(key);
    const normalizedType = field.type === "dropdown" || field.type === "radio" ? "select" : field.type;
    const options = Array.isArray(field.options)
      ? field.options
      : String(field.optionsText || "").split("\n").map((o) => o.trim()).filter(Boolean);
    const value = data?.[key] === undefined || data?.[key] === null ? "" : data[key];
    const dupClass = duplicate ? "border-amber-300 bg-amber-100/80 font-semibold text-amber-900 focus-visible:ring-amber-400" : "";

    if (normalizedType === "multiselect") {
      const selectedVals = String(value) ? String(value).split("+").map((v) => v.trim()).filter(Boolean) : [];
      const toggle = (opt) => {
        const next = selectedVals.includes(opt) ? selectedVals.filter((v) => v !== opt) : [...selectedVals, opt];
        onUpdate(rowId, key, next.join("+"));
      };
      const removeCustom = (opt) => {
        const next = selectedVals.filter((v) => v !== opt);
        onUpdate(rowId, key, next.join("+"));
      };
      const displayText = selectedVals.length > 0 ? selectedVals.join(" + ") : "请选择";
      const customVals = selectedVals.filter((v) => !options.includes(v));
      const inputId = `ms-input-${rowId}-${key}`;
      const addCustomValue = () => {
        const input = document.getElementById(inputId);
        if (!input) return;
        const v = input.value.trim();
        if (!v) return;
        if (!selectedVals.includes(v)) {
          onUpdate(rowId, key, [...selectedVals, v].join("+"));
        }
        input.value = "";
      };
      return (
        <details className="group relative min-w-44">
          <summary className={`flex h-8 cursor-pointer list-none items-center justify-between rounded-md border px-2 text-sm transition [&::-webkit-details-marker]:hidden ${duplicate ? "border-amber-300 bg-amber-100/80 font-semibold text-amber-900" : "border-input bg-background hover:border-ring"}`}>
            <span className={selectedVals.length > 0 ? "" : "text-muted-foreground"}>{displayText}</span>
            <svg className="h-3.5 w-3.5 shrink-0 opacity-50 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div className="absolute z-20 mt-0.5 min-w-full rounded-md border border-input bg-background py-1 shadow-md">
            {options.map((opt) => (
              <label key={opt} className="flex cursor-pointer items-center gap-2 px-2 py-1 text-sm hover:bg-muted">
                <input type="checkbox" checked={selectedVals.includes(opt)} onChange={() => toggle(opt)} className="rounded" />
                {opt}
              </label>
            ))}
            {customVals.map((opt) => (
              <div key={opt} className="flex items-center justify-between gap-1 px-2 py-1 text-sm">
                <span className="flex items-center gap-1.5">
                  <input type="checkbox" checked readOnly className="rounded" />
                  <span className="text-blue-700">{opt}</span>
                  <span className="text-xs text-muted-foreground">(自定义)</span>
                </span>
                <button type="button" onClick={() => removeCustom(opt)} className="text-xs text-red-500 hover:text-red-700">✕</button>
              </div>
            ))}
            {options.length === 0 && customVals.length === 0 && (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">暂无预设选项</p>
            )}
            <div className="mt-1 border-t px-2 pt-1.5 pb-1">
              <div className="flex gap-1">
                <input
                  id={inputId}
                  type="text"
                  placeholder="手动输入值后回车"
                  className="h-6 flex-1 rounded border border-input bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomValue(); } }}
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); addCustomValue(); }}
                  className="h-6 rounded bg-primary px-1.5 text-xs text-primary-foreground hover:bg-primary/90"
                >
                  添加
                </button>
              </div>
            </div>
          </div>
        </details>
      );
    }

    if (normalizedType === "select" || (options.length > 0 && normalizedType !== "multiselect")) {
      return (
        <select
          className={`h-8 min-w-40 rounded-md border bg-background px-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${duplicate ? dupClass : "border-input"}`}
          value={String(value)}
          onChange={(e) => onUpdate(rowId, key, e.target.value)}
        >
          <option value="">请选择</option>
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      );
    }
    if (normalizedType === "checkbox") {
      return (
        <label className={`flex h-8 min-w-36 items-center gap-2 rounded-md border px-2 text-sm ${duplicate ? dupClass : "border-input bg-background"}`}>
          <input
            type="checkbox"
            checked={Boolean(value === true || value === "true" || value === "1" || value === "是")}
            onChange={(e) => onUpdate(rowId, key, e.target.checked)}
          />
          {field.placeholder || field.help || "是"}
        </label>
      );
    }
    if (normalizedType === "textarea") {
      return (
        <Textarea
          className={`min-h-8 min-w-52 py-1 text-sm ${duplicate ? dupClass : "border-transparent bg-transparent shadow-none hover:border-input hover:bg-background focus-visible:bg-background"}`}
          value={String(value)}
          onChange={(e) => onUpdate(rowId, key, e.target.value)}
          placeholder={field.placeholder || getFieldLabel(key)}
        />
      );
    }
    return (
      <Input
        className={`h-8 min-w-40 px-2 shadow-none hover:border-input hover:bg-background focus-visible:bg-background ${duplicate ? dupClass : "border-transparent bg-transparent"}`}
        type={normalizedType || "text"}
        value={String(value)}
        onChange={(e) => onUpdate(rowId, key, e.target.value)}
        placeholder={field.placeholder || getFieldLabel(key)}
      />
    );
  }

  function getSubmissionFieldLabel(submission, key) {
    const tmpl = templateItems.find((t) => t.slug === submission.template_slug);
    return tmpl?.fields?.find((f) => f.key === key)?.label || getFieldLabel(key);
  }

  const currentTemplate = useMemo(
    () => templateItems.find((t) => t.slug === templateSlug) || templateItems[0] || null,
    [templateSlug, templateItems]
  );

  const currentTemplateFieldKeys = useMemo(
    () => (currentTemplate?.fields || []).map((f) => f.key).filter(Boolean),
    [currentTemplate]
  );

  const allDataKeys = useMemo(() => {
    const keys = getAllDataKeys(rows.filter((s) => !templateSlug || s.template_slug === templateSlug));
    return Array.from(new Set([...currentTemplateFieldKeys, ...keys]));
  }, [currentTemplateFieldKeys, rows, templateSlug]);

  const tableFieldKeys = useMemo(
    () => (visibleFieldKeys.length > 0 ? visibleFieldKeys : currentTemplateFieldKeys),
    [currentTemplateFieldKeys, visibleFieldKeys]
  );

  const duplicateCheckKeys = useMemo(
    () => new Set((currentTemplate?.fields || []).filter((f) => f.duplicateCheck).map((f) => f.key).filter(Boolean)),
    [currentTemplate]
  );

  function getEditableRowData(submission) {
    return { ...(submission.data || {}), ...(draftRows[submission.id] || {}) };
  }

  const duplicateValueMap = useMemo(() => {
    const valueMap = new Map();
    for (const s of rows) {
      const data = getEditableRowData(s);
      for (const key of tableFieldKeys) {
        if (!duplicateCheckKeys.has(key)) continue;
        const value = normalizeDuplicateValue(data?.[key]);
        if (!value) continue;
        const mk = `${key}:${value}`;
        if (!valueMap.has(mk)) valueMap.set(mk, []);
        valueMap.get(mk).push(s.id);
      }
    }
    for (const row of newRows) {
      for (const key of tableFieldKeys) {
        if (!duplicateCheckKeys.has(key)) continue;
        const value = normalizeDuplicateValue(row.data?.[key]);
        if (!value) continue;
        const mk = `${key}:${value}`;
        if (!valueMap.has(mk)) valueMap.set(mk, []);
        valueMap.get(mk).push(row.id);
      }
    }
    const dup = new Map();
    for (const [key, ids] of valueMap.entries()) { if (ids.length > 1) dup.set(key, new Set(ids)); }
    return dup;
  }, [draftRows, duplicateCheckKeys, rows, newRows, tableFieldKeys]);

  function hasDuplicateExistingCell(submission, key) {
    if (!duplicateCheckKeys.has(key)) return false;
    const value = normalizeDuplicateValue(getEditableRowData(submission)?.[key]);
    if (!value) return false;
    return Boolean(duplicateValueMap.get(`${key}:${value}`)?.has(submission.id));
  }

  function findDuplicateForValue(key, value, excludeId = null) {
    if (!duplicateCheckKeys.has(key)) return null;
    const normalized = normalizeDuplicateValue(value);
    if (!normalized) return null;
    return (
      rows.find((s) => s.id !== excludeId && normalizeDuplicateValue(getEditableRowData(s)?.[key]) === normalized) ||
      newRows.find((r) => r.id !== excludeId && normalizeDuplicateValue(r.data?.[key]) === normalized) ||
      null
    );
  }

  function hasAnyDuplicateExistingCell(submission) {
    return tableFieldKeys.some((key) => hasDuplicateExistingCell(submission, key));
  }

  function findFirstDuplicateInData(data, excludeId = null) {
    for (const key of tableFieldKeys) {
      if (!duplicateCheckKeys.has(key)) continue;
      const dup = findDuplicateForValue(key, data?.[key], excludeId);
      if (dup) return { key, submission: dup };
    }
    return null;
  }

  async function loadDetail(submission) {
    const res = await fetch(`/api/submissions/${submission.id}`);
    const json = await res.json();
    if (!res.ok) { notify(json.error || "详情加载失败", "error"); return; }
    setSelected(json);
    setPatchMessage("");
    setModalPosition({ x: 0, y: 0 });
  }

  function requestDeleteSubmission(submission) {
    setConfirmAction({
      type: "delete",
      title: "确认删除提交记录",
      description: `确定删除提交记录「${submission.id}」吗？相关 Webhook 日志也会一起删除。`,
      confirmText: "确认删除",
      destructive: true,
      onConfirm: () => deleteSubmissionItem(submission)
    });
  }

  async function deleteSubmissionItem(submission) {
    setConfirmAction(null);
    const res = await fetch(`/api/submissions/${submission.id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) { notify(json.error || "删除失败", "error"); return; }
    setRows((current) => current.filter((item) => item.id !== submission.id));
    setTotal((t) => t - 1);
    notify("提交记录已删除", "success");
    if (selected?.submission?.id === submission.id) setSelected(null);
  }

  function resetFilters() {
    const slug = templateItems[0]?.slug || "";
    setTemplateSlug(slug);
    setStatus("");
    setSource("");
    setKeyword("");
    setDateFrom("");
    setDateTo("");
    fetchPage(1, { templateSlug: slug, keyword: "", status: "", source: "", dateFrom: "", dateTo: "" });
    notify("筛选条件已重置", "info");
  }

  function toggleVisibleField(key) {
    setVisibleFieldKeys((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key]
    );
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function formatExportCellValue(value) {
    if (value === undefined || value === null) return "";
    if (Array.isArray(value)) return value.join("、");
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }

  function buildExcelHtml(allRows, count) {
    const templateName = currentTemplate?.name || "提交结果";
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

  function downloadExcel(html, templateName, timestamp) {
    const blob = new Blob(["﻿" + html], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${String(templateName).replace(/[\\/:*?"<>|]/g, "-").slice(0, 80)}-查询结果-${timestamp}.xls`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  const [exporting, setExporting] = useState(false);

  async function exportAllResults() {
    if (tableFieldKeys.length === 0) return;
    setExporting(true);
    notify("正在获取全部数据，请稍候...", "info");
    try {
      const params = new URLSearchParams();
      if (templateSlug) params.set("template", templateSlug);
      if (keyword) params.set("search", keyword);
      if (status) params.set("status", status);
      if (source) params.set("source", source);
      if (dateFrom) params.set("startDate", dateFrom);
      if (dateTo) params.set("endDate", dateTo);
      params.set("limit", "999999");
      const res = await fetch("/api/submissions?" + params.toString());
      const data = await res.json();
      const allRows = data.submissions || [];
      const { html, templateName, timestamp } = buildExcelHtml(allRows, allRows.length);
      downloadExcel(html, templateName, timestamp);
      notify(`已导出全部 ${allRows.length} 条结果`, "success");
    } catch (error) {
      notify("导出失败：" + error.message, "error");
    } finally {
      setExporting(false);
    }
  }

  async function addCustomColumn() {
    const label = newColumnName.trim();
    if (!label) { notify("请输入新增列名称", "warning"); return; }
    if (!templateSlug) { notify("请先选择模板", "warning"); return; }
    const res = await fetch("/api/submissions/fields", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ template_slug: templateSlug, label })
    });
    const json = await res.json();
    if (!res.ok) { notify(json.error || "新增列失败", "error"); return; }
    setTemplateItems((current) => current.map((t) => (t.slug === templateSlug ? json.template : t)));
    setRows((current) => {
      const nextRows = new Map((json.submissions || []).map((s) => [s.id, s]));
      return current.map((s) => nextRows.get(s.id) || s);
    });
    setVisibleFieldKeys((current) => Array.from(new Set([...current, ...currentTemplateFieldKeys, json.field.key])));
    setNewColumnName("");
    notify(`已新增列「${json.field.label || label}」`, "success");
  }

  function startDrag(event) {
    if (event.button !== 0) return;
    dragStateRef.current = { startX: event.clientX, startY: event.clientY, originX: modalPosition.x, originY: modalPosition.y };
    function onMouseMove(e) {
      if (!dragStateRef.current) return;
      setModalPosition({
        x: dragStateRef.current.originX + e.clientX - dragStateRef.current.startX,
        y: dragStateRef.current.originY + e.clientY - dragStateRef.current.startY
      });
    }
    function onMouseUp() {
      dragStateRef.current = null;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  function getSubmissionTemplate(submission) {
    return templateItems.find((t) => t.slug === submission.template_slug);
  }

  function hasWebhookConfig(submission) {
    const tmpl = getSubmissionTemplate(submission);
    return Array.isArray(tmpl?.webhook_urls) && tmpl.webhook_urls.filter(Boolean).length > 0;
  }

  function getEffectivePushStatus(submission) {
    if (pushingIds.includes(submission.id) || submission.push_status === "pushing") return "pushing";
    if (!hasWebhookConfig(submission)) return "not_configured";
    return submission.push_status || "pending";
  }

  function getPushStatusText(submission) {
    const s = getEffectivePushStatus(submission);
    if (s === "pushing") return "推送中";
    if (s === "success") return "已推送";
    if (s === "failed") return "推送失败";
    if (s === "not_configured") return "未配置";
    return "待推送";
  }

  function getPushStatusClass(submission) {
    const s = getEffectivePushStatus(submission);
    if (s === "pushing") return "border-blue-200 bg-blue-50 text-blue-700";
    if (s === "success") return "border-emerald-200 bg-emerald-50 text-emerald-700";
    if (s === "failed") return "border-red-200 bg-red-50 text-red-700";
    if (s === "not_configured") return "border-amber-200 bg-amber-50 text-amber-700";
    return "border-slate-200 bg-slate-50 text-slate-600";
  }

  function toggleCheckedId(id) {
    setCheckedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function canPushSubmission(submission) {
    return !pushingIds.includes(submission.id) && getEffectivePushStatus(submission) !== "pushing";
  }

  function getPushButtonText(submission) {
    const s = getEffectivePushStatus(submission);
    if (s === "pushing") return "推送中";
    if (s === "success") return "再次推送";
    if (s === "failed" || s === "not_configured") return "重新推送";
    return "推送";
  }

  function requestPushSubmissions(ids) {
    const rowMap = new Map(rows.map((s) => [s.id, s]));
    const targetIds = Array.from(new Set(
      ids.filter(Boolean).filter((id) => { const s = rowMap.get(id); return s && !pushingIds.includes(s.id); })
    ));
    if (targetIds.length === 0) { notify("请选择需要推送的记录，正在推送中的记录不能重复提交", "warning"); return; }
    setConfirmAction({
      type: "push",
      title: targetIds.length > 1 ? "确认批量推送" : "确认推送",
      description: `确定推送 ${targetIds.length} 条记录吗？已推送成功的记录也会再次发送 Webhook。`,
      confirmText: targetIds.length > 1 ? "确认批量推送" : "确认推送",
      destructive: false,
      onConfirm: () => pushSubmissions(targetIds)
    });
  }

  async function pushSubmissions(ids) {
    const rowMap = new Map(rows.map((s) => [s.id, s]));
    const targetIds = Array.from(new Set(
      ids.filter(Boolean).filter((id) => { const s = rowMap.get(id); return s && !pushingIds.includes(s.id); })
    ));
    if (targetIds.length === 0) { setConfirmAction(null); notify("请选择需要推送的记录", "warning"); return; }
    setConfirmAction(null);
    setPushingIds((current) => Array.from(new Set([...current, ...targetIds])));
    setRows((current) => current.map((s) => targetIds.includes(s.id) ? { ...s, push_status: "pushing" } : s));
    try {
      const res = await fetch("/api/submissions/push", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: targetIds })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "推送失败");
      const resultMap = new Map((json.results || []).filter((item) => item.submission).map((item) => [item.id, item.submission]));
      const failed = (json.results || []).filter((item) => !item.ok);
      setRows((current) => current.map((s) => resultMap.get(s.id) || s));
      if (selected?.submission && resultMap.has(selected.submission.id)) {
        setSelected({ ...selected, submission: resultMap.get(selected.submission.id) });
      }
      if (failed.length > 0) notify(`已完成推送，${failed.length} 条失败`, "warning");
      else notify(`已成功推送 ${targetIds.length} 条记录`, "success");
    } catch (error) {
      setRows((current) => current.map((s) => targetIds.includes(s.id) ? { ...s, push_status: "failed" } : s));
      notify(error.message, "error");
    } finally {
      setPushingIds((current) => current.filter((id) => !targetIds.includes(id)));
    }
  }

  function updateExistingCell(submission, key, value) {
    setDraftRows((current) => ({
      ...current,
      [submission.id]: { ...(current[submission.id] || {}), [key]: value }
    }));
  }

  function hasDraftChanges(submission) {
    return Boolean(draftRows[submission.id] && Object.keys(draftRows[submission.id]).length > 0);
  }

  function addBlankRow() {
    if (!templateSlug) { notify("请先选择模板", "warning"); return; }
    const data = Object.fromEntries(tableFieldKeys.map((key) => [key, ""]));
    setNewRows((current) => [
      ...current,
      { id: `new_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`, template_slug: templateSlug, data }
    ]);
    notify("已新增一行，请填写后点击右侧“保存”", "info");
  }

  function updateNewCell(rowId, key, value) {
    setNewRows((current) =>
      current.map((row) => row.id === rowId ? { ...row, data: { ...(row.data || {}), [key]: value } } : row)
    );
  }

  async function saveNewRow(row) {
    const res = await fetch("/api/submissions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ template_slug: templateSlug, source: "admin", data: row.data || {} })
    });
    const json = await res.json();
    if (!res.ok) { notify(JSON.stringify(json.fields || json.error || json), "error"); return; }
    setRows((current) => [json.submission, ...current]);
    setTotal((t) => t + 1);
    setNewRows((current) => current.filter((item) => item.id !== row.id));
    notify("新增记录已保存", "success");
  }

  async function saveExistingRow(submission) {
    try {
      await saveSubmissionPatch(submission, getEditableRowData(submission), submission.status);
      setDraftRows((current) => { const next = { ...current }; delete next[submission.id]; return next; });
      notify("修改内容已保存", "success");
    } catch (error) {
      notify(error.message, "error");
    }
  }

  async function saveSubmissionPatch(submission, data, status = submission.status) {
    const res = await fetch(`/api/submissions/${submission.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ data, status })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "保存失败");
    setRows((current) => current.map((item) => item.id === json.submission.id ? json.submission : item));
    if (selected?.submission?.id === json.submission.id) {
      setSelected({ ...selected, submission: json.submission });
    }
    return json.submission;
  }

  async function patchSelectedSubmission() {
    if (!selected?.submission) return;
    setPatchMessage("");
    let patch;
    try { patch = JSON.parse(patchJson || "{}"); } catch (error) {
      setPatchMessage(`JSON 格式错误：${error.message}`);
      notify(`JSON 格式错误：${error.message}`, "error");
      return;
    }
    const res = await fetch(`/api/submissions/${selected.submission.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ patch, merge: true })
    });
    const json = await res.json();
    if (!res.ok) { setPatchMessage(json.error || "修改失败"); notify(json.error || "修改失败", "error"); return; }
    setRows((current) => current.map((s) => s.id === json.submission.id ? json.submission : s));
    setSelected({ ...selected, submission: json.submission });
    setPatchMessage("字段已写入。新增字段只保存在提交数据中，不会显示到公开模板表单。");
    notify("字段已合并写入", "success");
  }

  // ── ERP 弹窗逻辑 ──────────────────────────────────────────

  async function markErpNoAnomaly(submission, cancel = false) {
    try {
      const res = await fetch("/api/erp/order", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ submissionId: submission.id, override: cancel ? null : "no_anomaly" }),
      });
      const json = await res.json();
      if (json.ok) {
        setRows((current) => current.map((s) => s.id === submission.id ? json.submission : s));
        notify(cancel ? "已取消无异常标记" : "已标记为无异常", "success");
      } else {
        notify(json.error || "操作失败", "error");
      }
    } catch (err) {
      notify(err.message, "error");
    }
  }

  async function openErpDetail(submission) {
    // 已有数据库里的数据直接展示，但用当前 AZSL 字段重新计算 submittedQty 和 anomaly
    if (submission.erp_order_data) {
      const qtyKeys = ["AZSL", "qty", "quantity", "count", "num", "数量", "安装数量", "台数", "安装台数"];
      let currentQty = 0;
      for (const key of qtyKeys) {
        const v = submission.data?.[key];
        if (v !== undefined && v !== "") { currentQty = Number(v) || 0; break; }
      }
      const cached = submission.erp_order_data;
      const erpQty = cached._analysis?.erpQty ?? 0;
      const fixedOrder = {
        ...cached,
        _analysis: cached._analysis ? {
          ...cached._analysis,
          submittedQty: currentQty,
          match: erpQty === currentQty,
          anomaly: erpQty !== currentQty,
        } : cached._analysis,
      };
      setErpModal({ submission, loading: false, order: fixedOrder, error: null });
      return;
    }
    setErpModal({ submission, loading: true, order: null, error: null });
    try {
      const res = await fetch("/api/erp/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ submissionId: submission.id }),
      });
      const json = await res.json();
      if (json.ok && json.order) {
        setRows((current) => current.map((s) => s.id === submission.id ? { ...s, erp_order_data: json.order } : s));
        setErpModal({ submission, loading: false, order: json.order, error: null });
      } else {
        setErpModal({ submission, loading: false, order: null, error: json.error || "未找到订单" });
      }
    } catch (err) {
      setErpModal({ submission, loading: false, order: null, error: err.message });
    }
  }

  return (
    <div className="space-y-6">
      <ToastNotice notice={notice} onClose={() => setNotice(null)} />
      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction?.title}
        description={confirmAction?.description}
        confirmText={confirmAction?.confirmText}
        destructive={confirmAction?.destructive}
        onConfirm={confirmAction?.onConfirm}
        onCancel={() => setConfirmAction(null)}
      />

      <Card>
        <CardHeader>
          <CardTitle>筛选查询</CardTitle>
          <CardDescription>支持模板、状态、来源、日期和关键词组合查询，点击&ldquo;查询&rdquo;从服务端加载数据。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label>模板</Label>
              <Select value={templateSlug} onChange={(e) => setTemplateSlug(e.target.value)}>
                {templateItems.length === 0 ? <option value="">暂无模板</option> : null}
                {templateItems.map((t) => (
                  <option key={t.id} value={t.slug}>{t.name}</option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label>状态</Label>
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">全部状态</option>
                {["new", "pending", "processing", "completed", "failed"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label>来源</Label>
              <Select value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="">全部来源</option>
                {["web", "api", "admin"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label>关键词</Label>
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="编号、姓名、电话、内容..."
                onKeyDown={(e) => e.key === "Enter" && fetchPage(1)}
              />
            </div>

            <div className="space-y-2">
              <Label>开始日期</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>结束日期</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button type="button" onClick={() => fetchPage(1)} disabled={loading}>
              {loading ? "查询中..." : "查询"}
            </Button>
            <Button type="button" variant="outline" onClick={resetFilters} disabled={loading}>重置</Button>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">每页</span>
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                value={pageSize}
                onChange={(e) => {
                  const ps = Number(e.target.value);
                  setPageSize(ps);
                  fetchPage(1, { pageSize: ps });
                }}
              >
                {[20, 50, 100, 200, 500].map((n) => (
                  <option key={n} value={n}>{n} 条</option>
                ))}
              </select>
            </div>
            <div className="text-sm text-muted-foreground">
              共 {total} 条，第 {page} / {totalPages} 页
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>提交结果表格</CardTitle>
              <CardDescription>云表格模式：可直接在单元格内修改；新增行填写后点击最右侧保存。仅模板配置中开启查重提醒的字段会进行重复值高亮。</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={addBlankRow} disabled={!templateSlug || tableFieldKeys.length === 0}>
                新增一行
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => requestPushSubmissions(checkedIds)}
                disabled={checkedIds.length === 0 || pushingIds.length > 0}
              >
                批量推送{checkedIds.length > 0 ? ` (${checkedIds.length})` : ""}
              </Button>
              <Button type="button" variant="outline" onClick={exportAllResults} disabled={total === 0 || tableFieldKeys.length === 0 || exporting}>
                {exporting ? "导出中..." : `导出全部 (${total})`}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 rounded-md border p-3">
            <div className="mb-2 text-sm font-medium">显示字段列</div>
            <div className="mb-3 flex flex-col gap-2 sm:flex-row">
              <Input
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomColumn(); } }}
                placeholder="输入新增列名称，例如：内部备注"
              />
              <Button type="button" variant="outline" onClick={addCustomColumn}>新增列</Button>
            </div>
            <div className="flex max-h-28 flex-wrap gap-2 overflow-auto">
              {allDataKeys.map((key) => (
                <label key={key} className="flex items-center gap-1 rounded-full border px-2 py-1 text-xs" title={key}>
                  <input type="checkbox" checked={tableFieldKeys.includes(key)} onChange={() => toggleVisibleField(key)} />
                  {getFieldLabel(key)}
                </label>
              ))}
              {allDataKeys.length === 0 ? <span className="text-sm text-muted-foreground">暂无字段</span> : null}
            </div>
          </div>

          <div className="overflow-auto rounded-xl border bg-background shadow-sm">
            <table className="w-full min-w-[960px] border-separate border-spacing-0 text-sm">
              <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur">
                <tr>
                  <th className="w-12 rounded-tl-xl border-b border-r px-3 py-3 text-center font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={rows.length > 0 && rows.every((s) => checkedIds.includes(s.id))}
                      onChange={(e) => setCheckedIds(e.target.checked ? rows.map((s) => s.id) : [])}
                      aria-label="选择当前页全部"
                    />
                  </th>
                  {tableFieldKeys.map((key) => (
                    <th key={key} className="whitespace-nowrap border-b border-r px-3 py-3 text-left font-semibold text-slate-700" title={key}>
                      {getFieldLabel(key)}
                    </th>
                  ))}
                  <th className="whitespace-nowrap border-b border-r px-3 py-3 text-left font-semibold text-slate-700">推送状态</th>
                  <th className="sticky right-0 rounded-tr-xl border-b bg-slate-100/95 px-3 py-3 text-left font-semibold text-slate-700 shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.55)]">操作</th>
                </tr>
              </thead>
              <tbody>
                {newRows.map((row) => {
                  const duplicate = findFirstDuplicateInData(row.data, row.id);
                  return (
                    <tr key={row.id} className={`transition-colors ${duplicate ? "bg-amber-50 hover:bg-amber-100/70" : "bg-blue-50/70 hover:bg-blue-50"}`}>
                      <td className="border-b border-r px-3 py-2 text-center align-middle">
                        <input type="checkbox" disabled aria-label="新增行保存后才可推送" />
                      </td>
                      {tableFieldKeys.map((key) => {
                        const dupSub = findDuplicateForValue(key, row.data?.[key], row.id);
                        const fieldDef = getFieldDefinition(key);
                        return (
                          <td key={key} className={`max-w-[240px] border-b border-r px-3 py-2 align-middle ${dupSub ? "border-amber-200 bg-amber-50" : ""}`}>
                            {renderAdminEditableCell({ rowId: row.id, data: row.data, key, duplicate: Boolean(dupSub), onUpdate: updateNewCell })}
                            {fieldDef.help ? <p className="mt-1 text-xs text-muted-foreground">{fieldDef.help}</p> : null}
                            {dupSub ? <p className="mt-1 text-xs font-medium text-amber-700">与记录 {dupSub.id} 重复</p> : null}
                          </td>
                        );
                      })}
                      <td className="whitespace-nowrap border-b border-r px-3 py-2 align-middle">
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600">待保存</span>
                      </td>
                      <td className="sticky right-0 whitespace-nowrap border-b bg-background px-3 py-2 align-middle shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.55)]">
                        <div className="flex gap-2">
                          <Button type="button" size="sm" onClick={() => saveNewRow(row)}>保存</Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => { setNewRows((c) => c.filter((r) => r.id !== row.id)); notify("已取消新增行", "info"); }}>取消</Button>
                        </div>
                        {duplicate ? <p className="mt-2 text-xs font-medium text-amber-700">字段「{getFieldLabel(duplicate.key)}」与记录 {duplicate.submission.id} 重复</p> : null}
                      </td>
                    </tr>
                  );
                })}

                {rows.map((submission) => {
                  const editableData = getEditableRowData(submission);
                  const duplicate = hasAnyDuplicateExistingCell(submission);
                  const erpData = submission.erp_order_data;
                  const erpAnomaly = erpData?._analysis?.anomaly === true && submission.erp_anomaly_override !== "no_anomaly";
                  return (
                    <tr
                      key={submission.id}
                      className={`transition-colors ${erpAnomaly ? "bg-red-50 hover:bg-red-100/70" : duplicate ? "bg-amber-50 hover:bg-amber-100/70" : "odd:bg-white even:bg-slate-50/70 hover:bg-blue-50/70"}`}
                    >
                      <td className="border-b border-r px-3 py-2 text-center align-middle">
                        <input
                          type="checkbox"
                          checked={checkedIds.includes(submission.id)}
                          onChange={() => toggleCheckedId(submission.id)}
                          aria-label={`选择记录 ${submission.id}`}
                        />
                      </td>
                      {tableFieldKeys.map((key) => {
                        const dupCell = hasDuplicateExistingCell(submission, key);
                        const fieldDef = getFieldDefinition(key);
                        return (
                          <td key={key} className={`max-w-[240px] border-b border-r px-3 py-2 align-middle ${dupCell ? "border-amber-200 bg-amber-50" : ""}`}>
                            {renderAdminEditableCell({ rowId: submission, data: editableData, key, duplicate: dupCell, onUpdate: updateExistingCell })}
                            {fieldDef.help ? <p className="mt-1 text-xs text-muted-foreground">{fieldDef.help}</p> : null}
                            {dupCell ? <p className="mt-1 text-xs font-medium text-amber-700">重复值</p> : null}
                          </td>
                        );
                      })}
                      <td className={`whitespace-nowrap border-b border-r px-3 py-2 align-middle ${duplicate ? "bg-amber-50" : ""}`}>
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex w-fit rounded-full border px-2 py-1 text-xs font-medium ${getPushStatusClass(submission)}`}>
                            {getPushStatusText(submission)}
                          </span>
                          {submission.pushed_at ? <span className="text-xs text-muted-foreground">{formatDate(submission.pushed_at)}</span> : null}
                        </div>
                      </td>
                      <td
                        className={`sticky right-0 border-b px-2 py-2 align-middle shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.55)] ${erpAnomaly ? "bg-red-50" : duplicate ? "bg-amber-50" : "bg-background"}`}
                        onDoubleClick={() => loadDetail(submission)}
                        title="双击全屏查看详情"
                      >
                        <div className="flex flex-col gap-1">
                          <div className="flex gap-1">
                            <Button type="button" size="sm" onClick={() => saveExistingRow(submission)} disabled={!hasDraftChanges(submission)}>保存</Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => requestPushSubmissions([submission.id])} disabled={!canPushSubmission(submission)}>{getPushButtonText(submission)}</Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => openErpDetail(submission)}>快麦</Button>
                            <Button type="button" size="sm" variant="destructive" onClick={() => requestDeleteSubmission(submission)}>删除</Button>
                          </div>
                          <div className="flex gap-1">
                            {erpAnomaly && (
                              <Button type="button" size="sm" variant="outline" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50" onClick={() => markErpNoAnomaly(submission)}>标记无异常</Button>
                            )}
                            {submission.erp_anomaly_override === "no_anomaly" && (
                              <Button type="button" size="sm" variant="outline" className="border-slate-300 text-slate-500 hover:bg-slate-50" onClick={() => markErpNoAnomaly(submission, true)}>取消标记</Button>
                            )}
                          </div>
                        </div>
                        {duplicate ? <p className="mt-1 text-xs font-semibold text-amber-700">疑似重复</p> : null}
                      </td>
                    </tr>
                  );
                })}

                {rows.length === 0 && newRows.length === 0 ? (
                  <tr>
                    <td colSpan={3 + tableFieldKeys.length} className="px-3 py-10 text-center text-muted-foreground">
                      {loading ? "加载中..." : "暂无数据，请设置筛选条件后点击“查询”"}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">共 {total} 条，第 {page} / {totalPages} 页</span>
              <div className="flex gap-1">
                <Button type="button" variant="outline" size="sm" onClick={() => fetchPage(1)} disabled={page === 1 || loading}>首页</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => fetchPage(page - 1)} disabled={page === 1 || loading}>上一页</Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                  .reduce((acc, p, idx, arr) => {
                    if (idx > 0 && p - arr[idx - 1] > 1) acc.push("...");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, idx) =>
                    p === "..." ? (
                      <span key={`e${idx}`} className="flex h-8 items-center px-2 text-sm text-muted-foreground">...</span>
                    ) : (
                      <Button key={p} type="button" variant={p === page ? "default" : "outline"} size="sm" className="min-w-[32px]" onClick={() => fetchPage(p)} disabled={loading}>
                        {p}
                      </Button>
                    )
                  )}
                <Button type="button" variant="outline" size="sm" onClick={() => fetchPage(page + 1)} disabled={page === totalPages || loading}>下一页</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => fetchPage(totalPages)} disabled={page === totalPages || loading}>末页</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selected?.submission ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-transparent p-3 sm:p-4" role="dialog" aria-modal="true">
          <button type="button" aria-label="关闭详情" className="absolute inset-0 cursor-default" onClick={() => setSelected(null)} />
          <div
            className="relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl sm:max-w-5xl"
            style={{ transform: `translate(${modalPosition.x}px, ${modalPosition.y}px)` }}
          >
            <div className="flex cursor-move select-none flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between" onMouseDown={startDrag}>
              <div>
                <h3 className="text-lg font-semibold">提交详情</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selected.submission.id} · {formatDate(selected.submission.created_at)} · {selected.submission.source || "web"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="destructive" size="sm" onClick={() => requestDeleteSubmission(selected.submission)}>删除</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setSelected(null)}>关闭</Button>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 gap-4 overflow-auto p-4 lg:grid-cols-[1fr_380px]">
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">字段数据</CardTitle>
                    <CardDescription>只读查看提交字段内容；如需修改，请在结果表格中双击对应单元格编辑。</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid gap-2 text-sm sm:grid-cols-2">
                        <div className="rounded-md border p-3">
                          <div className="font-medium text-muted-foreground">状态</div>
                          <div className="mt-1">{selected.submission.status || "-"}</div>
                        </div>
                        <div className="rounded-md border p-3">
                          <div className="font-medium text-muted-foreground">模板</div>
                          <div className="mt-1">/{selected.submission.template_slug}</div>
                        </div>
                        <div className="rounded-md border p-3">
                          <div className="font-medium text-muted-foreground">推送状态</div>
                          <div className="mt-1">
                            <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${getPushStatusClass(selected.submission)}`}>
                              {getPushStatusText(selected.submission)}
                            </span>
                          </div>
                        </div>
                        <div className="rounded-md border p-3">
                          <div className="font-medium text-muted-foreground">推送时间</div>
                          <div className="mt-1">{selected.submission.pushed_at ? formatDate(selected.submission.pushed_at) : "-"}</div>
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {Array.from(new Set([
                          ...((templateItems.find((t) => t.slug === selected.submission.template_slug)?.fields || []).map((f) => f.key)),
                          ...Object.keys(selected.submission.data || {})
                        ].filter(Boolean))).map((key) => (
                          <div key={key} className="rounded-md border p-3 text-sm">
                            <div className="font-medium text-muted-foreground" title={key}>{getSubmissionFieldLabel(selected.submission, key)}</div>
                            <div className="mt-1 break-all">
                              {selected.submission.data?.[key] === undefined || selected.submission.data?.[key] === null || selected.submission.data?.[key] === ""
                                ? "-"
                                : String(selected.submission.data[key])}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Webhook 日志</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {(selected.webhookLogs || []).map((log) => (
                        <div key={log.id} className="overflow-hidden rounded-md border p-3 text-sm">
                          <div className="flex items-start justify-between gap-2">
                            <span className="min-w-0 break-all font-mono text-xs leading-5">{log.url}</span>
                            <Badge className="shrink-0" variant={log.ok ? "secondary" : "outline"}>{log.ok ? "成功" : "失败"}</Badge>
                          </div>
                          <div className="mt-1.5 text-xs text-muted-foreground">HTTP {log.status_code} · {formatDate(log.created_at)}</div>
                          {log.last_response ? (
                            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 text-xs">
                              {JSON.stringify(log.last_response, null, 2)}
                            </pre>
                          ) : null}
                        </div>
                      ))}
                      {(selected.webhookLogs || []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">暂无 Webhook 日志</p>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">额外字段写入</CardTitle>
                    <CardDescription>如需通过 API 方式补充内部备注等额外字段，可在此合并写入 data。</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Textarea className="min-h-40 font-mono text-xs" value={patchJson} onChange={(e) => setPatchJson(e.target.value)} />
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Button type="button" size="sm" onClick={patchSelectedSubmission}>合并写入字段</Button>
                      {patchMessage ? <span className="text-xs text-muted-foreground">{patchMessage}</span> : null}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">原始 JSON</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs">
                      {JSON.stringify(selected.submission, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {erpModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true">
          <button type="button" className="absolute inset-0 cursor-default" onClick={() => setErpModal(null)} aria-label="关闭" />
          <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl">
            <div className={`flex items-center justify-between border-b px-4 py-3 ${erpModal.order?._analysis?.anomaly ? "bg-red-50" : "bg-slate-50"}`}>
              <h3 className={`font-semibold ${erpModal.order?._analysis?.anomaly ? "text-red-700" : "text-slate-700"}`}>
                {erpModal.order?._analysis?.anomaly ? "⚠ 快麦订单详情（数量异常）" : "快麦订单详情"}
              </h3>
              <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setErpModal(null)}>关闭</button>
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
      ) : null}
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
