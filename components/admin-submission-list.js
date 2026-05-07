"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  const [editData, setEditData] = useState({});
  const [editStatus, setEditStatus] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [editingCell, setEditingCell] = useState(null);
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

  function getFieldLabel(key) {
    return fieldLabelMap.get(key) || key;
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

  async function loadDetail(submission) {
    const res = await fetch(`/api/submissions/${submission.id}`);
    const json = await res.json();
    setSelected(json);
    setPatchMessage("");
    setEditMessage("");
    setEditData(json.submission?.data || {});
    setEditStatus(json.submission?.status || "");
    setModalPosition({ x: 0, y: 0 });
  }

  async function deleteSubmissionItem(submission) {
    const confirmed = window.confirm(`确定删除提交记录「${submission.id}」吗？相关 Webhook 日志也会一起删除。`);
    if (!confirmed) return;

    const res = await fetch(`/api/submissions/${submission.id}`, {
      method: "DELETE"
    });

    const json = await res.json();

    if (!res.ok) {
      window.alert(json.error || "删除失败");
      return;
    }

    setRows((current) => current.filter((item) => item.id !== submission.id));

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
  }

  function toggleVisibleField(key) {
    setVisibleFieldKeys((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    );
  }

  function escapeCsvCell(value) {
    const text = value === undefined || value === null ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  }

  function exportFilteredResults() {
    const headers = tableFieldKeys.map((key) => getFieldLabel(key));
    const lines = [
      headers.map(escapeCsvCell).join(","),
      ...filtered.map((submission) =>
        tableFieldKeys
          .map((key) => escapeCsvCell(submission.data?.[key]))
          .join(",")
      )
    ];

    const csv = `\uFEFF${lines.join("\r\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    const templateName = currentTemplate?.name || "提交结果";
    const timestamp = formatDate(new Date().toISOString()).replace(/[:\s]/g, "-");

    link.href = url;
    link.download = `${templateName}-查询结果-${timestamp}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  async function addCustomColumn() {
    const label = newColumnName.trim();

    if (!label) {
      window.alert("请输入新增列名称");
      return;
    }

    if (!templateSlug) {
      window.alert("请先选择模板");
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
      window.alert(json.error || "新增列失败");
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

  async function saveCellEdit() {
    if (!editingCell) return;

    const { submission, key, value } = editingCell;
    const nextData = {
      ...(submission.data || {}),
      [key]: value
    };

    try {
      await saveSubmissionPatch(submission, nextData, submission.status);
      setEditingCell(null);
    } catch (error) {
      window.alert(error.message);
    }
  }

  async function saveSelectedSubmission() {
    if (!selected?.submission) return;

    setEditMessage("");

    try {
      const submission = await saveSubmissionPatch(selected.submission, editData, editStatus);
      setEditData(submission.data || {});
      setEditStatus(submission.status || "");
      setEditMessage("提交信息已保存。");
    } catch (error) {
      setEditMessage(error.message);
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
  }

  return (
    <div className="space-y-6">
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
              <CardDescription>默认仅展示当前模板字段；双击字段单元格可直接编辑，操作列可查看详情或删除记录。</CardDescription>
            </div>
            <Button type="button" variant="outline" onClick={exportFilteredResults} disabled={filtered.length === 0 || tableFieldKeys.length === 0}>
              导出查询结果
            </Button>
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

          <div className="overflow-auto rounded-md border">
            <table className="w-full min-w-[960px] border-collapse text-sm">
              <thead className="bg-muted/80">
                <tr>
                  {tableFieldKeys.map((key) => (
                    <th key={key} className="whitespace-nowrap border-b px-3 py-2 text-left font-medium" title={key}>{getFieldLabel(key)}</th>
                  ))}
                  <th className="sticky right-0 whitespace-nowrap border-b bg-muted/80 px-3 py-2 text-left font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((submission) => (
                  <tr
                    key={submission.id}
                    onDoubleClick={() => loadDetail(submission)}
                    title="双击编辑"
                    className="cursor-pointer border-b transition-colors hover:bg-accent"
                  >
                    {tableFieldKeys.map((key) => {
                      const isEditing = editingCell?.submission.id === submission.id && editingCell?.key === key;

                      return (
                        <td
                          key={key}
                          className="max-w-[220px] px-3 py-2"
                          title="双击编辑此字段"
                          onDoubleClick={(event) => {
                            event.stopPropagation();
                            setEditingCell({
                              submission,
                              key,
                              value: submission.data?.[key] === undefined || submission.data?.[key] === null ? "" : String(submission.data[key])
                            });
                          }}
                        >
                          {isEditing ? (
                            <Input
                              autoFocus
                              className="h-8 min-w-40"
                              value={editingCell.value}
                              onChange={(event) => setEditingCell({ ...editingCell, value: event.target.value })}
                              onBlur={saveCellEdit}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  saveCellEdit();
                                }

                                if (event.key === "Escape") {
                                  event.preventDefault();
                                  setEditingCell(null);
                                }
                              }}
                              onDoubleClick={(event) => event.stopPropagation()}
                            />
                          ) : (
                            <div className="truncate">
                              {submission.data?.[key] === undefined || submission.data?.[key] === null
                                ? "-"
                                : String(submission.data[key])}
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td className="sticky right-0 whitespace-nowrap bg-background px-3 py-2">
                      <div className="flex gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => loadDetail(submission)}>
                          查看详情
                        </Button>
                        <Button type="button" size="sm" variant="destructive" onClick={() => deleteSubmissionItem(submission)}>
                          删除
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={1 + tableFieldKeys.length} className="px-3 py-10 text-center text-muted-foreground">
                      没有匹配的提交记录
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
                <Button type="button" variant="destructive" size="sm" onClick={() => deleteSubmissionItem(selected.submission)}>
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
