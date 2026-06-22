"use client";

import { Input, Textarea } from "@/components/ui";

/**
 * 管理端可编辑单元格组件
 */
export default function EditableCell({ rowId, data, fieldKey, duplicate = false, onUpdate, field }) {
  const normalizedType = field.type === "dropdown" || field.type === "radio" ? "select" : field.type;
  const options = Array.isArray(field.options)
    ? field.options
    : String(field.optionsText || "").split("\n").map((o) => o.trim()).filter(Boolean);
  const value = data?.[fieldKey] === undefined || data?.[fieldKey] === null ? "" : data[fieldKey];
  const dupClass = duplicate ? "border-amber-300 bg-amber-100/80 font-semibold text-amber-900 focus-visible:ring-amber-400" : "";

  if (normalizedType === "multiselect") {
    const selectedVals = String(value) ? String(value).split("+").map((v) => v.trim()).filter(Boolean) : [];
    const toggle = (opt) => {
      const next = selectedVals.includes(opt) ? selectedVals.filter((v) => v !== opt) : [...selectedVals, opt];
      onUpdate(rowId, fieldKey, next.join("+"));
    };
    const removeCustom = (opt) => {
      const next = selectedVals.filter((v) => v !== opt);
      onUpdate(rowId, fieldKey, next.join("+"));
    };
    const displayText = selectedVals.length > 0 ? selectedVals.join(" + ") : "请选择";
    const customVals = selectedVals.filter((v) => !options.includes(v));
    const inputId = `ms-input-${rowId}-${fieldKey}`;
    const addCustomValue = () => {
      const input = document.getElementById(inputId);
      if (!input) return;
      const v = input.value.trim();
      if (!v) return;
      if (!selectedVals.includes(v)) {
        onUpdate(rowId, fieldKey, [...selectedVals, v].join("+"));
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
        onChange={(e) => onUpdate(rowId, fieldKey, e.target.value)}
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
          onChange={(e) => onUpdate(rowId, fieldKey, e.target.checked)}
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
        onChange={(e) => onUpdate(rowId, fieldKey, e.target.value)}
        placeholder={field.placeholder || field.label}
      />
    );
  }
  return (
    <Input
      className={`h-8 min-w-40 px-2 shadow-none hover:border-input hover:bg-background focus-visible:bg-background ${duplicate ? dupClass : "border-transparent bg-transparent"}`}
      type={normalizedType || "text"}
      value={String(value)}
      onChange={(e) => onUpdate(rowId, fieldKey, e.target.value)}
      placeholder={field.placeholder || field.label}
    />
  );
}
