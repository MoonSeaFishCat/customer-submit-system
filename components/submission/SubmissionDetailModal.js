"use client";

import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Textarea } from "@/components/ui";
import { formatDate } from "@/utils/submission-utils";
import { useRef } from "react";

/**
 * 提交详情弹窗组件
 */
export default function SubmissionDetailModal({
  selected,
  onClose,
  templateItems,
  getFieldLabel,
  getPushStatusClass,
  getPushStatusText,
  onDelete,
  patchJson,
  setPatchJson,
  patchMessage,
  onPatch,
}) {
  const dragStateRef = useRef(null);
  const modalPosition = { x: 0, y: 0 };

  function startDrag(event) {
    if (event.button !== 0) return;
    dragStateRef.current = { startX: event.clientX, startY: event.clientY, originX: modalPosition.x, originY: modalPosition.y };
    function onMouseMove(e) {
      if (!dragStateRef.current) return;
      // 实际拖动逻辑需要父组件状态支持，此处简化
    }
    function onMouseUp() {
      dragStateRef.current = null;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  function getSubmissionFieldLabel(submission, key) {
    const tmpl = templateItems.find((t) => t.slug === submission.template_slug);
    return tmpl?.fields?.find((f) => f.key === key)?.label || getFieldLabel(key);
  }

  if (!selected?.submission) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-transparent p-3 sm:p-4" role="dialog" aria-modal="true">
      <button type="button" aria-label="关闭详情" className="absolute inset-0 cursor-default" onClick={onClose} />
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
            <Button type="button" variant="destructive" size="sm" onClick={() => onDelete(selected.submission)}>删除</Button>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>关闭</Button>
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
                  <Button type="button" size="sm" onClick={onPatch}>合并写入字段</Button>
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
  );
}
