"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Select, Textarea } from "@/components/ui";

const FIELD_TYPES = [
  { type: "text", label: "单行文本", icon: "T", description: "姓名、标题、短文本" },
  { type: "tel", label: "电话", icon: "☎", description: "手机号、座机" },
  { type: "email", label: "邮箱", icon: "@", description: "邮箱地址" },
  { type: "number", label: "数字", icon: "#", description: "数量、金额、评分" },
  { type: "textarea", label: "多行文本", icon: "¶", description: "备注、详细说明" },
  { type: "select", label: "下拉选择", icon: "▾", description: "业务类型、状态选项" },
  { type: "date", label: "日期", icon: "📅", description: "预约日期、跟进日期" },
  { type: "checkbox", label: "复选框", icon: "☑", description: "确认、是否类字段" }
];

const TYPE_LABELS = Object.fromEntries(FIELD_TYPES.map((item) => [item.type, item.label]));

const emptyField = {
  key: "",
  label: "",
  type: "text",
  required: false,
  placeholder: "",
  help: "",
  optionsText: "",
  width: "full",
  defaultValue: ""
};

function createField(type = "text", index = 1) {
  const item = FIELD_TYPES.find((fieldType) => fieldType.type === type) || FIELD_TYPES[0];

  return {
    ...emptyField,
    key: `${type}_${Date.now().toString(36)}_${index}`,
    label: item.label,
    type,
    placeholder: type === "select" ? "请选择" : `请输入${item.label}`,
    optionsText: type === "select" ? "选项一\n选项二\n选项三" : "",
    width: type === "textarea" ? "full" : "half"
  };
}

function normalizeField(field = {}) {
  return {
    key: field.key || "",
    label: field.label || "",
    type: field.type || "text",
    required: Boolean(field.required),
    placeholder: field.placeholder || "",
    help: field.help || "",
    optionsText: Array.isArray(field.options) ? field.options.join("\n") : "",
    width: field.width || "full",
    defaultValue: field.defaultValue || ""
  };
}

function toApiField(field) {
  const result = {
    key: field.key.trim(),
    label: field.label.trim(),
    type: field.type || "text",
    required: Boolean(field.required)
  };

  if (field.placeholder?.trim()) result.placeholder = field.placeholder.trim();
  if (field.help?.trim()) result.help = field.help.trim();
  if (field.width) result.width = field.width;
  if (field.defaultValue?.trim()) result.defaultValue = field.defaultValue.trim();

  if (field.type === "select") {
    result.options = field.optionsText
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return result;
}

function FieldPreview({ field }) {
  const commonClass = "mt-2 h-9 rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground";

  if (field.type === "textarea") {
    return <div className="mt-2 min-h-20 rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">{field.placeholder || "多行文本"}</div>;
  }

  if (field.type === "select") {
    const firstOption = field.optionsText.split("\n").find(Boolean) || "请选择";
    return <div className={commonClass}>{firstOption}</div>;
  }

  if (field.type === "checkbox") {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">
        <span className="h-4 w-4 rounded border" />
        {field.placeholder || "是/否"}
      </div>
    );
  }

  return <div className={commonClass}>{field.placeholder || `请输入${field.label || "内容"}`}</div>;
}

export default function TemplateEditor({ templates }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState("");
  const selected = templates.find((template) => template.id === selectedId);

  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    webhook_urls: "",
    webhook_headers: "{}",
    active: true
  });
  const [fields, setFields] = useState([
    { ...createField("text", 1), key: "name", label: "客户姓名", required: true, width: "half" },
    { ...createField("tel", 2), key: "phone", label: "联系电话", required: true, width: "half" },
    { ...createField("textarea", 3), key: "message", label: "详细说明", width: "full" }
  ]);
  const [activeFieldIndex, setActiveFieldIndex] = useState(0);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [dragFieldIndex, setDragFieldIndex] = useState(null);

  const activeField = fields[activeFieldIndex] || null;

  const publicUrl = useMemo(() => {
    if (!selected?.slug && !form.slug) return "";
    return `/submit/${selected?.slug || form.slug}`;
  }, [selected?.slug, form.slug]);

  function notify(text, type = "info") {
    setMessage(text);
    setMessageType(type);
  }

  function loadTemplate(template) {
    setSelectedId(template.id);
    setForm({
      name: template.name,
      slug: template.slug,
      description: template.description || "",
      webhook_urls: (template.webhook_urls || []).join("\n"),
      webhook_headers: JSON.stringify(template.webhook_headers || {}, null, 2),
      active: Boolean(template.active)
    });
    const normalizedFields = (template.fields || []).map(normalizeField);
    setFields(normalizedFields);
    setActiveFieldIndex(normalizedFields.length > 0 ? 0 : -1);
    notify(`已载入模板「${template.name}」`, "success");
  }

  function resetCreate() {
    setSelectedId("");
    setForm({
      name: "",
      slug: "",
      description: "",
      webhook_urls: "",
      webhook_headers: "{}",
      active: true
    });
    const initial = [createField("text", 1)];
    setFields(initial);
    setActiveFieldIndex(0);
    notify("已切换到新建模板模式", "info");
  }

  function addField(type = "text") {
    const nextField = createField(type, fields.length + 1);
    setFields((current) => [...current, nextField]);
    setActiveFieldIndex(fields.length);
    notify(`已添加控件：${TYPE_LABELS[type] || type}`, "success");
  }

  function updateActiveField(patch) {
    if (activeFieldIndex < 0) return;
    setFields((current) => current.map((field, index) => (index === activeFieldIndex ? { ...field, ...patch } : field)));
  }

  function removeField(index) {
    const field = fields[index];
    setFields((current) => current.filter((_, i) => i !== index));
    setActiveFieldIndex((current) => {
      if (fields.length <= 1) return -1;
      if (current === index) return Math.max(0, index - 1);
      if (current > index) return current - 1;
      return current;
    });
    notify(`已删除控件：${field?.label || field?.key || index + 1}`, "info");
  }

  function duplicateField(index) {
    const source = fields[index];
    const copied = {
      ...source,
      key: `${source.key}_copy_${Date.now().toString(36)}`,
      label: `${source.label} 副本`
    };

    setFields((current) => {
      const next = [...current];
      next.splice(index + 1, 0, copied);
      return next;
    });
    setActiveFieldIndex(index + 1);
    notify("已复制控件", "success");
  }

  function moveField(fromIndex, toIndex) {
    if (toIndex < 0 || toIndex >= fields.length || fromIndex === toIndex) return;

    setFields((current) => {
      const next = [...current];
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item);
      return next;
    });
    setActiveFieldIndex(toIndex);
    notify("控件顺序已调整", "info");
  }

  function handlePaletteDragStart(event, type) {
    event.dataTransfer.setData("field-type", type);
    event.dataTransfer.effectAllowed = "copy";
  }

  function handleCanvasDrop(event) {
    event.preventDefault();
    const type = event.dataTransfer.getData("field-type");
    if (type) addField(type);
  }

  function handleFieldDrop(event, targetIndex) {
    event.preventDefault();
    event.stopPropagation();

    const type = event.dataTransfer.getData("field-type");
    if (type) {
      const nextField = createField(type, fields.length + 1);
      setFields((current) => {
        const next = [...current];
        next.splice(targetIndex, 0, nextField);
        return next;
      });
      setActiveFieldIndex(targetIndex);
      notify(`已插入控件：${TYPE_LABELS[type] || type}`, "success");
      return;
    }

    if (dragFieldIndex !== null) {
      moveField(dragFieldIndex, targetIndex);
      setDragFieldIndex(null);
    }
  }

  async function save() {
    setMessage("");

    let webhookHeaders;
    try {
      webhookHeaders = JSON.parse(form.webhook_headers || "{}");
    } catch (error) {
      notify(`Webhook Headers JSON 格式错误：${error.message}`, "error");
      return;
    }

    const apiFields = fields.map(toApiField);
    const invalidField = apiFields.find((field) => !field.key || !field.label);
    if (invalidField) {
      notify("字段标识和字段名称不能为空，请检查右侧属性面板", "error");
      return;
    }

    const duplicatedKeys = apiFields
      .map((field) => field.key)
      .filter((key, index, arr) => arr.indexOf(key) !== index);
    if (duplicatedKeys.length > 0) {
      notify(`字段标识重复：${duplicatedKeys.join("，")}`, "error");
      return;
    }

    const invalidSelect = apiFields.find((field) => field.type === "select" && (!field.options || field.options.length === 0));
    if (invalidSelect) {
      notify(`下拉字段「${invalidSelect.label}」至少需要一个选项`, "error");
      return;
    }

    const payload = {
      name: form.name,
      slug: selected ? form.slug : undefined,
      description: form.description,
      fields: apiFields,
      webhook_urls: form.webhook_urls.split("\n").map((item) => item.trim()).filter(Boolean),
      webhook_headers: webhookHeaders,
      active: form.active
    };

    const res = await fetch(selected ? `/api/templates/${selected.id}` : "/api/templates", {
      method: selected ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });

    const json = await res.json();
    if (!res.ok) {
      notify(JSON.stringify(json.error || json), "error");
      return;
    }

    notify(selected ? "模板已保存" : "模板已创建", "success");
    router.refresh();
  }

  async function toggleTemplateActive(template) {
    setMessage("");

    const res = await fetch(`/api/templates/${template.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: !template.active })
    });

    const json = await res.json();

    if (!res.ok) {
      notify(JSON.stringify(json.error || json), "error");
      return;
    }

    if (selectedId === template.id) {
      setForm((current) => ({ ...current, active: Boolean(json.template.active) }));
    }

    notify(json.template.active ? `模板「${template.name}」已启用` : `模板「${template.name}」已禁用`, "success");
    router.refresh();
  }

  async function deleteTemplateItem(template) {
    if (!template) {
      notify("请先选择要删除的模板", "error");
      return;
    }

    const confirmed = window.confirm(`确定删除模板「${template.name}」吗？删除后公开提交页将无法使用该模板，但历史提交记录仍会保留。`);
    if (!confirmed) {
      notify("已取消删除操作", "info");
      return;
    }

    setMessage("");

    const res = await fetch(`/api/templates/${template.id}`, {
      method: "DELETE"
    });

    const json = await res.json();

    if (!res.ok) {
      notify(JSON.stringify(json.error || json), "error");
      return;
    }

    if (selectedId === template.id) {
      resetCreate();
    }

    notify(`模板「${json.template.name}」已删除`, "success");
    router.refresh();
  }

  async function deleteSelectedTemplate() {
    await deleteTemplateItem(selected);
  }

  return (
    <div className="space-y-4">
      {message ? (
        <div
          className={[
            "rounded-md border p-3 text-sm",
            messageType === "success" && "border-emerald-200 bg-emerald-50 text-emerald-700",
            messageType === "error" && "border-destructive/30 bg-destructive/10 text-destructive",
            messageType === "info" && "bg-muted text-muted-foreground"
          ].filter(Boolean).join(" ")}
        >
          {message}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[260px_1fr_320px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">模板列表</CardTitle>
              <CardDescription>选择模板进行编辑，或新建模板。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full" onClick={resetCreate}>新建模板</Button>
              <div className="max-h-[420px] space-y-3 overflow-auto pr-1">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className={`rounded-md border p-3 text-sm ${selectedId === template.id ? "border-primary bg-primary/5" : "hover:bg-accent"}`}
                  >
                    <button
                      type="button"
                      onClick={() => loadTemplate(template)}
                      className="block w-full text-left"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium">{template.name}</div>
                        <Badge variant={template.active ? "secondary" : "outline"}>
                          {template.active ? "启用" : "停用"}
                        </Badge>
                      </div>
                      <div className="text-muted-foreground">/{template.slug}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{template.fields?.length || 0} 个字段</div>
                    </button>
                    <div className="mt-3 flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={template.active ? "outline" : "secondary"}
                        onClick={() => toggleTemplateActive(template)}
                      >
                        {template.active ? "禁用" : "启用"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => loadTemplate(template)}
                      >
                        编辑
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteTemplateItem(template)}
                      >
                        删除
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">控件库</CardTitle>
              <CardDescription>像钉钉表单一样，拖拽控件到中间画布。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {FIELD_TYPES.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  draggable
                  onDragStart={(event) => handlePaletteDragStart(event, item.type)}
                  onClick={() => addField(item.type)}
                  className="flex items-center gap-3 rounded-md border p-3 text-left transition-colors hover:border-primary hover:bg-primary/5"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-sm font-semibold">{item.icon}</span>
                  <span>
                    <span className="block text-sm font-medium">{item.label}</span>
                    <span className="block text-xs text-muted-foreground">{item.description}</span>
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">基础信息</CardTitle>
              <CardDescription>配置模板名称、访问标识和启用状态。</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>模板名称</Label>
                  <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="例如：客户资料登记" />
                </div>
                <div className="space-y-2">
                  <Label>模板标识 slug</Label>
                  <Input
                    value={selected ? form.slug : "创建模板后自动生成"}
                    readOnly
                    className="bg-muted text-muted-foreground"
                  />
                  <p className="text-xs text-muted-foreground">slug 用于公开提交地址，新建模板保存成功后由系统随机生成。</p>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <Label>描述</Label>
                <Input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="用于说明此模板适用场景" />
              </div>

              {publicUrl ? (
                <div className="mt-4 rounded-md bg-muted p-3 text-sm">
                  公开提交地址：<code>{publicUrl}</code>
                </div>
              ) : null}

              <label className="mt-4 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
                启用模板
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">表单设计画布</CardTitle>
              <CardDescription>点击控件编辑属性；拖拽控件可调整顺序。</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className="min-h-[520px] rounded-lg border border-dashed bg-muted/30 p-4"
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleCanvasDrop}
              >
                {fields.length === 0 ? (
                  <div className="flex h-80 items-center justify-center rounded-md border border-dashed bg-background text-center text-sm text-muted-foreground">
                    从左侧控件库拖入控件，或点击控件快速添加
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {fields.map((field, index) => (
                      <div
                        key={`${field.key}-${index}`}
                        draggable
                        onDragStart={() => setDragFieldIndex(index)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => handleFieldDrop(event, index)}
                        onClick={() => setActiveFieldIndex(index)}
                        className={[
                          "group cursor-move rounded-lg border bg-background p-4 shadow-sm transition-all hover:border-primary",
                          field.width === "full" ? "md:col-span-2" : "",
                          activeFieldIndex === index ? "border-primary ring-2 ring-primary/20" : ""
                        ].join(" ")}
                      >
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium">
                              {field.label || "未命名字段"}
                              {field.required ? <span className="ml-1 text-destructive">*</span> : null}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {TYPE_LABELS[field.type]} · {field.key || "未设置 key"}
                            </div>
                          </div>
                          <div className="flex opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                            <Button type="button" variant="ghost" size="sm" onClick={(event) => { event.stopPropagation(); duplicateField(index); }}>复制</Button>
                            <Button type="button" variant="ghost" size="sm" onClick={(event) => { event.stopPropagation(); removeField(index); }}>删除</Button>
                          </div>
                        </div>
                        <FieldPreview field={field} />
                        {field.help ? <p className="mt-2 text-xs text-muted-foreground">{field.help}</p> : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Webhook 配置</CardTitle>
              <CardDescription>提交成功后向外部系统推送。</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>Webhook URL，每行一个</Label>
                <Textarea value={form.webhook_urls} onChange={(event) => setForm({ ...form, webhook_urls: event.target.value })} placeholder={"https://example.com/webhook\nhttps://example.com/notify"} />
              </div>

              <div className="mt-4 space-y-2">
                <Label>Webhook Headers JSON</Label>
                <Textarea className="font-mono" value={form.webhook_headers} onChange={(event) => setForm({ ...form, webhook_headers: event.target.value })} />
              </div>
            </CardContent>
          </Card>

          <div className="sticky bottom-4 z-10 flex flex-wrap gap-3 rounded-lg border bg-background/95 p-3 shadow-sm backdrop-blur">
            <Button onClick={save}>保存模板</Button>
            <Button variant="outline" onClick={resetCreate}>清空并新建</Button>
            {selected ? (
              <>
                <Button
                  variant={form.active ? "outline" : "secondary"}
                  onClick={() => toggleTemplateActive(selected)}
                >
                  {form.active ? "禁用当前模板" : "启用当前模板"}
                </Button>
                <Button variant="destructive" onClick={deleteSelectedTemplate}>
                  删除当前模板
                </Button>
              </>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          <Card className="xl:sticky xl:top-4">
            <CardHeader>
              <CardTitle className="text-base">控件属性</CardTitle>
              <CardDescription>配置当前选中控件的字段属性。</CardDescription>
            </CardHeader>
            <CardContent>
              {activeField ? (
                <div className="space-y-4">
                  <div className="rounded-md bg-muted p-3 text-sm">
                    正在编辑：<span className="font-medium">{activeField.label || activeField.key || "未命名字段"}</span>
                  </div>

                  <div className="space-y-2">
                    <Label>字段名称</Label>
                    <Input value={activeField.label} onChange={(event) => updateActiveField({ label: event.target.value })} />
                  </div>

                  <div className="space-y-2">
                    <Label>字段标识 key</Label>
                    <Input value={activeField.key} onChange={(event) => updateActiveField({ key: event.target.value })} />
                    <p className="text-xs text-muted-foreground">用于 API 数据字段名，建议英文、数字、下划线。</p>
                  </div>

                  <div className="space-y-2">
                    <Label>控件类型</Label>
                    <Select value={activeField.type} onChange={(event) => updateActiveField({ type: event.target.value })}>
                      {FIELD_TYPES.map((item) => (
                        <option key={item.type} value={item.type}>{item.label}</option>
                      ))}
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>布局宽度</Label>
                    <Select value={activeField.width} onChange={(event) => updateActiveField({ width: event.target.value })}>
                      <option value="full">整行</option>
                      <option value="half">半行</option>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>占位提示</Label>
                    <Input value={activeField.placeholder} onChange={(event) => updateActiveField({ placeholder: event.target.value })} />
                  </div>

                  <div className="space-y-2">
                    <Label>默认值</Label>
                    <Input value={activeField.defaultValue} onChange={(event) => updateActiveField({ defaultValue: event.target.value })} />
                  </div>

                  <div className="space-y-2">
                    <Label>帮助说明</Label>
                    <Input value={activeField.help} onChange={(event) => updateActiveField({ help: event.target.value })} />
                  </div>

                  {activeField.type === "select" ? (
                    <div className="space-y-2">
                      <Label>下拉选项，每行一个</Label>
                      <Textarea value={activeField.optionsText} onChange={(event) => updateActiveField({ optionsText: event.target.value })} />
                    </div>
                  ) : null}

                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={activeField.required} onChange={(event) => updateActiveField({ required: event.target.checked })} />
                    必填字段
                  </label>

                  <div className="flex flex-wrap gap-2 border-t pt-4">
                    <Button type="button" variant="outline" size="sm" onClick={() => duplicateField(activeFieldIndex)}>复制控件</Button>
                    <Button type="button" variant="destructive" size="sm" onClick={() => removeField(activeFieldIndex)}>删除控件</Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                  请在中间画布选择一个控件
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
