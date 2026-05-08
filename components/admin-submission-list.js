"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ConfirmDialog from "@/components/confirm-dialog";
import ToastNotice from "@/components/toast-notice";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Select, Textarea } from "@/components/ui";

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function getAllDataKeys(submissions) {
  const keys = new Set();
  submissions.forEach((submission) => {
    Object.keys(submission.data || {}).forEach((key) => keys.add(key));
  });
  return Array.from(keys);
}

function buildFieldLabelMap(templates) {
  const labelMap = new Map();

  templates.forEach((template) => {
    (template.fields || []).forEach((field) => {
      if (field.key && field.label && !labelMap.has(field.key)) {
        labelMap.set(field.key, field.label);
      }
    });
  });

  return labelMap;
}

function normalizeDuplicateValue(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "object") return JSON.stringify(value).trim().toLowerCase();
  return String(value).trim().toLowerCase();
}

export default function AdminSubmissionList({ submissions, templates }) {
  const [rows, setRows] = useState(submissions);
  const [templateItems, setTemplateItems] = useState(templates);
  const [templateSlug, setTemplateSlug] = useState(templates[0]?.slug || "");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [keyword, setKeyword] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [fieldKey, setFieldKey] = useState("");
  const [fieldValue, setFieldValue] = useState("");
  const [visibleFieldKeys, setVisibleFieldKeys] = useState([]);
  const [newColumnName, setNewColumnName] = useState("");
  const [selected, setSelected] = useState(null);
  const [patchJson, setPatchJson] = useState("{\n  \"internal_note\": \"\"\n}");
  const [patchMessage, setPatchMessage] = useState("");
  const [notice, setNotice] = useState(null);
  const [editData, setEditData] = useState({});
  const [editStatus, setEditStatus] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [draftRows, setDraftRows] = useState({});
  const [newRows, setNewRows] = useState([]);
  const [checkedIds, setCheckedIds] = useState([]);
  const [pushingIds, setPushingIds] = useState([]);
  const [confirmAction, setConfirmAction] = useState(null);
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });
  const dragStateRef = useRef(null);

  useEffect(() => {
    setRows(submissions);
  }, [submissions]);

  useEffect(() => {
    setTemplateItems(templates);
  }, [templates]);

  useEffect(() => {
    if (!selected) return;

    function onKeyDown(event) {
      if (event.key === "Escape") {
        setSelected(null);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [selected]);

  const statuses = useMemo(() => {
    return Array.from(new Set(rows.map((submission) => submission.status).filter(Boolean)));
  }, [rows]);

  const sources = useMemo(() => {
    return Array.from(new Set(rows.map((submission) => submission.source).filter(Boolean)));
  }, [rows]);

  const fieldLabelMap = useMemo(() => buildFieldLabelMap(templateItems), [templateItems]);

  function notify(text, type = "info", title) {
    setNotice({
      text,
      type,
      title: title || (type === "success" ? "操作成功" : type === "error" ? "操作失败" : type === "warning" ? "请注意" : "操作提示")
    });
  }

  function getFieldLabel(key) {
    return fieldLabelMap.get(key) || key;
  }

  function getFieldDefinition(key) {
    return (currentTemplate?.fields || []).find((field) => field.key === key) || { key, label: getFieldLabel(key), type: "text" };
  }

  function getAdminCellValue(data, key) {
    const value = data?.[key];
    if (value === undefined || value === null) return "";
    return value;
  }

  function renderAdminEditableCell({ rowId, data, key, duplicate = false, onUpdate }) {
    const field = getFieldDefinition(key);
    const normalizedType = field.type === "dropdown" || field.type === "radio" ? "select" : field.type;
    const options = Array.isArray(field.options)
      ? field.options
      : String(field.optionsText || "")
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean);
    const value = getAdminCellValue(data, key);
    const commonClass = `h-8 min-w-40 px-2 shadow-none hover:border-input hover:bg-background focus-visible:bg-background ${duplicate ? "border-amber-300 bg-amber-100/80 font-semibold text-amber-900 focus-visible:ring-amber-400" : "border-transparent bg-transparent"}`;

    if (normalizedType === "select" || options.length > 0) {
      return (
        <select
          className={`h-8 min-w-40 rounded-md border bg-background px-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${duplicate ? "border-amber-300 bg-amber-100/80 font-semibold text-amber-900 focus-visible:ring-amber-400" : "border-input"}`}
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(event) => onUpdate(rowId, key, event.target.value)}
        >
          <option value="">请选择</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }

    if (normalizedType === "checkbox") {
      return (
        <label className={`flex h-8 min-w-36 items-center gap-2 rounded-md border px-2 text-sm ${duplicate ? "border-amber-300 bg-amber-100/80 font-semibold text-amber-900" : "border-input bg-background"}`}>
          <input
            type="checkbox"
            checked={Boolean(value === true || value === "true" || value === "1" || value === "是")}
            onChange={(event) => onUpdate(rowId, key, event.target.checked)}
          />
          {field.placeholder || field.help || "是"}
        </label>
      );
    }

    if (normalizedType === "textarea") {
      return (
        <Textarea
          className={`min-h-8 min-w-52 py-1 text-sm ${duplicate ? "border-amber-300 bg-amber-100/80 font-semibold text-amber-900 focus-visible:ring-amber-400" : "border-transparent bg-transparent shadow-none hover:border-input hover:bg-background focus-visible:bg-background"}`}
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(event) => onUpdate(rowId, key, event.target.value)}
          placeholder={field.placeholder || getFieldLabel(key)}
        />
      );
    }

    return (
      <Input
        className={commonClass}
        type={normalizedType || "text"}
        value={value === undefined || value === null ? "" : String(value)}
        onChange={(event) => onUpdate(rowId, key, event.target.value)}
        placeholder={field.placeholder || getFieldLabel(key)}
      />
    );
  }

  function getSubmissionFieldLabel(submission, key) {
    const template = templateItems.find((item) => item.slug === submission.template_slug);
    const field = template?.fields?.find((item) => item.key === key);
    return field?.label || getFieldLabel(key);
  }

  const currentTemplate = useMemo(() => {
    return templateItems.find((template) => template.slug === templateSlug) || templateItems[0] || null;
  }, [templateSlug, templateItems]);

  const currentTemplateFieldKeys = useMemo(() => {
    return (currentTemplate?.fields || []).map((field) => field.key).filter(Boolean);
  }, [currentTemplate]);

  const allDataKeys = useMemo(() => {
    const keys = getAllDataKeys(rows.filter((submission) => !templateSlug || submission.template_slug === templateSlug));
    return Array.from(new Set([...currentTemplateFieldKeys, ...keys]));
  }, [currentTemplateFieldKeys, rows, templateSlug]);

  const tableFieldKeys = useMemo(() => {
    if (visibleFieldKeys.length > 0) return visibleFieldKeys;
    return currentTemplateFieldKeys;
  }, [currentTemplateFieldKeys, visibleFieldKeys]);

  useEffect(() => {
    setVisibleFieldKeys([]);
  }, [templateSlug]);

  const filtered = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    const normalizedFieldValue = fieldValue.trim().toLowerCase();
    const fromTime = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTime = dateTo ? new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 - 1 : null;

    return rows.filter((submission) => {
      if (templateSlug && submission.template_slug !== templateSlug) return false;
      if (status && submission.status !== status) return false;
      if (source && submission.source !== source) return false;

      const createdAt = new Date(submission.created_at).getTime();
      if (fromTime && createdAt < fromTime) return false;
      if (toTime && createdAt > toTime) return false;

      if (fieldKey) {
        const value = submission.data?.[fieldKey];
        if (value === undefined || value === null) return false;
        if (normalizedFieldValue && !String(value).toLowerCase().includes(normalizedFieldValue)) return false;
      }

      if (normalizedKeyword) {
        const haystack = [
          submission.id,
          submission.template_slug,
          submission.status,
          submission.source,
          submission.ip,
          submission.user_agent,
          JSON.stringify(submission.data || {})
        ]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(normalizedKeyword)) return false;
      }

      return true;
    });
  }, [dateFrom, dateTo, fieldKey, fieldValue, keyword, source, status, rows, templateSlug]);

  const duplicateValueMap = useMemo(() => {
    const valueMap = new Map();

    for (const submission of filtered) {
      const data = getEditableRowData(submission);

      for (const key of tableFieldKeys) {
        const value = normalizeDuplicateValue(data?.[key]);
        if (!value) continue;

        const mapKey = `${key}:${value}`;
        if (!valueMap.has(mapKey)) {
          valueMap.set(mapKey, []);
        }
        valueMap.get(mapKey).push(submission.id);
      }
    }

    const duplicated = new Map();
    for (const [key, ids] of valueMap.entries()) {
      if (ids.length > 1) {
        duplicated.set(key, new Set(ids));
      }
    }

    return duplicated;
  }, [draftRows, filtered, tableFieldKeys]);

  function hasDuplicateExistingCell(submission, key) {
    const value = normalizeDuplicateValue(getEditableRowData(submission)?.[key]);
    if (!value) return false;

    return Boolean(duplicateValueMap.get(`${key}:${value}`)?.has(submission.id));
  }

  function findDuplicateForValue(key, value, excludeId = null) {
    const normalized = normalizeDuplicateValue(value);
    if (!normalized) return null;

    return filtered.find((submission) => {
      if (submission.id === excludeId) return false;
      return normalizeDuplicateValue(getEditableRowData(submission)?.[key]) === normalized;
    });
  }

  function hasAnyDuplicateExistingCell(submission) {
    return tableFieldKeys.some((key) => hasDuplicateExistingCell(submission, key));
  }

  function findFirstDuplicateInData(data, excludeId = null) {
    for (const key of tableFieldKeys) {
      const duplicate = findDuplicateForValue(key, data?.[key], excludeId);
      if (duplicate) {
        return {
          key,
          submission: duplicate
        };
      }
    }

    return null;
  }

  async function loadDetail(submission) {
    const res = await fetch(`/api/submissions/${submission.id}`);
    const json = await res.json();

    if (!res.ok) {
      notify(json.error || "详情加载失败，请稍后重试", "error");
      return;
    }

    setSelected(json);
    setPatchMessage("");
    setEditMessage("");
    setEditData(json.submission?.data || {});
    setEditStatus(json.submission?.status || "");
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

    const res = await fetch(`/api/submissions/${submission.id}`, {
      method: "DELETE"
    });

    const json = await res.json();

    if (!res.ok) {
      notify(json.error || "删除失败", "error");
      return;
    }

    setRows((current) => current.filter((item) => item.id !== submission.id));
    notify("提交记录已删除", "success");

    if (selected?.submission?.id === submission.id) {
      setSelected(null);
    }
  }

  function resetFilters() {
    setTemplateSlug(templateItems[0]?.slug || "");
    setStatus("");
    setSource("");
    setKeyword("");
    setDateFrom("");
    setDateTo("");
    setFieldKey("");
    setFieldValue("");
    notify("筛选条件已重置", "info");
  }

  function toggleVisibleField(key) {
    setVisibleFieldKeys((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    );
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "\u0026amp;")
      .replace(/</g, "\u0026lt;")
      .replace(/>/g, "\u0026gt;")
      .replace(/"/g, "\u0026quot;")
      .replace(/'/g, "\u0026#39;");
  }

  function formatExportCellValue(value) {
    if (value === undefined || value === null) return "";
    if (Array.isArray(value)) return value.join("、");
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }

  function buildExportFileName(value) {
    return String(value || "提交结果")
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, "-")
      .slice(0, 80);
  }

  function buildFilterSummary() {
    const summary = [];

    if (currentTemplate?.name) summary.push(`模板：${currentTemplate.name}`);
    if (status) summary.push(`状态：${status}`);
    if (source) summary.push(`来源：${source}`);
    if (dateFrom) summary.push(`开始日期：${dateFrom}`);
    if (dateTo) summary.push(`结束日期：${dateTo}`);
    if (fieldKey) summary.push(`字段筛选：${getFieldLabel(fieldKey)}${fieldValue ? ` 包含「${fieldValue}」` : ""}`);
    if (keyword.trim()) summary.push(`关键词：${keyword.trim()}`);

    return summary.length > 0 ? summary.join("；") : "全部记录";
  }

  function exportFilteredResults() {
    const templateName = currentTemplate?.name || "提交结果";
    const exportedAt = formatDate(new Date().toISOString());
    const timestamp = exportedAt.replace(/[:\s]/g, "-");
    const headers = tableFieldKeys.map((key) => getFieldLabel(key));
    const columnCount = Math.max(headers.length, 1);
    const filterSummary = buildFilterSummary();

    const columnWidths = headers.map(() => '<col style="width: 180px" />').join("");

    const bodyRows =
      filtered.length > 0
        ? filtered
            .map(
              (submission, rowIndex) => `
                <tr>
                  ${tableFieldKeys
                    .map((key) => {
                      const value = formatExportCellValue(submission.data?.[key]);
                      return `<td class="cell ${rowIndex % 2 === 1 ? "cell-alt" : ""}">${escapeHtml(value)}</td>`;
                    })
                    .join("")}
                </tr>
              `
            )
            .join("")
        : `<tr><td class="empty" colspan="${columnCount}">暂无数据</td></tr>`;

    const html = `<!DOCTYPE html>
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="UTF-8" />
          <!--[if gte mso 9]>
          <xml>
            <x:ExcelWorkbook>
              <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                  <x:Name>${escapeHtml(templateName).slice(0, 31)}</x:Name>
                  <x:WorksheetOptions>
                    <x:DisplayGridlines/>
                    <x:FreezePanes/>
                    <x:FrozenNoSplit/>
                    <x:SplitHorizontal>3</x:SplitHorizontal>
                    <x:TopRowBottomPane>3</x:TopRowBottomPane>
                    <x:ActivePane>2</x:ActivePane>
                  </x:WorksheetOptions>
                </x:ExcelWorksheet>
              </x:ExcelWorksheets>
            </x:ExcelWorkbook>
          </xml>
          <![endif]-->
          <style>
            body {
              margin: 0;
              font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif;
              color: #0f172a;
              background: #ffffff;
            }
            table.excel-table {
              border-collapse: collapse;
              table-layout: fixed;
              width: 100%;
              font-size: 12px;
              mso-border-alt: solid #cbd5e1 .5pt;
            }
            .title {
              height: 34px;
              padding: 14px 16px;
              color: #ffffff;
              background: #1d4ed8;
              border: 1px solid #1e40af;
              font-size: 20px;
              font-weight: 700;
              text-align: center;
              vertical-align: middle;
            }
            .meta {
              height: 24px;
              padding: 8px 12px;
              color: #475569;
              background: #eff6ff;
              border: 1px solid #bfdbfe;
              font-size: 12px;
              text-align: left;
              vertical-align: middle;
            }
            th {
              height: 30px;
              padding: 8px 10px;
              color: #ffffff;
              background: #2563eb;
              border: 1px solid #93c5fd;
              font-size: 12px;
              font-weight: 700;
              text-align: center;
              vertical-align: middle;
              white-space: nowrap;
            }
            td.cell {
              min-height: 24px;
              padding: 7px 10px;
              color: #111827;
              background: #ffffff;
              border: 1px solid #dbeafe;
              text-align: left;
              vertical-align: top;
              mso-number-format: "\\@";
              word-break: break-all;
              white-space: normal;
            }
            td.cell-alt {
              background: #f8fbff;
            }
            td.empty {
              padding: 22px 10px;
              color: #64748b;
              background: #f8fafc;
              border: 1px solid #dbeafe;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <table class="excel-table">
            ${columnWidths}
            <tr>
              <td class="title" colspan="${columnCount}">${escapeHtml(templateName)} - 查询结果</td>
            </tr>
            <tr>
              <td class="meta" colspan="${columnCount}">导出时间：${escapeHtml(exportedAt)}　记录数：${filtered.length}　筛选条件：${escapeHtml(filterSummary)}</td>
            </tr>
            <tr>
              ${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}
            </tr>
            ${bodyRows}
          </table>
        </body>
      </html>
    `;

    const blob = new Blob([`\uFEFF${html}`], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${buildExportFileName(templateName)}-查询结果-${timestamp}.xls`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    notify(`已导出 ${filtered.length} 条查询结果`, "success");
  }

  async function addCustomColumn() {
    const label = newColumnName.trim();

    if (!label) {
      notify("请输入新增列名称", "warning");
      return;
    }

    if (!templateSlug) {
      notify("请先选择模板", "warning");
      return;
    }

    const res = await fetch("/api/submissions/fields", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        template_slug: templateSlug,
        label
      })
    });

    const json = await res.json();

    if (!res.ok) {
      notify(json.error || "新增列失败", "error");
      return;
    }

    setTemplateItems((current) =>
      current.map((template) => (template.slug === templateSlug ? json.template : template))
    );
    setRows((current) => {
      const nextRows = new Map((json.submissions || []).map((submission) => [submission.id, submission]));
      return current.map((submission) => nextRows.get(submission.id) || submission);
    });
    setVisibleFieldKeys((current) => Array.from(new Set([...current, ...currentTemplateFieldKeys, json.field.key])));
    setNewColumnName("");
    notify(`已新增列「${json.field.label || label}」`, "success");
  }

  function startDrag(event) {
    if (event.button !== 0) return;

    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: modalPosition.x,
      originY: modalPosition.y
    };

    function onMouseMove(moveEvent) {
      if (!dragStateRef.current) return;

      const nextX = dragStateRef.current.originX + moveEvent.clientX - dragStateRef.current.startX;
      const nextY = dragStateRef.current.originY + moveEvent.clientY - dragStateRef.current.startY;
      setModalPosition({ x: nextX, y: nextY });
    }

    function onMouseUp() {
      dragStateRef.current = null;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  function updateEditField(key, value) {
    setEditData((current) => ({
      ...current,
      [key]: value
    }));
  }

  function getEditableRowData(submission) {
    return {
      ...(submission.data || {}),
      ...(draftRows[submission.id] || {})
    };
  }

  function getSubmissionTemplate(submission) {
    return templateItems.find((template) => template.slug === submission.template_slug);
  }

  function hasWebhookConfig(submission) {
    const template = getSubmissionTemplate(submission);
    return Array.isArray(template?.webhook_urls) && template.webhook_urls.filter(Boolean).length > 0;
  }

  function getEffectivePushStatus(submission) {
    if (pushingIds.includes(submission.id) || submission.push_status === "pushing") return "pushing";
    if (!hasWebhookConfig(submission)) return "not_configured";
    return submission.push_status || "pending";
  }

  function getPushStatusText(submission) {
    const pushStatus = getEffectivePushStatus(submission);
    if (pushStatus === "pushing") return "推送中";
    if (pushStatus === "success") return "已推送";
    if (pushStatus === "failed") return "推送失败";
    if (pushStatus === "not_configured") return "未配置";
    return "待推送";
  }

  function getPushStatusClass(submission) {
    const pushStatus = getEffectivePushStatus(submission);
    if (pushStatus === "pushing") return "border-blue-200 bg-blue-50 text-blue-700";
    if (pushStatus === "success") return "border-emerald-200 bg-emerald-50 text-emerald-700";
    if (pushStatus === "failed") return "border-red-200 bg-red-50 text-red-700";
    if (pushStatus === "not_configured") return "border-amber-200 bg-amber-50 text-amber-700";
    return "border-slate-200 bg-slate-50 text-slate-600";
  }

  function toggleCheckedId(id) {
    setCheckedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleAllFiltered(checked) {
    setCheckedIds(checked ? filtered.map((submission) => submission.id) : []);
  }

  function canPushSubmission(submission) {
    return getEffectivePushStatus(submission) !== "success" && !pushingIds.includes(submission.id);
  }

  function getPushButtonText(submission) {
    const pushStatus = getEffectivePushStatus(submission);
    if (pushStatus === "pushing") return "推送中";
    if (pushStatus === "failed" || pushStatus === "not_configured") return "重新推送";
    return "推送";
  }

  function requestPushSubmissions(ids) {
    const rowMap = new Map(rows.map((submission) => [submission.id, submission]));
    const targetIds = Array.from(
      new Set(
        ids
          .filter(Boolean)
          .filter((id) => {
            const submission = rowMap.get(id);
            return submission && getEffectivePushStatus(submission) !== "success";
          })
      )
    );

    if (targetIds.length === 0) {
      notify("请选择待推送、未配置或推送失败的记录，已推送记录不会重复推送", "warning");
      return;
    }

    setConfirmAction({
      type: "push",
      title: targetIds.length > 1 ? "确认批量推送" : "确认推送",
      description: `确定推送 ${targetIds.length} 条记录吗？未配置 Webhook 地址时不会标记为已推送，配置后可重新推送。`,
      confirmText: targetIds.length > 1 ? "确认批量推送" : "确认推送",
      destructive: false,
      onConfirm: () => pushSubmissions(targetIds)
    });
  }

  async function pushSubmissions(ids) {
    const rowMap = new Map(rows.map((submission) => [submission.id, submission]));
    const targetIds = Array.from(
      new Set(
        ids
          .filter(Boolean)
          .filter((id) => {
            const submission = rowMap.get(id);
            return submission && getEffectivePushStatus(submission) !== "success";
          })
      )
    );

    if (targetIds.length === 0) {
      setConfirmAction(null);
      notify("请选择待推送、未配置或推送失败的记录，已推送记录不会重复推送", "warning");
      return;
    }

    setConfirmAction(null);

    setPushingIds((current) => Array.from(new Set([...current, ...targetIds])));

    setRows((current) =>
      current.map((submission) =>
        targetIds.includes(submission.id)
          ? {
              ...submission,
              push_status: "pushing"
            }
          : submission
      )
    );

    try {
      const res = await fetch("/api/submissions/push", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: targetIds })
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "推送失败");
      }

      const resultMap = new Map((json.results || []).filter((item) => item.submission).map((item) => [item.id, item.submission]));
      const failed = (json.results || []).filter((item) => !item.ok);

      setRows((current) =>
        current.map((submission) => resultMap.get(submission.id) || submission)
      );

      if (selected?.submission && resultMap.has(selected.submission.id)) {
        setSelected({
          ...selected,
          submission: resultMap.get(selected.submission.id)
        });
      }

      if (failed.length > 0) {
        notify(`已完成推送，${failed.length} 条失败`, "warning");
      } else {
        notify(`已成功推送 ${targetIds.length} 条记录`, "success");
      }
    } catch (error) {
      setRows((current) =>
        current.map((submission) =>
          targetIds.includes(submission.id)
            ? {
                ...submission,
                push_status: "failed"
              }
            : submission
        )
      );
      notify(error.message, "error");
    } finally {
      setPushingIds((current) => current.filter((id) => !targetIds.includes(id)));
    }
  }

  function updateExistingCell(submission, key, value) {
    setDraftRows((current) => ({
      ...current,
      [submission.id]: {
        ...(current[submission.id] || {}),
        [key]: value
      }
    }));
  }

  function hasDraftChanges(submission) {
    return Boolean(draftRows[submission.id] && Object.keys(draftRows[submission.id]).length > 0);
  }

  function addBlankRow() {
    if (!templateSlug) {
      notify("请先选择模板", "warning");
      return;
    }

    const data = Object.fromEntries(tableFieldKeys.map((key) => [key, ""]));
    setNewRows((current) => [
      ...current,
      {
        id: `new_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        template_slug: templateSlug,
        data
      }
    ]);
    notify("已新增一行，请填写后点击右侧“保存”", "info");
  }

  function updateNewCell(rowId, key, value) {
    setNewRows((current) =>
      current.map((row) =>
        row.id === rowId
          ? {
              ...row,
              data: {
                ...(row.data || {}),
                [key]: value
              }
            }
          : row
      )
    );
  }

  async function saveNewRow(row) {
    const res = await fetch("/api/submissions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        template_slug: templateSlug,
        source: "admin",
        data: row.data || {}
      })
    });

    const json = await res.json();

    if (!res.ok) {
      notify(JSON.stringify(json.fields || json.error || json), "error");
      return;
    }

    setRows((current) => [json.submission, ...current]);
    setNewRows((current) => current.filter((item) => item.id !== row.id));
    notify("新增记录已保存", "success");
  }

  async function saveExistingRow(submission) {
    try {
      await saveSubmissionPatch(submission, getEditableRowData(submission), submission.status);
      setDraftRows((current) => {
        const next = { ...current };
        delete next[submission.id];
        return next;
      });
      notify("修改内容已保存", "success");
    } catch (error) {
      notify(error.message, "error");
    }
  }

  async function saveSubmissionPatch(submission, data, status = submission.status) {
    const res = await fetch(`/api/submissions/${submission.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        data,
        status
      })
    });

    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.error || "保存失败");
    }

    setRows((current) =>
      current.map((item) =>
        item.id === json.submission.id ? json.submission : item
      )
    );

    if (selected?.submission?.id === json.submission.id) {
      setSelected({
        ...selected,
        submission: json.submission
      });
      setEditData(json.submission.data || {});
      setEditStatus(json.submission.status || "");
    }

    return json.submission;
  }

  async function saveSelectedSubmission() {
    if (!selected?.submission) return;

    setEditMessage("");

    try {
      const submission = await saveSubmissionPatch(selected.submission, editData, editStatus);
      setEditData(submission.data || {});
      setEditStatus(submission.status || "");
      setEditMessage("提交信息已保存。");
      notify("提交信息已保存", "success");
    } catch (error) {
      setEditMessage(error.message);
      notify(error.message, "error");
    }
  }

  async function patchSelectedSubmission() {
    if (!selected?.submission) return;

    setPatchMessage("");

    let patch;
    try {
      patch = JSON.parse(patchJson || "{}");
    } catch (error) {
      setPatchMessage(`JSON 格式错误：${error.message}`);
      notify(`JSON 格式错误：${error.message}`, "error");
      return;
    }

    const res = await fetch(`/api/submissions/${selected.submission.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        patch,
        merge: true
      })
    });

    const json = await res.json();

    if (!res.ok) {
      setPatchMessage(json.error || "修改失败");
      notify(json.error || "修改失败", "error");
      return;
    }

    setRows((current) =>
      current.map((submission) =>
        submission.id === json.submission.id ? json.submission : submission
      )
    );
    setSelected({
      ...selected,
      submission: json.submission
    });
    setPatchMessage("字段已写入。新增字段只保存在提交数据中，不会显示到公开模板表单。");
    notify("字段已合并写入", "success");
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
          <CardTitle>高级筛选</CardTitle>
          <CardDescription>支持模板、状态、来源、日期、字段值和关键词组合查询。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label>模板</Label>
              <Select value={templateSlug} onChange={(event) => setTemplateSlug(event.target.value)}>
                {templateItems.length === 0 ? <option value="">暂无模板</option> : null}
                {templateItems.map((template) => (
                  <option key={template.id} value={template.slug}>
                    {template.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label>状态</Label>
              <Select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">全部状态</option>
                {statuses.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label>来源</Label>
              <Select value={source} onChange={(event) => setSource(event.target.value)}>
                <option value="">全部来源</option>
                {sources.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label>关键词</Label>
              <Input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="编号、姓名、电话、内容..." />
            </div>

            <div className="space-y-2">
              <Label>开始日期</Label>
              <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>结束日期</Label>
              <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>字段筛选</Label>
              <Select value={fieldKey} onChange={(event) => setFieldKey(event.target.value)}>
                <option value="">不按字段筛选</option>
                {allDataKeys.map((key) => (
                  <option key={key} value={key}>{getFieldLabel(key)}</option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label>字段值包含</Label>
              <Input value={fieldValue} onChange={(event) => setFieldValue(event.target.value)} placeholder="字段内容关键词" disabled={!fieldKey} />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={resetFilters}>重置筛选</Button>
            <div className="text-sm text-muted-foreground">当前显示 {filtered.length} / {rows.length} 条</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>提交结果表格</CardTitle>
              <CardDescription>云表格模式：默认显示当前模板全部提交信息，可直接在单元格内修改；新增行填写后点击最右侧保存。重复字段值会以黄色高亮提醒。</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={addBlankRow} disabled={!templateSlug || tableFieldKeys.length === 0}>
                新增一行
              </Button>
              <Button type="button" variant="outline" onClick={() => requestPushSubmissions(checkedIds)} disabled={checkedIds.length === 0 || pushingIds.length > 0}>
                批量推送{checkedIds.length > 0 ? ` (${checkedIds.length})` : ""}
              </Button>
              <Button type="button" variant="outline" onClick={exportFilteredResults} disabled={filtered.length === 0 || tableFieldKeys.length === 0}>
                导出查询结果
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
                onChange={(event) => setNewColumnName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addCustomColumn();
                  }
                }}
                placeholder="输入新增列名称，例如：内部备注"
              />
              <Button type="button" variant="outline" onClick={addCustomColumn}>
                新增列
              </Button>
            </div>
            <div className="flex max-h-28 flex-wrap gap-2 overflow-auto">
              {allDataKeys.map((key) => (
                <label key={key} className="flex items-center gap-1 rounded-full border px-2 py-1 text-xs" title={key}>
                  <input
                    type="checkbox"
                    checked={tableFieldKeys.includes(key)}
                    onChange={() => toggleVisibleField(key)}
                  />
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
                      checked={filtered.length > 0 && filtered.every((submission) => checkedIds.includes(submission.id))}
                      onChange={(event) => toggleAllFiltered(event.target.checked)}
                      aria-label="选择当前筛选结果"
                    />
                  </th>
                  {tableFieldKeys.map((key) => (
                    <th
                      key={key}
                      className="whitespace-nowrap border-b border-r px-3 py-3 text-left font-semibold text-slate-700"
                      title={key}
                    >
                      {getFieldLabel(key)}
                    </th>
                  ))}
                  <th className="whitespace-nowrap border-b border-r px-3 py-3 text-left font-semibold text-slate-700">推送状态</th>
                  <th className="sticky right-0 rounded-tr-xl border-b bg-slate-100/95 px-3 py-3 text-left font-semibold text-slate-700 shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.55)]">操作</th>
                </tr>
              </thead>
              <tbody>
                {newRows.map((row) => {
                  const duplicate = findFirstDuplicateInData(row.data);

                  return (
                    <tr key={row.id} className={`transition-colors ${duplicate ? "bg-amber-50 hover:bg-amber-100/70" : "bg-blue-50/70 hover:bg-blue-50"}`}>
                      <td className="border-b border-r px-3 py-2 text-center align-middle">
                        <input type="checkbox" disabled aria-label="新增行保存后才可推送" />
                      </td>
                      {tableFieldKeys.map((key) => {
                        const duplicateSubmission = findDuplicateForValue(key, row.data?.[key]);

                        return (
                          <td key={key} className={`max-w-[240px] border-b border-r px-3 py-2 align-middle ${duplicateSubmission ? "border-amber-200 bg-amber-50" : ""}`}>
                            {renderAdminEditableCell({
                              rowId: row.id,
                              data: row.data,
                              key,
                              duplicate: Boolean(duplicateSubmission),
                              onUpdate: updateNewCell
                            })}
                            {duplicateSubmission ? <p className="mt-1 text-xs font-medium text-amber-700">与记录 {duplicateSubmission.id} 重复</p> : null}
                          </td>
                        );
                      })}
                      <td className="whitespace-nowrap border-b border-r px-3 py-2 align-middle">
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600">待保存</span>
                      </td>
                      <td className="sticky right-0 whitespace-nowrap border-b bg-background px-3 py-2 align-middle shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.55)]">
                      <div className="flex gap-2">
                        <Button type="button" size="sm" onClick={() => saveNewRow(row)}>
                          保存
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setNewRows((current) => current.filter((item) => item.id !== row.id));
                            notify("已取消新增行", "info");
                          }}
                        >
                          取消
                        </Button>
                      </div>
                      {duplicate ? <p className="mt-2 text-xs font-medium text-amber-700">字段「{getFieldLabel(duplicate.key)}」与记录 {duplicate.submission.id} 重复</p> : null}
                    </td>
                  </tr>
                  );
                })}

                {filtered.map((submission) => {
                  const editableData = getEditableRowData(submission);
                  const duplicate = hasAnyDuplicateExistingCell(submission);

                  return (
                    <tr key={submission.id} className={`transition-colors ${duplicate ? "bg-amber-50 hover:bg-amber-100/70" : "odd:bg-white even:bg-slate-50/70 hover:bg-blue-50/70"}`}>
                      <td className="border-b border-r px-3 py-2 text-center align-middle">
                        <input
                          type="checkbox"
                          checked={checkedIds.includes(submission.id)}
                          onChange={() => toggleCheckedId(submission.id)}
                          aria-label={`选择记录 ${submission.id}`}
                        />
                      </td>
                      {tableFieldKeys.map((key) => {
                        const duplicateCell = hasDuplicateExistingCell(submission, key);

                        return (
                          <td key={key} className={`max-w-[240px] border-b border-r px-3 py-2 align-middle ${duplicateCell ? "border-amber-200 bg-amber-50" : ""}`}>
                            {renderAdminEditableCell({
                              rowId: submission,
                              data: editableData,
                              key,
                              duplicate: duplicateCell,
                              onUpdate: updateExistingCell
                            })}
                            {duplicateCell ? <p className="mt-1 text-xs font-medium text-amber-700">重复值</p> : null}
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
                      <td className={`sticky right-0 whitespace-nowrap border-b px-3 py-2 align-middle shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.55)] ${duplicate ? "bg-amber-50" : "bg-background"}`}>
                        <div className="flex gap-2">
                          <Button type="button" size="sm" onClick={() => saveExistingRow(submission)} disabled={!hasDraftChanges(submission)}>
                            保存
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => requestPushSubmissions([submission.id])} disabled={!canPushSubmission(submission)}>
                            {getEffectivePushStatus(submission) === "success" ? "已推送" : getPushButtonText(submission)}
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => loadDetail(submission)}>
                            详情
                          </Button>
                          <Button type="button" size="sm" variant="destructive" onClick={() => requestDeleteSubmission(submission)}>
                            删除
                          </Button>
                        </div>
                        {duplicate ? <p className="mt-2 text-xs font-semibold text-amber-700">疑似重复</p> : null}
                      </td>
                    </tr>
                  );
                })}

                {filtered.length === 0 && newRows.length === 0 ? (
                  <tr>
                    <td colSpan={3 + tableFieldKeys.length} className="px-3 py-10 text-center text-muted-foreground">
                      当前模板暂无提交记录，点击“新增一行”开始填写
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {selected?.submission ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-transparent p-3 sm:p-4" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="关闭详情"
            className="absolute inset-0 cursor-default"
            onClick={() => setSelected(null)}
          />
          <div
            className="relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl sm:max-w-5xl"
            style={{ transform: `translate(${modalPosition.x}px, ${modalPosition.y}px)` }}
          >
            <div
              className="flex cursor-move select-none flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between"
              onMouseDown={startDrag}
            >
              <div>
                <h3 className="text-lg font-semibold">提交详情</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selected.submission.id} · {formatDate(selected.submission.created_at)} · {selected.submission.source || "web"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="destructive" size="sm" onClick={() => requestDeleteSubmission(selected.submission)}>
                  删除
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setSelected(null)}>
                  关闭
                </Button>
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
                          ...((templateItems.find((template) => template.slug === selected.submission.template_slug)?.fields || []).map((field) => field.key)),
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
                        <div key={log.id} className="rounded-md border p-3 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate">{log.url}</span>
                            <Badge variant={log.ok ? "secondary" : "outline"}>{log.ok ? "成功" : "失败"}</Badge>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            HTTP {log.status_code} · {formatDate(log.created_at)}
                          </div>
                          {log.last_response ? (
                            <pre className="mt-2 max-h-32 overflow-auto rounded bg-muted p-2 text-xs">
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
                    <CardDescription>
                      如需通过 API 方式补充内部备注等额外字段，可在此合并写入 data。
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      className="min-h-40 font-mono text-xs"
                      value={patchJson}
                      onChange={(event) => setPatchJson(event.target.value)}
                    />
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
    </div>
  );
}
