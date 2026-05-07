"use client";

import { useState } from "react";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";

export default function SubmitForm({ template }) {
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function setValue(key, value) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setMessage("");

    const res = await fetch(`/api/submit/${template.slug}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ data: values, source: "web" })
    });

    const json = await res.json();

    if (!res.ok) {
      setErrors(json.fields || {});
      setMessage(json.error || "提交失败");
      setSubmitting(false);
      return;
    }

    setValues({});
    setMessage(`提交成功，编号：${json.submission.id}`);
    setSubmitting(false);
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      {(template.fields || []).map((field) => (
        <div key={field.key} className="space-y-2">
          <Label htmlFor={field.key}>
            {field.label}
            {field.required ? <span className="ml-1 text-destructive">*</span> : null}
          </Label>

          {field.type === "textarea" ? (
            <Textarea
              id={field.key}
              placeholder={field.placeholder || ""}
              value={values[field.key] || ""}
              onChange={(event) => setValue(field.key, event.target.value)}
            />
          ) : field.type === "select" ? (
            <Select
              id={field.key}
              value={values[field.key] || ""}
              onChange={(event) => setValue(field.key, event.target.value)}
            >
              <option value="">请选择</option>
              {(field.options || []).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          ) : field.type === "checkbox" ? (
            <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
              <input
                type="checkbox"
                checked={Boolean(values[field.key])}
                onChange={(event) => setValue(field.key, event.target.checked)}
              />
              {field.placeholder || field.help || "是"}
            </label>
          ) : (
            <Input
              id={field.key}
              type={field.type || "text"}
              placeholder={field.placeholder || ""}
              value={values[field.key] || ""}
              onChange={(event) => setValue(field.key, event.target.value)}
            />
          )}

          {field.help ? <p className="text-xs text-muted-foreground">{field.help}</p> : null}
          {errors[field.key] ? <p className="text-xs text-destructive">{errors[field.key]}</p> : null}
        </div>
      ))}

      {message ? (
        <div className="rounded-md border bg-muted p-3 text-sm">{message}</div>
      ) : null}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "提交中..." : "提交信息"}
      </Button>
    </form>
  );
}
