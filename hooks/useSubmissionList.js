import { useEffect, useMemo, useState } from "react";
import { buildFieldLabelMap, normalizeDuplicateValue } from "@/utils/submission-utils";

const PAGE_SIZE = 20;

/**
 * 提交记录列表数据管理 Hook
 */
export function useSubmissionList({ initialSubmissions, initialTotal, templates }) {
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
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [pushStatus, setPushStatus] = useState("");
  const [erpStatus, setErpStatus] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [dateRange, setDateRange] = useState("all");
  const [fieldFilters, setFieldFilters] = useState([]);
  const [draftRows, setDraftRows] = useState({});
  const [newRows, setNewRows] = useState([]);
  const [checkedIds, setCheckedIds] = useState([]);
  const [pushingIds, setPushingIds] = useState([]);

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
      const ps = overrides.pushStatus !== undefined ? overrides.pushStatus : pushStatus;
      const es = overrides.erpStatus !== undefined ? overrides.erpStatus : erpStatus;
      const ip = overrides.ipAddress !== undefined ? overrides.ipAddress : ipAddress;
      const ff = overrides.fieldFilters !== undefined ? overrides.fieldFilters : fieldFilters;

      if (slug) params.set("template", slug);
      if (q) params.set("search", q);
      if (st) params.set("status", st);
      if (src) params.set("source", src);
      if (df) params.set("startDate", df);
      if (dt) params.set("endDate", dt);
      if (ps) params.set("pushStatus", ps);
      if (es) params.set("erpStatus", es);
      if (ip) params.set("ip", ip);

      // 字段筛选参数
      if (ff && ff.length > 0) {
        params.set("fieldFilters", JSON.stringify(ff));
      }

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

  const fieldLabelMap = useMemo(() => buildFieldLabelMap(templateItems), [templateItems]);

  function getFieldLabel(key) { return fieldLabelMap.get(key) || key; }

  const currentTemplate = useMemo(
    () => templateItems.find((t) => t.slug === templateSlug) || templateItems[0] || null,
    [templateSlug, templateItems]
  );

  const duplicateCheckKeys = useMemo(
    () => new Set((currentTemplate?.fields || []).filter((f) => f.duplicateCheck).map((f) => f.key).filter(Boolean)),
    [currentTemplate]
  );

  function getEditableRowData(submission) {
    return { ...(submission.data || {}), ...(draftRows[submission.id] || {}) };
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

  return {
    rows,
    setRows,
    total,
    setTotal,
    page,
    setPage,
    loading,
    setLoading,
    templateItems,
    setTemplateItems,
    templateSlug,
    setTemplateSlug,
    status,
    setStatus,
    source,
    setSource,
    keyword,
    setKeyword,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    pageSize,
    setPageSize,
    pushStatus,
    setPushStatus,
    erpStatus,
    setErpStatus,
    ipAddress,
    setIpAddress,
    dateRange,
    setDateRange,
    fieldFilters,
    setFieldFilters,
    totalPages,
    draftRows,
    setDraftRows,
    newRows,
    setNewRows,
    checkedIds,
    setCheckedIds,
    pushingIds,
    setPushingIds,
    fetchPage,
    getFieldLabel,
    currentTemplate,
    duplicateCheckKeys,
    getEditableRowData,
    getSubmissionTemplate,
    hasWebhookConfig,
    getEffectivePushStatus,
  };
}

/**
 * 重复值检测 Hook
 */
export function useDuplicateDetection({ rows, newRows, draftRows, duplicateCheckKeys, tableFieldKeys, getEditableRowData }) {
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
  }, [draftRows, duplicateCheckKeys, rows, newRows, tableFieldKeys, getEditableRowData]);

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

  return {
    duplicateValueMap,
    hasDuplicateExistingCell,
    findDuplicateForValue,
    hasAnyDuplicateExistingCell,
    findFirstDuplicateInData,
  };
}
