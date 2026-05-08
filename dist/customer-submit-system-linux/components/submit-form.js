"use client";

import { useEffect, useMemo, useState } from "react";
import ToastNotice from "@/components/toast-notice";
import { Button, Input, Select, Textarea } from "@/components/ui";

function toCheckboxValue(value) {
  if (typeof value === "string") {
    return ["true", "1", "yes", "on", "是"].includes(value.trim().toLowerCase());
  }

  return Boolean(value);
}

function hasDefaultValue(field) {
  return field.defaultValue !== undefined && field.defaultValue !== null && String(field.defaultValue).trim() !== "";
}

function getFieldInitialValue(field) {
  if (hasDefaultValue(field)) {
    return field.type === "checkbox" ? toCheckboxValue(field.defaultValue) : String(field.defaultValue);
  }

  return field.type === "checkbox" ? false : "";
}

function getCellValue(field, data) {
  const value = data?.[field.key];

  if (value !== undefined && value !== null && value !== "") {
    return value;
  }

  return getFieldInitialValue(field);
}

function applyFieldDefaults(fields, data) {
  return Object.fromEntries((fields || []).map((field) => [field.key, getCellValue(field, data)]));
}

function hydrateDataWithDefaults(fields, data = {}) {
  return Object.fromEntries(
    (fields || []).map((field) => {
      const currentValue = data?.[field.key];
      const shouldUseDefault = currentValue === undefined || currentValue === null || currentValue === "";

      return [field.key, shouldUseDefault ? getFieldInitialValue(field) : currentValue];
    })
  );
}

function normalizeComparableValue(field, data) {
  const value = getCellValue(field, data);

  if (field.type === "checkbox") {
    return toCheckboxValue(value) ? "true" : "false";
  }

  return String(value ?? "").trim().toLowerCase();
}

function createDuplicateSignature(fields, data) {
  return (fields || []).map((field) => `${field.key}:${normalizeComparableValue(field, data)}`).join("|");
}

function createEmptyRow(fields) {
  return {
    id: `row_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    data: hydrateDataWithDefaults(fields),
    errors: {}
  };
}

export default function SubmitForm({ template, submissions = [] }) {
  const fields = template.fields || [];
  const [submittedRows, setSubmittedRows] = useState(submissions);
  const [rows, setRows] = useState([]);
  const [editingRows, setEditingRows] = useState({});
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setRows((current) =>
      current.map((row) => ({
        ...row,
        data: hydrateDataWithDefaults(fields, row.data)
      }))
    );
    setEditingRows((current) =>
      Object.fromEntries(
        Object.entries(current).map(([id, draft]) => [
          id,
          {
            ...draft,
            data: hydrateDataWithDefaults(fields, draft.data)
          }
        ])
      )
    );
  }, [fields]);

  const duplicateCellMap = useMemo(() => {
    const valueMap = new Map();

    for (const submission of submittedRows) {
      for (const field of fields) {
        const value = normalizeComparableValue(field, submission.data || {});
        if (!value) continue;

        const key = `${field.key}:${value}`;
        if (!valueMap.has(key)) {
          valueMap.set(key, []);
        }
        valueMap.get(key).push(submission.id);
      }
    }

    const duplicated = new Map();
    for (const [key, ids] of valueMap.entries()) {
      if (ids.length > 1) {
        duplicated.set(key, new Set(ids));
      }
    }

    return duplicated;
  }, [fields, submittedRows]);

  function hasDuplicateCell(submission, field, data = submission.data) {
    const value = normalizeComparableValue(field, data || {});
    if (!value) return false;

    const ids = duplicateCellMap.get(`${field.key}:${value}`);
    return Boolean(ids?.has(submission.id));
  }

  function hasAnyDuplicateCell(submission) {
    return fields.some((field) => hasDuplicateCell(submission, field));
  }

  function findDuplicateCellInfo(data, excludeId = null) {
    for (const field of fields) {
      const value = normalizeComparableValue(field, data || {});
      if (!value) continue;

      const duplicate = submittedRows.find((submission) => {
        if (submission.id === excludeId) return false;
        return normalizeComparableValue(field, submission.data || {}) === value;
      });

      if (duplicate) {
        return {
          submission: duplicate,
          field
        };
      }
    }

    return null;
  }

  function findDuplicateSubmission(data, excludeId = null) {
    const signature = createDuplicateSignature(fields, data || {});

    return submittedRows.find((submission) => {
      if (submission.id === excludeId) return false;
      return createDuplicateSignature(fields, submission.data || {}) === signature;
    });
  }

  function addRow() {
    setRows((current) => [createEmptyRow(fields), ...current]);
    setMessage("已新增一行，已置顶显示，请填写后点击右侧“保存提交”。");
    setMessageType("info");
  }

  function removeRow(rowId) {
    setRows((current) => current.filter((row) => row.id !== rowId));
    setMessage("已移除未保存的填写行。");
    setMessageType("info");
  }

  function updateCell(rowId, key, value) {
    setRows((current) =>
      current.map((row) =>
        row.id === rowId
          ? {
              ...row,
              data: {
                ...row.data,
                [key]: value
              },
              errors: {
                ...row.errors,
                [key]: undefined
              }
            }
          : row
      )
    );
  }

  function startEditSubmission(submission) {
    setEditingRows((current) => ({
      ...current,
      [submission.id]: {
        data: applyFieldDefaults(fields, submission.data || {}),
        errors: {}
      }
    }));
    setMessage(`正在修改提交记录：${submission.id}`);
    setMessageType("info");
  }

  function cancelEditSubmission(submissionId) {
    setEditingRows((current) => {
      const next = { ...current };
      delete next[submissionId];
      return next;
    });
    setMessage("已取消修改。");
    setMessageType("info");
  }

  function updateEditingCell(submissionId, key, value) {
    setEditingRows((current) => ({
      ...current,
      [submissionId]: {
        ...(current[submissionId] || { data: {}, errors: {} }),
        data: {
          ...(current[submissionId]?.data || {}),
          [key]: value
        },
        errors: {
          ...(current[submissionId]?.errors || {}),
          [key]: undefined
        }
      }
    }));
  }

  function renderEditableCell({ id, data, errors = {}, field, onUpdate }) {
    const commonClass = "h-10 min-w-44 border-slate-200 bg-white shadow-sm transition focus-visible:ring-blue-500";

    if (field.type === "select") {
      return (
        <Select
          className={commonClass}
          value={getCellValue(field, data) || ""}
          onChange={(event) => onUpdate(id, field.key, event.target.value)}
        >
          <option value="">请选择</option>
          {(field.options || []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      );
    }

    if (field.type === "checkbox") {
      return (
        <label className="flex h-10 min-w-36 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm">
          <input
            type="checkbox"
            checked={toCheckboxValue(getCellValue(field, data))}
            onChange={(event) => onUpdate(id, field.key, event.target.checked)}
          />
          {field.placeholder || field.help || "是"}
        </label>
      );
    }

    if (field.type === "textarea") {
      return (
        <Textarea
          className="min-h-10 min-w-60 border-slate-200 bg-white py-2 shadow-sm focus-visible:ring-blue-500"
          value={getCellValue(field, data) || ""}
          onChange={(event) => onUpdate(id, field.key, event.target.value)}
          placeholder={field.placeholder || ""}
        />
      );
    }

    return (
      <Input
        className={commonClass}
        type={field.type || "text"}
        value={getCellValue(field, data) || ""}
        onChange={(event) => onUpdate(id, field.key, event.target.value)}
        placeholder={field.placeholder || ""}
      />
    );
  }

  function renderFieldError(errors, field) {
    return errors?.[field.key] ? <p className="mt-1 text-xs text-destructive">{errors[field.key]}</p> : null;
  }

  async function saveRow(row) {
    setSubmitting(true);
    setMessage("");
    setMessageType("info");

    const duplicate = findDuplicateSubmission(row.data);
    const submitData = hydrateDataWithDefaults(fields, row.data);
    setRows((current) => current.map((item) => (item.id === row.id ? { ...item, data: submitData } : item)));

    const res = await fetch(`/api/submit/${template.slug}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ data: submitData, source: "web" })
    });

    const json = await res.json();

    if (!res.ok) {
      setRows((current) =>
        current.map((item) =>
          item.id === row.id
            ? {
                ...item,
                errors: json.fields || {}
              }
            : item
        )
      );
      setMessage(json.error || "提交失败，请检查红色提示字段");
      setMessageType("error");
      setSubmitting(false);
      return;
    }

    setSubmittedRows((current) => [json.submission, ...current]);
    setRows((current) => current.filter((item) => item.id !== row.id));
    setMessage(duplicate ? `提交成功，编号：${json.submission.id}。注意：该内容与记录 ${duplicate.id} 疑似重复。` : `提交成功，编号：${json.submission.id}`);
    setMessageType(duplicate ? "info" : "success");
    setSubmitting(false);
  }

  async function saveEditedSubmission(submission) {
    const draft = editingRows[submission.id];
    if (!draft) return;

    setSubmitting(true);
    setMessage("");
    setMessageType("info");

    const submitData = hydrateDataWithDefaults(fields, draft.data);
    const duplicate = findDuplicateSubmission(submitData, submission.id);
    setEditingRows((current) => ({
      ...current,
      [submission.id]: {
        ...draft,
        data: submitData
      }
    }));

    const res = await fetch(`/api/submit/${template.slug}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: submission.id,
        data: submitData,
        source: "web"
      })
    });

    const json = await res.json();

    if (!res.ok) {
      setEditingRows((current) => ({
        ...current,
        [submission.id]: {
          ...draft,
          errors: json.fields || {}
        }
      }));
      setMessage(json.error || "修改失败，请检查红色提示字段");
      setMessageType("error");
      setSubmitting(false);
      return;
    }

    setSubmittedRows((current) => current.map((item) => (item.id === submission.id ? json.submission : item)));
    setEditingRows((current) => {
      const next = { ...current };
      delete next[submission.id];
      return next;
    });
    setMessage(duplicate ? `修改成功。注意：该内容与记录 ${duplicate.id} 疑似重复。` : "修改成功。");
    setMessageType(duplicate ? "info" : "success");
    setSubmitting(false);
  }

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-slate-50/80 p-4">
        <div>
          <div className="font-semibold text-slate-950">填写说明</div>
          <div className="mt-1 text-sm text-slate-600">
            上方为已提交记录；点击新增填写会在下方生成浅蓝色填写行，带 <span className="font-semibold text-red-500">*</span> 的列为必填。疑似重复内容会使用黄色高亮提醒。
          </div>
        </div>
        <Button type="button" className="h-11 rounded-xl px-5 shadow-lg shadow-blue-600/20" onClick={addRow}>
          新增填写
        </Button>
      </div>

      <div className="max-h-[70vh] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-inner">
        <table className="w-full min-w-[1200px] border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur">
            <tr>
              {fields.map((field) => (
                <th key={field.key} className="whitespace-nowrap border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                  {field.label}
                  {field.required ? <span className="ml-1 text-destructive">*</span> : null}
                </th>
              ))}
              <th className="sticky right-0 whitespace-nowrap border-b border-slate-200 bg-slate-100/95 px-4 py-3 text-left font-semibold text-slate-700 shadow-[-10px_0_16px_-16px_rgba(15,23,42,0.8)]">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const duplicate = findDuplicateCellInfo(row.data);

              return (
                <tr key={row.id} className={`border-b transition-colors ${duplicate ? "bg-amber-50 hover:bg-amber-100/70" : "bg-blue-50/80 hover:bg-blue-50"}`}>
                  {fields.map((field) => {
                    const duplicateCell =
                      duplicate &&
                      normalizeComparableValue(field, row.data) &&
                      normalizeComparableValue(field, row.data) === normalizeComparableValue(field, duplicate.submission.data || {});

                    return (
                      <td key={field.key} className={`min-w-40 border-b px-4 py-3 align-top ${duplicateCell ? "border-amber-200 bg-amber-50" : duplicate ? "border-amber-100" : "border-blue-100"}`}>
                        {renderEditableCell({
                          id: row.id,
                          data: row.data,
                          errors: row.errors,
                          field,
                          onUpdate: updateCell
                        })}
                        {duplicateCell ? <p className="mt-1 text-xs font-medium text-amber-700">与记录 {duplicate.submission.id} 重复</p> : null}
                        {field.help ? <p className="mt-1 text-xs text-muted-foreground">{field.help}</p> : null}
                        {renderFieldError(row.errors, field)}
                      </td>
                    );
                  })}
                  <td className={`sticky right-0 whitespace-nowrap border-b bg-white px-4 py-3 align-top shadow-[-10px_0_16px_-16px_rgba(15,23,42,0.8)] ${duplicate ? "border-amber-100" : "border-blue-100"}`}>
                    <div className="space-y-2">
                      {duplicate ? (
                        <div className="rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-xs font-medium text-amber-800">
                          字段「{duplicate.field.label}」与记录 {duplicate.submission.id} 重复
                        </div>
                      ) : null}
                      <div className="flex gap-2">
                        <Button type="button" size="sm" className="rounded-lg" onClick={() => saveRow(row)} disabled={submitting}>
                          保存提交
                        </Button>
                        <Button type="button" size="sm" className="rounded-lg bg-white" variant="outline" onClick={() => removeRow(row.id)} disabled={submitting}>
                          删除
                        </Button>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}

            {submittedRows.map((submission) => {
              const editing = editingRows[submission.id];
              const duplicate = hasAnyDuplicateCell(submission);
              const editDuplicate = editing ? findDuplicateCellInfo(editing.data, submission.id) : null;

              return (
                <tr key={submission.id} className={`border-b transition-colors ${editing ? "bg-blue-50/80 hover:bg-blue-50" : duplicate ? "bg-amber-50 hover:bg-amber-100/70" : "bg-white hover:bg-slate-50"}`}>
                  {fields.map((field) => {
                    const duplicateCell = hasDuplicateCell(submission, field);

                    return (
                      <td key={field.key} className={`min-w-40 border-b px-4 py-3 align-top ${editing ? "border-blue-100" : duplicateCell ? "border-amber-200 bg-amber-50" : "border-slate-100"}`}>
                        {editing ? (
                          <>
                            {renderEditableCell({
                              id: submission.id,
                              data: editing.data,
                              errors: editing.errors,
                              field,
                              onUpdate: updateEditingCell
                            })}
                            {field.help ? <p className="mt-1 text-xs text-muted-foreground">{field.help}</p> : null}
                            {renderFieldError(editing.errors, field)}
                          </>
                        ) : (
                          <div className={`min-h-10 rounded-lg px-3 py-2 text-slate-700 ${duplicateCell ? "bg-amber-100/90 font-semibold text-amber-900 ring-2 ring-amber-300" : "bg-slate-50/70"}`}>
                            {submission.data?.[field.key] === undefined || submission.data?.[field.key] === null || submission.data?.[field.key] === ""
                              ? "-"
                              : String(submission.data[field.key])}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td className={`sticky right-0 whitespace-nowrap border-b px-4 py-3 align-top shadow-[-10px_0_16px_-16px_rgba(15,23,42,0.8)] ${editing ? "border-blue-100 bg-white" : duplicate ? "border-amber-100 bg-amber-50" : "border-slate-100 bg-white"}`}>
                    {editing ? (
                      <div className="space-y-2">
                        {editDuplicate ? (
                          <div className="rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-xs font-medium text-amber-800">
                            字段「{editDuplicate.field.label}」与记录 {editDuplicate.submission.id} 重复
                          </div>
                        ) : null}
                        <div className="flex gap-2">
                          <Button type="button" size="sm" className="rounded-lg" onClick={() => saveEditedSubmission(submission)} disabled={submitting}>
                            保存修改
                          </Button>
                          <Button type="button" size="sm" className="rounded-lg bg-white" variant="outline" onClick={() => cancelEditSubmission(submission.id)} disabled={submitting}>
                            取消
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">已提交</span>
                          {duplicate ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">疑似重复</span> : null}
                        </div>
                        <Button type="button" size="sm" className="w-fit rounded-lg bg-white" variant="outline" onClick={() => startEditSubmission(submission)} disabled={submitting}>
                          修改
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}

            {submittedRows.length === 0 && rows.length === 0 ? (
              <tr>
                <td colSpan={fields.length + 1} className="px-3 py-14 text-center text-slate-500">
                  <div className="font-medium text-slate-700">暂无提交记录</div>
                  <div className="mt-1 text-sm">点击右上方“新增填写”开始录入第一条信息</div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <ToastNotice
        notice={message ? {
          type: messageType,
          title: messageType === "success" ? "保存成功" : messageType === "error" ? "保存失败" : "操作提示",
          text: message
        } : null}
        onClose={() => setMessage("")}
      />

    </div>
  );
}
