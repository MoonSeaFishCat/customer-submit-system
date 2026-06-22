"use client";

import { useEffect, useMemo, useState } from "react";
import ConfirmDialog from "@/components/confirm-dialog";
import ToastNotice from "@/components/toast-notice";
import SubmissionFilters from "@/components/submission/SubmissionFilters";
import SubmissionTable from "@/components/submission/SubmissionTable";
import SubmissionDetailModal from "@/components/submission/SubmissionDetailModal";
import ErpOrderModal from "@/components/submission/ErpOrderModal";
import { useSubmissionList, useDuplicateDetection } from "@/hooks/useSubmissionList";
import { getAllDataKeys, buildExcelHtml, downloadExcel } from "@/utils/submission-utils";

/**
 * 管理端提交记录列表主组件
 */
export default function AdminSubmissionList({ submissions: initialSubmissions, initialTotal, templates }) {
  const listState = useSubmissionList({ initialSubmissions, initialTotal, templates });
  const {
    rows,
    setRows,
    total,
    setTotal,
    page,
    loading,
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
    getEffectivePushStatus,
  } = listState;

  const [visibleFieldKeys, setVisibleFieldKeys] = useState([]);
  const [newColumnName, setNewColumnName] = useState("");
  const [selected, setSelected] = useState(null);
  const [patchJson, setPatchJson] = useState("{\n  \"internal_note\": \"\"\n}");
  const [patchMessage, setPatchMessage] = useState("");
  const [notice, setNotice] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [erpModal, setErpModal] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!selected) return;
    function onKeyDown(e) { if (e.key === "Escape") setSelected(null); }
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKeyDown); document.body.style.overflow = ""; };
  }, [selected]);

  useEffect(() => { setVisibleFieldKeys([]); }, [templateSlug]);

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

  const duplicateDetection = useDuplicateDetection({
    rows,
    newRows,
    draftRows,
    duplicateCheckKeys,
    tableFieldKeys,
    getEditableRowData,
  });

  function notify(text, type = "info", title) {
    setNotice({
      text,
      type,
      title: title || (type === "success" ? "操作成功" : type === "error" ? "操作失败" : type === "warning" ? "请注意" : "操作提示")
    });
  }

  function getFieldDefinition(key) {
    return (currentTemplate?.fields || []).find((f) => f.key === key) || { key, label: getFieldLabel(key), type: "text" };
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

  function hasDraftChanges(submission) {
    return Boolean(draftRows[submission.id] && Object.keys(draftRows[submission.id]).length > 0);
  }

  async function loadDetail(submission) {
    const res = await fetch(`/api/submissions/${submission.id}`);
    const json = await res.json();
    if (!res.ok) { notify(json.error || "详情加载失败", "error"); return; }
    setSelected(json);
    setPatchMessage("");
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
    setPushStatus("");
    setErpStatus("");
    setIpAddress("");
    setDateRange("all");
    setFieldFilters([]);
    fetchPage(1, {
      templateSlug: slug,
      keyword: "",
      status: "",
      source: "",
      dateFrom: "",
      dateTo: "",
      pushStatus: "",
      erpStatus: "",
      ipAddress: "",
      fieldFilters: []
    });
    notify("筛选条件已重置", "info");
  }

  function toggleVisibleField(key) {
    setVisibleFieldKeys((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key]
    );
  }

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
      const templateName = currentTemplate?.name || "提交结果";
      const { html, timestamp } = buildExcelHtml(allRows, tableFieldKeys, getFieldLabel, templateName, allRows.length);
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

  function toggleCheckedId(id) {
    setCheckedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
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

  function addBlankRow() {
    if (!templateSlug) { notify("请先选择模板", "warning"); return; }
    const data = Object.fromEntries(tableFieldKeys.map((key) => [key, ""]));
    setNewRows((current) => [
      ...current,
      { id: `new_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`, template_slug: templateSlug, data }
    ]);
    notify("已新增一行，请填写后点击右侧保存", "info");
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

      <SubmissionFilters
        templateItems={templateItems}
        templateSlug={templateSlug}
        setTemplateSlug={setTemplateSlug}
        status={status}
        setStatus={setStatus}
        source={source}
        setSource={setSource}
        keyword={keyword}
        setKeyword={setKeyword}
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
        pageSize={pageSize}
        setPageSize={(ps) => { setPageSize(ps); fetchPage(1, { pageSize: ps }); }}
        pushStatus={pushStatus}
        setPushStatus={setPushStatus}
        erpStatus={erpStatus}
        setErpStatus={setErpStatus}
        ipAddress={ipAddress}
        setIpAddress={setIpAddress}
        dateRange={dateRange}
        setDateRange={setDateRange}
        fieldFilters={fieldFilters}
        setFieldFilters={setFieldFilters}
        total={total}
        page={page}
        totalPages={totalPages}
        loading={loading}
        onSearch={() => fetchPage(1)}
        onReset={resetFilters}
      />

      <SubmissionTable
        rows={rows}
        newRows={newRows}
        tableFieldKeys={tableFieldKeys}
        allDataKeys={allDataKeys}
        visibleFieldKeys={visibleFieldKeys}
        checkedIds={checkedIds}
        pushingIds={pushingIds}
        loading={loading}
        total={total}
        page={page}
        totalPages={totalPages}
        templateSlug={templateSlug}
        currentTemplate={currentTemplate}
        getFieldLabel={getFieldLabel}
        getFieldDefinition={getFieldDefinition}
        getEditableRowData={getEditableRowData}
        hasDraftChanges={hasDraftChanges}
        findDuplicateForValue={duplicateDetection.findDuplicateForValue}
        findFirstDuplicateInData={duplicateDetection.findFirstDuplicateInData}
        hasDuplicateExistingCell={duplicateDetection.hasDuplicateExistingCell}
        hasAnyDuplicateExistingCell={duplicateDetection.hasAnyDuplicateExistingCell}
        getPushStatusClass={getPushStatusClass}
        getPushStatusText={getPushStatusText}
        getEffectivePushStatus={getEffectivePushStatus}
        canPushSubmission={canPushSubmission}
        getPushButtonText={getPushButtonText}
        onToggleCheckedId={toggleCheckedId}
        onCheckAll={(checked) => setCheckedIds(checked ? rows.map((s) => s.id) : [])}
        onUpdateExistingCell={updateExistingCell}
        onUpdateNewCell={updateNewCell}
        onSaveExistingRow={saveExistingRow}
        onSaveNewRow={saveNewRow}
        onCancelNewRow={(id) => { setNewRows((c) => c.filter((r) => r.id !== id)); notify("已取消新增行", "info"); }}
        onPushSubmissions={requestPushSubmissions}
        onDeleteSubmission={requestDeleteSubmission}
        onLoadDetail={loadDetail}
        onOpenErpDetail={openErpDetail}
        onMarkErpNoAnomaly={markErpNoAnomaly}
        onToggleVisibleField={toggleVisibleField}
        onAddBlankRow={addBlankRow}
        onExportAll={exportAllResults}
        onAddCustomColumn={addCustomColumn}
        onFetchPage={fetchPage}
        newColumnName={newColumnName}
        setNewColumnName={setNewColumnName}
        exporting={exporting}
      />

      <SubmissionDetailModal
        selected={selected}
        onClose={() => setSelected(null)}
        templateItems={templateItems}
        getFieldLabel={getFieldLabel}
        getPushStatusClass={getPushStatusClass}
        getPushStatusText={getPushStatusText}
        onDelete={requestDeleteSubmission}
        patchJson={patchJson}
        setPatchJson={setPatchJson}
        patchMessage={patchMessage}
        onPatch={patchSelectedSubmission}
      />

      <ErpOrderModal erpModal={erpModal} onClose={() => setErpModal(null)} />
    </div>
  );
}
