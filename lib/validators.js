import { z } from "zod";

export const fieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "tel", "email", "number", "textarea", "select", "multiselect", "date", "checkbox"]).default("text"),
  required: z.boolean().default(false),
  placeholder: z.string().optional(),
  help: z.string().optional(),
  defaultValue: z.string().optional(),
  options: z.array(z.string()).optional(),
  duplicateCheck: z.boolean().default(false).optional(),
  adminOnly: z.boolean().default(false).optional()
});

export const templateSchema = z.object({
  name: z.string().min(1, "模板名称不能为空"),
  slug: z.string().min(1, "模板标识不能为空").optional(),
  description: z.string().optional(),
  fields: z.array(fieldSchema).min(1, "至少需要一个字段"),
  webhook_urls: z.array(z.string().url()).default([]).optional(),
  webhook_headers: z.record(z.string()).default({}).optional(),
  push_mode: z.enum(["manual", "auto"]).default("manual").optional(),
  active: z.boolean().default(true).optional()
});

function hasValue(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim() !== "";
  return true;
}

function getFieldValueWithDefault(field, data) {
  const value = data?.[field.key];

  if (hasValue(value)) {
    return value;
  }

  if (hasValue(field.defaultValue)) {
    return field.defaultValue;
  }

  return value;
}

function toCheckboxValue(value) {
  if (typeof value === "string") {
    return ["true", "1", "yes", "on", "是"].includes(value.trim().toLowerCase());
  }

  return Boolean(value);
}

export function validateSubmissionData(template, data, { includeAdminOnly = false } = {}) {
  const errors = {};
  const normalized = {};

  for (const field of template.fields || []) {
    if (field.adminOnly && !includeAdminOnly) {
      continue;
    }

    const value = getFieldValueWithDefault(field, data);

    if (field.required && !hasValue(value)) {
      errors[field.key] = `${field.label}不能为空`;
      continue;
    }

    if (!hasValue(value)) {
      normalized[field.key] = field.type === "checkbox" ? false : "";
      continue;
    }

    if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
      errors[field.key] = "邮箱格式不正确";
    }

    if (field.type === "select" && Array.isArray(field.options) && field.options.length > 0) {
      if (!field.options.includes(String(value))) {
        errors[field.key] = "选项不在允许范围内";
      }
    }

    if (field.type === "multiselect" && Array.isArray(field.options) && field.options.length > 0) {
      const selected = String(value).split("+").map((v) => v.trim()).filter(Boolean);
      const invalid = selected.filter((v) => !field.options.includes(v));
      if (invalid.length > 0) {
        errors[field.key] = "包含不在允许范围内的选项";
      }
    }

    normalized[field.key] = field.type === "checkbox" ? toCheckboxValue(value) : String(value).trim();
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    data: normalized
  };
}
