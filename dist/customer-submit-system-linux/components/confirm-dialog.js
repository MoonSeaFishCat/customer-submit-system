"use client";

import { Button } from "@/components/ui";

export default function ConfirmDialog({
  open,
  title = "确认操作",
  description,
  confirmText = "确认",
  cancelText = "取消",
  destructive = false,
  onConfirm,
  onCancel
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border bg-white shadow-2xl shadow-slate-950/25">
        <div className="border-b p-5">
          <div className="text-lg font-semibold text-slate-950">{title}</div>
          {description ? <div className="mt-2 text-sm leading-6 text-slate-600">{description}</div> : null}
        </div>

        <div className="flex flex-col-reverse gap-2 p-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="bg-white" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button type="button" variant={destructive ? "destructive" : "default"} onClick={onConfirm}>
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
