"use client";

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Select } from "@/components/ui";
import { useEffect, useMemo, useState } from "react";

/**
 * 提交记录筛选器组件（增强版 - 支持字段筛选）
 */
export default function SubmissionFilters({
  templateItems,
  templateSlug,
  setTemplateSlug,
  status,
  setStatus,
  source,
  setSource,
  keyword,
  setKeyword,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  pageSize,
  setPageSize,
  pushStatus,
  setPushStatus,
  erpStatus,
  setErpStatus,
  ipAddress,
  setIpAddress,
  dateRange,
  setDateRange,
  fieldFilters,
  setFieldFilters,
  total,
  page,
  totalPages,
  loading,
  onSearch,
  onReset,
}) {
  const [showFieldFilters, setShowFieldFilters] = useState(false);

  // 当前模板
  const currentTemplate = useMemo(
    () => templateItems.find((t) => t.slug === templateSlug) || templateItems[0],
    [templateItems, templateSlug]
  );

  // 当前模板的字段列表
  const currentFields = useMemo(
    () => currentTemplate?.fields || [],
    [currentTemplate]
  );

  // 可筛选的字段（排除某些类型）
  const filterableFields = useMemo(
    () => currentFields.filter((f) => !["file", "image"].includes(f.type)),
    [currentFields]
  );

  // 添加字段筛选条件
  function addFieldFilter() {
    if (filterableFields.length === 0) return;
    const newFilter = {
      id: Date.now(),
      field: filterableFields[0].key,
      operator: "equals",
      value: "",
    };
    setFieldFilters([...fieldFilters, newFilter]);
    setShowFieldFilters(true);
  }

  // 删除字段筛选条件
  function removeFieldFilter(id) {
    setFieldFilters(fieldFilters.filter((f) => f.id !== id));
  }

  // 更新字段筛选条件
  function updateFieldFilter(id, updates) {
    setFieldFilters(fieldFilters.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  }

  // 获取字段定义
  function getFieldDefinition(key) {
    return currentFields.find((f) => f.key === key);
  }
  // 快速日期范围选择
  useEffect(() => {
    if (dateRange === "all") {
      setDateFrom("");
      setDateTo("");
      return;
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let from = null;

    switch (dateRange) {
      case "today":
        from = today;
        break;
      case "yesterday":
        from = new Date(today);
        from.setDate(from.getDate() - 1);
        break;
      case "last7days":
        from = new Date(today);
        from.setDate(from.getDate() - 7);
        break;
      case "last30days":
        from = new Date(today);
        from.setDate(from.getDate() - 30);
        break;
      case "thisMonth":
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "lastMonth":
        from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        setDateFrom(from.toISOString().split("T")[0]);
        setDateTo(lastMonthEnd.toISOString().split("T")[0]);
        return;
    }

    if (from) {
      setDateFrom(from.toISOString().split("T")[0]);
      setDateTo(today.toISOString().split("T")[0]);
    }
  }, [dateRange]);

  // 高级筛选项数量统计
  const advancedFilterCount = [pushStatus, erpStatus, ipAddress].filter(Boolean).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>筛选查询</CardTitle>
        <CardDescription>
          支持模板、状态、来源、日期、推送状态、ERP状态、IP地址和关键词组合查询，点击查询从服务端加载数据。
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* 基础筛选 */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label>模板</Label>
            <Select value={templateSlug} onChange={(e) => setTemplateSlug(e.target.value)}>
              {templateItems.length === 0 ? <option value="">暂无模板</option> : null}
              {templateItems.map((t) => (
                <option key={t.id} value={t.slug}>{t.name}</option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label>状态</Label>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">全部状态</option>
              <option value="new">new - 新建</option>
              <option value="pending">pending - 待处理</option>
              <option value="processing">processing - 处理中</option>
              <option value="completed">completed - 已完成</option>
              <option value="failed">failed - 失败</option>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>来源</Label>
            <Select value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">全部来源</option>
              <option value="web">web - 网页提交</option>
              <option value="api">api - API提交</option>
              <option value="admin">admin - 管理员创建</option>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>关键词</Label>
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="编号、姓名、电话、内容..."
              onKeyDown={(e) => e.key === "Enter" && onSearch()}
            />
          </div>
        </div>

        {/* 日期筛选 */}
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label>快速日期</Label>
            <Select value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
              <option value="all">全部日期</option>
              <option value="today">今天</option>
              <option value="yesterday">昨天</option>
              <option value="last7days">最近7天</option>
              <option value="last30days">最近30天</option>
              <option value="thisMonth">本月</option>
              <option value="lastMonth">上月</option>
              <option value="custom">自定义范围</option>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>开始日期</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setDateRange("custom");
              }}
            />
          </div>

          <div className="space-y-2">
            <Label>结束日期</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setDateRange("custom");
              }}
            />
          </div>
        </div>

        {/* 高级筛选 */}
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
            高级筛选 {advancedFilterCount > 0 && `(${advancedFilterCount} 项已选)`}
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label>推送状态</Label>
              <Select value={pushStatus} onChange={(e) => setPushStatus(e.target.value)}>
                <option value="">全部</option>
                <option value="pending">pending - 待推送</option>
                <option value="pushing">pushing - 推送中</option>
                <option value="success">success - 推送成功</option>
                <option value="failed">failed - 推送失败</option>
                <option value="not_configured">not_configured - 未配置</option>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>ERP订单状态</Label>
              <Select value={erpStatus} onChange={(e) => setErpStatus(e.target.value)}>
                <option value="">全部</option>
                <option value="has_order">有关联订单</option>
                <option value="no_order">无关联订单</option>
                <option value="anomaly">异常订单</option>
                <option value="normal">正常订单</option>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>IP地址</Label>
              <Input
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                placeholder="完整IP或部分IP"
                onKeyDown={(e) => e.key === "Enter" && onSearch()}
              />
            </div>
          </div>
        </details>

        {/* 字段筛选 */}
        {filterableFields.length > 0 && (
          <details className="mt-3" open={showFieldFilters}>
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
              字段筛选 {fieldFilters.length > 0 && `(${fieldFilters.length} 个条件)`}
            </summary>
            <div className="mt-3 space-y-2">
              {fieldFilters.map((filter) => {
                const field = getFieldDefinition(filter.field);
                return (
                  <div key={filter.id} className="grid gap-2 sm:grid-cols-12 items-end">
                    <div className="space-y-1 sm:col-span-3">
                      <Label className="text-xs">字段</Label>
                      <Select
                        value={filter.field}
                        onChange={(e) => updateFieldFilter(filter.id, { field: e.target.value })}
                      >
                        {filterableFields.map((f) => (
                          <option key={f.key} value={f.key}>
                            {f.label || f.key}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs">条件</Label>
                      <Select
                        value={filter.operator}
                        onChange={(e) => updateFieldFilter(filter.id, { operator: e.target.value })}
                      >
                        <option value="equals">等于</option>
                        <option value="not_equals">不等于</option>
                        <option value="contains">包含</option>
                        <option value="not_contains">不包含</option>
                        <option value="starts_with">开头是</option>
                        <option value="ends_with">结尾是</option>
                        {["number"].includes(field?.type) && (
                          <>
                            <option value="gt">大于</option>
                            <option value="gte">大于等于</option>
                            <option value="lt">小于</option>
                            <option value="lte">小于等于</option>
                          </>
                        )}
                        <option value="empty">为空</option>
                        <option value="not_empty">不为空</option>
                      </Select>
                    </div>

                    <div className="space-y-1 sm:col-span-6">
                      <Label className="text-xs">值</Label>
                      {field?.type === "select" || field?.type === "radio" ? (
                        <Select
                          value={filter.value}
                          onChange={(e) => updateFieldFilter(filter.id, { value: e.target.value })}
                          disabled={["empty", "not_empty"].includes(filter.operator)}
                        >
                          <option value="">请选择</option>
                          {(field.options || []).map((opt, i) => (
                            <option key={i} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </Select>
                      ) : field?.type === "checkbox" ? (
                        <Select
                          value={filter.value}
                          onChange={(e) => updateFieldFilter(filter.id, { value: e.target.value })}
                          disabled={["empty", "not_empty"].includes(filter.operator)}
                        >
                          <option value="">请选择</option>
                          <option value="true">已勾选</option>
                          <option value="false">未勾选</option>
                        </Select>
                      ) : (
                        <Input
                          type={field?.type === "number" ? "number" : "text"}
                          value={filter.value}
                          onChange={(e) => updateFieldFilter(filter.id, { value: e.target.value })}
                          placeholder={
                            ["empty", "not_empty"].includes(filter.operator)
                              ? "无需填写"
                              : "输入筛选值"
                          }
                          disabled={["empty", "not_empty"].includes(filter.operator)}
                          onKeyDown={(e) => e.key === "Enter" && onSearch()}
                        />
                      )}
                    </div>

                    <div className="sm:col-span-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeFieldFilter(filter.id)}
                        className="w-full"
                      >
                        删除
                      </Button>
                    </div>
                  </div>
                );
              })}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addFieldFilter}
                disabled={filterableFields.length === 0}
              >
                + 添加字段条件
              </Button>
            </div>
          </details>
        )}

        {/* 操作按钮和分页信息 */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button type="button" onClick={onSearch} disabled={loading}>
            {loading ? "查询中..." : "查询"}
          </Button>
          <Button type="button" variant="outline" onClick={onReset} disabled={loading}>
            重置
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const params = new URLSearchParams();
              if (templateSlug) params.set("template", templateSlug);
              if (status) params.set("status", status);
              if (source) params.set("source", source);
              if (keyword) params.set("search", keyword);
              if (dateFrom) params.set("startDate", dateFrom);
              if (dateTo) params.set("endDate", dateTo);
              if (pushStatus) params.set("pushStatus", pushStatus);
              if (erpStatus) params.set("erpStatus", erpStatus);
              if (ipAddress) params.set("ip", ipAddress);
              params.set("export", "true");
              window.open("/api/submissions?" + params.toString(), "_blank");
            }}
            disabled={loading || total === 0}
          >
            导出Excel
          </Button>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">每页</span>
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              {[20, 50, 100, 200, 500].map((n) => (
                <option key={n} value={n}>{n} 条</option>
              ))}
            </select>
          </div>
          <div className="text-sm text-muted-foreground">
            共 {total} 条，第 {page} / {totalPages} 页
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
