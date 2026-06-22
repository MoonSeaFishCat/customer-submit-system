# 筛选功能增强说明

## 新增筛选维度

### 1. 快速日期范围
- **今天**: 筛选今天的提交
- **昨天**: 筛选昨天的提交
- **最近7天**: 筛选最近7天的提交
- **最近30天**: 筛选最近30天的提交
- **本月**: 筛选本月的提交
- **上月**: 筛选上个月的提交
- **自定义范围**: 手动选择开始和结束日期

### 2. 推送状态筛选
- **pending**: 待推送
- **pushing**: 推送中
- **success**: 推送成功
- **failed**: 推送失败
- **not_configured**: 未配置Webhook

### 3. ERP订单状态筛选
- **有关联订单**: 已查询到ERP订单
- **无关联订单**: 未查询到ERP订单
- **异常订单**: 订单数量不匹配等异常
- **正常订单**: 订单数量匹配，无异常

### 4. IP地址筛选
- 支持完整IP地址搜索
- 支持部分IP地址匹配（如 192.168）

### 5. 高级筛选折叠面板
- 默认隐藏高级筛选项，保持界面简洁
- 点击展开后显示推送状态、ERP状态、IP地址筛选
- 显示已选中的高级筛选项数量

### 6. 导出Excel功能
- 根据当前筛选条件导出数据
- 支持所有筛选维度的组合

## 使用方式

1. **基础筛选**: 直接使用模板、状态、来源、关键词筛选
2. **日期筛选**: 使用快速日期范围或自定义日期
3. **高级筛选**: 点击"高级筛选"展开更多筛选项
4. **组合查询**: 所有筛选条件支持组合使用
5. **导出数据**: 设置筛选条件后点击"导出Excel"

## 技术实现

### 前端
- [components/submission/SubmissionFilters.js](components/submission/SubmissionFilters.js) - 筛选器UI组件
- [hooks/useSubmissionList.js](hooks/useSubmissionList.js) - 状态管理
- [components/admin-submission-list.js](components/admin-submission-list.js) - 主组件

### 后端
- [app/api/submissions/route.js](app/api/submissions/route.js) - API路由
- [lib/db.js](lib/db.js) - 数据库查询逻辑

## 筛选参数说明

| 参数 | 类型 | 说明 |
|------|------|------|
| template | string | 模板slug |
| status | string | 提交状态 |
| source | string | 来源 |
| search | string | 关键词（搜索ID、数据、IP） |
| startDate | string | 开始日期 |
| endDate | string | 结束日期 |
| pushStatus | string | 推送状态 |
| erpStatus | string | ERP订单状态 |
| ip | string | IP地址（支持模糊匹配） |

## 性能优化

- 所有筛选条件使用参数化查询，防止SQL注入
- 支持分页查询，避免一次性加载大量数据
- IP地址筛选使用LIKE查询，支持前缀匹配
- ERP状态筛选基于JSON字段，性能良好
