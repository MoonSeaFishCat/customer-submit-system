"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";

export default function ToastNotice({ notice, onClose, duration = 5000 }) {
  useEffect(() => {
    if (!notice) return undefined;

    const timer = window.setTimeout(() => {
      onClose?.();
    }, duration);

    return () => window.clearTimeout(timer);
  }, [notice, onClose, duration]);

  if (!notice) return null;

  const type = notice.type || "info";
  const iconMap = {
    success: "✓",
    error: "!",
    warning: "!",
    info: "i"
  };

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm justify-end sm:right-6 sm:top-6">
      <div
        className={cn(
          "pointer-events-auto animate-[toast-in_220ms_ease-out] overflow-hidden rounded-2xl border bg-white shadow-2xl shadow-slate-950/15",
          type === "success" && "border-emerald-200",
          type === "error" && "border-red-200",
          type === "warning" && "border-amber-200",
          type === "info" && "border-blue-200"
        )}
        role={type === "error" ? "alert" : "status"}
      >
        <div className="flex gap-3 p-4">
          <span
            className={cn(
              "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white",
              type === "success" && "bg-emerald-500",
              type === "error" && "bg-red-500",
              type === "warning" && "bg-amber-500",
              type === "info" && "bg-blue-500"
            )}
          >
            {iconMap[type] || iconMap.info}
          </span>

          <div className="min-w-0 flex-1 pr-2">
            <div className="font-semibold text-slate-950">
              {notice.title || (type === "success" ? "操作成功" : type === "error" ? "操作失败" : type === "warning" ? "请注意" : "操作提示")}
            </div>
            {notice.text ? <div className="mt-1 break-words text-sm leading-6 text-slate-600">{notice.text}</div> : null}
          </div>

          <button
            type="button"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            onClick={onClose}
            aria-label="关闭提示"
          >
            ×
          </button>
        </div>

        <div
          className={cn(
            "h-1 origin-left animate-[toast-progress_5s_linear_forwards]",
            type === "success" && "bg-emerald-500",
            type === "error" && "bg-red-500",
            type === "warning" && "bg-amber-500",
            type === "info" && "bg-blue-500"
          )}
        />
      </div>
    </div>
  );
}
