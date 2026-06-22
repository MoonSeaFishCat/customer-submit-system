// ERP 查询结果缓存
const erpCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 分钟

// 定期清理过期缓存
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of erpCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      erpCache.delete(key);
    }
  }
}, 60 * 1000); // 每分钟清理一次

export function getCachedErpOrders(query) {
  const cached = erpCache.get(query);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

export function setCachedErpOrders(query, orders) {
  erpCache.set(query, {
    data: orders,
    timestamp: Date.now(),
  });
}

export function clearErpCache() {
  erpCache.clear();
}
