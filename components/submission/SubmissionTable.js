"use client";

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from "@/components/ui";
import EditableCell from "./EditableCell";
import { formatDate } from "@/utils/submission-utils";
import { getAllDataKeys } from "@/utils/submission-utils";
import { useMemo } from "react";

/**
 * 提交记录表格组件
 */
export default function SubmissionTable({
  rows,
  newRows,
  tableFieldKeys,
  allDataKeys,
  visibleFieldKeys,
  checkedIds,
  pushingIds,
  loading,
  total,
  page,
  totalPages,
  templateSlug,
  currentTemplate,
  getFieldLabel,
  getFieldDefinition,
  getEditableRowData,
  hasDraftChanges,
  findDuplicateForValue,
  findFirstDuplicateInData,
  hasDuplicateExistingCell,
  hasAnyDuplicateExistingCell,
  getPushStatusClass,
  getPushStatusText,
  getEffectivePushStatus,
  canPushSubmission,
  getPushButtonText,
  onToggleCheckedId,
  onCheckAll,
  onUpdateExistingCell,
  onUpdateNewCell,
  onSaveExistingRow,
  onSaveNewRow,
  onCancelNewRow,
  onPushSubmissions,
  onDeleteSubmission,
  onLoadDetail,
  onOpenErpDetail,
  onMarkErpNoAnomaly,
  onToggleVisibleField,
  onAddBlankRow,
  onExportAll,
  onAddCustomColumn,
  onFetchPage,
  newColumnName,
  setNewColumnName,
  exporting,
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>提交结果表格</CardTitle>
            <CardDescription>云表格模式：可直接在单元格内修改；新增行填写后点击最右侧保存。仅模板配置中开启查重提醒的字段会进行重复值高亮。</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={onAddBlankRow} disabled={!templateSlug || tableFieldKeys.length === 0}>
              新增一行
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onPushSubmissions(checkedIds)}
              disabled={checkedIds.length === 0 || pushingIds.length > 0}
            >
              批量推送{checkedIds.length > 0 ? ` (${checkedIds.length})` : ""}
            </Button>
            <Button type="button" variant="outline" onClick={onExportAll} disabled={total === 0 || tableFieldKeys.length === 0 || exporting}>
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
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAddCustomColumn(); } }}
              placeholder="输入新增列名称，例如：内部备注"
            />
            <Button type="button" variant="outline" onClick={onAddCustomColumn}>新增列</Button>
          </div>
          <div className="flex max-h-28 flex-wrap gap-2 overflow-auto">
            {allDataKeys.map((key) => (
              <label key={key} className="flex items-center gap-1 rounded-full border px-2 py-1 text-xs" title={key}>
                <input type="checkbox" checked={tableFieldKeys.includes(key)} onChange={() => onToggleVisibleField(key)} />
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
                    onChange={(e) => onCheckAll(e.target.checked)}
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
                          <EditableCell rowId={row.id} data={row.data} key={key} duplicate={Boolean(dupSub)} onUpdate={onUpdateNewCell} field={fieldDef} />
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
                        <Button type="button" size="sm" onClick={() => onSaveNewRow(row)}>保存</Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => onCancelNewRow(row.id)}>取消</Button>
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
                        onChange={() => onToggleCheckedId(submission.id)}
                        aria-label={`选择记录 ${submission.id}`}
                      />
                    </td>
                    {tableFieldKeys.map((key) => {
                      const dupCell = hasDuplicateExistingCell(submission, key);
                      const fieldDef = getFieldDefinition(key);
                      return (
                        <td key={key} className={`max-w-[240px] border-b border-r px-3 py-2 align-middle ${dupCell ? "border-amber-200 bg-amber-50" : ""}`}>
                          <EditableCell rowId={submission} data={editableData} key={key} duplicate={dupCell} onUpdate={onUpdateExistingCell} field={fieldDef} />
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
                      onDoubleClick={() => onLoadDetail(submission)}
                      title="双击全屏查看详情"
                    >
                      <div className="flex flex-col gap-1">
                        <div className="flex gap-1">
                          <Button type="button" size="sm" onClick={() => onSaveExistingRow(submission)} disabled={!hasDraftChanges(submission)}>保存</Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => onPushSubmissions([submission.id])} disabled={!canPushSubmission(submission)}>{getPushButtonText(submission)}</Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => onOpenErpDetail(submission)}>快麦</Button>
                          <Button type="button" size="sm" variant="destructive" onClick={() => onDeleteSubmission(submission)}>删除</Button>
                        </div>
                        <div className="flex gap-1">
                          {erpAnomaly && (
                            <Button type="button" size="sm" variant="outline" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50" onClick={() => onMarkErpNoAnomaly(submission, false)}>标记无异常</Button>
                          )}
                          {submission.erp_anomaly_override === "no_anomaly" && (
                            <Button type="button" size="sm" variant="outline" className="border-slate-300 text-slate-500 hover:bg-slate-50" onClick={() => onMarkErpNoAnomaly(submission, true)}>取消标记</Button>
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
                    {loading ? "加载中..." : "暂无数据，请设置筛选条件后点击查询"}
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
              <Button type="button" variant="outline" size="sm" onClick={() => onFetchPage(1)} disabled={page === 1 || loading}>首页</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => onFetchPage(page - 1)} disabled={page === 1 || loading}>上一页</Button>
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
                    <Button key={p} type="button" variant={p === page ? "default" : "outline"} size="sm" className="min-w-[32px]" onClick={() => onFetchPage(p)} disabled={loading}>
                      {p}
                    </Button>
                  )
                )}
              <Button type="button" variant="outline" size="sm" onClick={() => onFetchPage(page + 1)} disabled={page === totalPages || loading}>下一页</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => onFetchPage(totalPages)} disabled={page === totalPages || loading}>末页</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
