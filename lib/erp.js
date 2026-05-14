import { requestCookie, getCachedCookie } from "@/lib/ws-cookie-client";

const ERP_BASE = process.env.ERP_BASE_URL || "https://erpb.superboss.cc";
const ERP_COMPANY_ID = process.env.ERP_COMPANY_ID || "53771";
const ERP_PLATFORM = process.env.ERP_PLATFORM || "erp";
const ERP_STORE = process.env.ERP_STORE || "erp";
const ERP_ACCOUNT = process.env.ERP_ACCOUNT || "";
const ERP_PASSWORD = process.env.ERP_PASSWORD || "";

// fieldMapping 来自 ERP 响应，将缩写字段还原为可读名称
const FIELD_MAP = {
  a: "tid", b: "sid", c: "taobaoId", d: "waveId", e: "status", f: "chStatus",
  g: "created", h: "isRefund", i: "isExcep", j: "isStockOut", k: "isHalt",
  l: "expressStatus", m: "deliverStatus", n: "assemblyStatus", o: "mergeSplitType",
  p: "checkManualMergeCount", q: "payment", r: "saleFee", s: "postFee",
  t: "actualPostFee", u: "itemCount", v: "itemKindCount", w: "expressTemplateId",
  x: "expressTemplateName", y: "outSid", z: "expressTemplateType",
  aa: "expressCode", ab: "canDelivered", ac: "ydId", ad: "buyerMessage",
  ae: "sellerMemo", af: "sellerMemoUpdate", ag: "sellerFlag", ah: "shopFlag",
  ai: "shopName", aj: "payTime", ak: "receiverName", ar: "receiverMobile",
  as: "receiverPhone", at: "receiverState", au: "receiverCity",
  av: "receiverDistrict", aw: "receiverAddress", ax: "receiverZip",
  ay: "buyerNick", az: "type", ba: "alipayId", bb: "invoiceName",
  br: "consignTime", bs: "totalFee", bt: "discountFee", bv: "paymentDisplay",
  bz: "isPackage", ca: "source", cc: "weight", cd: "netWeight", ce: "cost",
  ci: "index", cj: "warehouseId", ck: "warehouseName", cl: "sysStatus",
  cr: "stockStatus", ct: "auditTime", cv: "userId", cw: "enableStatus",
  cz: "shopSource", db: "columnPayment", dh: "mergeType", di: "mergeSid",
  dj: "splitType", dk: "splitSid", dv: "expressName", dy: "tradeFrom",
  e: "status", ea: "isHandlerMessageDisplay", eb: "isHandlerMemoDisplay",
  ef: "buyerName", eg: "itemImage", eh: "outerId", ei: "theoryPostFee",
  f: "chStatus", fa: "sysConsigned", fb: "isUpload", fc: "unifiedStatus",
  fd: "acPayment", fe: "columnAcPayment", ff: "ptConsignTime",
  fk: "grossProfitDisplay", fs: "ifPlatformFx", g: "created",
  gd: "tids", ge: "shortId", gf: "waveShortId", gh: "receiverStreet",
  gj: "addressHandled", gk: "openUid", gl: "volume", gm: "originSysStatus",
  gt: "shopSourceName", gw: "exceptNames", gx: "grossProfit",
  gy: "propertiesName", h: "isRefund", hb: "logisticsCompanyName",
  hc: "buyerNeedEncode", hn: "payAmount", ho: "orderPayment",
  hr: "tmallAsdpAdsTypeSet", ht: "promiseDeliveryTime", hu: "sortString",
  ix: "packageStatus", l: "expressStatus", m: "deliverStatus",
  q: "payment", r: "saleFee", s: "postFee", st: "signTime",
  t: "actualPostFee", u: "itemCount", v: "itemKindCount",
  w: "expressTemplateId", x: "expressTemplateName", y: "outSid",
  z: "expressTemplateType", za: "printCount",
};

function expandFields(raw, mapping) {
  if (!raw || typeof raw !== "object") return raw;
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    const name = mapping[k] || k;
    out[name] = v;
  }
  return out;
}

async function getErpCookie() {
  if (!ERP_ACCOUNT || !ERP_PASSWORD) {
    throw new Error("未配置 ERP_ACCOUNT / ERP_PASSWORD 环境变量");
  }

  // 先用缓存
  const cached = getCachedCookie(ERP_PLATFORM, ERP_STORE, ERP_ACCOUNT);
  if (cached?.cookie) return cached.cookie;

  console.log("[ERP-CK] 请求 Cookie, platform=", ERP_PLATFORM, "store=", ERP_STORE, "account=", ERP_ACCOUNT);
  const result = await requestCookie({
    platform: ERP_PLATFORM,
    store: ERP_STORE,
    account: ERP_ACCOUNT,
    password: ERP_PASSWORD,
    timeout: 0, // 无限等待，直到服务端推送 cookie
  });

  console.log("[ERP-CK] WS 响应:", JSON.stringify(result)?.slice(0, 300));

  if (!result?.cookie) {
    throw new Error(result?.message || "获取 ERP Cookie 失败");
  }
  return result.cookie;
}

async function tradeSearch(params, cookie) {
  const body = new URLSearchParams({
    api_name: "trade_search",
    useHasNext: "1",
    queryId: "62",
    order: "desc",
    pageNo: "1",
    pageSize: "50",
    sid: "",
    shortId: "",
    tid: "",
    uniqueCodes: "",
    deliverStatus: "",
    outSid: "",
    buyerNick: "",
    isExcep: "",
    expressStatus: "",
    userId: "",
    secondUserId: "",
    warehouseId: "",
    cnStartTime: "",
    cnEndTime: "",
    minutesAfterPaidOrderAreNotDisplayed: "0",
    isCancel: "",
    key: "itemTitle",
    queryType: "0",
    spcAuthorName: "",
    spcAuthorId: "",
    excludeSellerFlags: "",
    sellerFlag: "",
    itemTagIdsParamsStr: "",
    text: "",
    skuProp: "",
    platSkuProp: "",
    skuOuterId: "",
    itemTitle: "",
    highlight: "false",
    _t: String(Date.now()),
    field: "pay_time",
    orderFields: "id,oid,skuid,title,sysTitle,shortTitle,skuPropertiesName,sysSkuPropertiesAlias,sysOuterId,sysRemark,outerId,platSkuPropertiesName,picPath,sysPicPath,num,refundStatus,mainOuterId,giftNum,source,type,platOuterId,platFormTitle,outerIid,skuShortTitle,orderExt,platGiftOrder,numIid,skuId",
    needOrder: "0",
    useCompress: "1",
    ...params,
  });

  const res = await fetch(`${ERP_BASE}/trade/search`, {
    method: "POST",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
      "Accept": "application/json, text/javascript, */*; q=0.01",
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "companyid": ERP_COMPANY_ID,
      "x-requested-with": "XMLHttpRequest",
      "module-path": "/trade/process/",
      "bx-v": "2.5.11",
      "origin": ERP_BASE,
      "referer": `${ERP_BASE}/index.html`,
      "accept-language": "zh-CN,zh;q=0.9",
      "Cookie": cookie,
    },
    body: body.toString(),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`ERP HTTP ${res.status}`);
  return res.json();
}

/**
 * 通过旺旺ID或订单号查询 ERP 订单列表（最多50条）。
 * 先按旺旺ID查，无结果再按订单号查。
 * Cookie 失效（result=901）时自动刷新一次后重试。
 *
 * @param {string} query  旺旺ID 或 订单号
 * @returns {Promise<object[]>}  订单列表（已展开字段），无结果返回 []
 */
export async function searchErpOrders(query) {
  if (!query) return [];

  let cookie = await getErpCookie();

  async function doSearch(q, isTid) {
    const params = isTid
      ? { tid: q, highlight: "true", highlightTid: q }
      : { buyerNick: q };
    const json = await tradeSearch(params, cookie);

    if (json?.result === 901) {
      const result = await requestCookie({
        platform: ERP_PLATFORM,
        store: ERP_STORE,
        account: ERP_ACCOUNT,
        password: ERP_PASSWORD,
        timeout: 0,
      });
      if (!result?.cookie) throw new Error("ERP Cookie 刷新失败");
      cookie = result.cookie;
      const json2 = await tradeSearch(params, cookie);
      if (json2?.result === 901) throw new Error("ERP Cookie 刷新后仍然失效");
      return json2;
    }
    return json;
  }

  // 先按旺旺ID查
  const byNick = await doSearch(query, false);
  const list = byNick?.data?.list;
  if (Array.isArray(list) && list.length > 0) {
    const mapping = byNick.data.fieldMapping || FIELD_MAP;
    return list.map((o) => normalizeOrder(o, mapping));
  }

  // 无结果则按订单号查
  const byTid = await doSearch(query, true);
  const list2 = byTid?.data?.list;
  if (Array.isArray(list2) && list2.length > 0) {
    const mapping = byTid.data.fieldMapping || FIELD_MAP;
    return list2.map((o) => normalizeOrder(o, mapping));
  }

  return [];
}

// 安装服务相关商品 ID 集合
const INSTALL_ITEM_IDS = new Set([
  "1051581569538",   // A8 上门安装
  "1051582141548",   // Q1 上门安装
  "1049851259551",   // C2 上门安装
  "3771342413533151692", // D2 上门安装
  "10210090243690",  // 京东上门安装
  "10113616546438",  // 京东上门安装
  "105059077014",    // T3 安装费补拍
  "1050590702360",   // T2 安装费补拍
]);

/**
 * 从订单列表中选出付款时间与提交时间最近的一条。
 * @param {object[]} orders
 * @param {string|number} submissionCreatedAt  提交时间（ISO 字符串或时间戳）
 * @returns {object|null}
 */
export function pickNearestOrder(orders, submissionCreatedAt) {
  if (!orders || orders.length === 0) return null;
  if (orders.length === 1) return orders[0];

  const base = new Date(submissionCreatedAt).getTime();
  if (Number.isNaN(base)) return orders[0];

  return orders.reduce((best, cur) => {
    const tBest = new Date(best.payTime || best.created || 0).getTime();
    const tCur = new Date(cur.payTime || cur.created || 0).getTime();
    return Math.abs(tCur - base) < Math.abs(tBest - base) ? cur : best;
  });
}

/**
 * 统计近15天内所有订单中安装服务商品的数量之和，与 submittedQty 对比。
 * 匹配规则：子订单的 numIid / outerIid / skuId 在 INSTALL_ITEM_IDS 中，
 * 或 sysTitle/title 含"AZ-上门安装服务"（兜底）。
 *
 * @param {object[]} orders  全量订单列表（已展开字段）
 * @param {string|number} submissionCreatedAt  提交时间
 * @param {number} submittedQty  提交表单中登记的安装数量
 * @returns {{ erpQty: number, submittedQty: number, match: boolean, anomaly: boolean, matchedOrders: string[] }}
 */
export function analyzeInstallCount(orders, submissionCreatedAt, submittedQty) {
  const base = new Date(submissionCreatedAt).getTime();
  const fifteenDaysMs = 15 * 24 * 60 * 60 * 1000;

  // 筛选近15天内、且非交易关闭的订单
  const CLOSED_STATUSES = new Set(["TRADE_CLOSED", "TRADE_CLOSED_BY_TAOBAO", "CLOSED", "closed"]);
  const recentOrders = Array.isArray(orders)
    ? orders.filter((o) => {
        const t = new Date(o.payTime || o.created || 0).getTime();
        const inRange = !Number.isNaN(t) && Math.abs(t - base) <= fifteenDaysMs;
        const isClosed = CLOSED_STATUSES.has(String(o.status || "")) ||
          String(o.chStatus || "").includes("关闭") ||
          String(o.sysStatus || "").includes("CLOSED");
        return inRange && !isClosed;
      })
    : [];

  let erpQty = 0;
  const matchedOrders = [];

  for (const order of recentOrders) {
    const subOrders = Array.isArray(order.orders) ? order.orders : [];
    let orderInstallQty = 0;
    for (const o of subOrders) {
      const isInstallById =
        INSTALL_ITEM_IDS.has(String(o.numIid || "")) ||
        INSTALL_ITEM_IDS.has(String(o.outerIid || "")) ||
        INSTALL_ITEM_IDS.has(String(o.skuId || ""));
      const isInstallByTitle = String(o.sysTitle || o.title || "").includes("AZ-上门安装服务");
      if (isInstallById || isInstallByTitle) {
        orderInstallQty += Number(o.num) || 0;
      }
    }
    // 卖家备注含"安装"且订单本身没有安装商品时，按1台计入
    const sellerMemo = String(order.sellerMemo || "");
    if (orderInstallQty === 0 && sellerMemo.includes("安装")) {
      orderInstallQty = 1;
    }
    if (orderInstallQty > 0) {
      erpQty += orderInstallQty;
      matchedOrders.push(order.tid || order.sid || "");
    }
  }

  const qty = Number(submittedQty) || 0;
  return {
    erpQty,
    submittedQty: qty,
    match: erpQty === qty,
    anomaly: erpQty !== qty,
    matchedOrders,
  };
}

/**
 * 兼容旧调用：返回单条最近订单（不传 submissionCreatedAt 时返回第一条）。
 * @deprecated 优先使用 searchErpOrders + pickNearestOrder
 */
export async function searchErpOrder(query, submissionCreatedAt) {
  const orders = await searchErpOrders(query);
  if (orders.length === 0) return null;
  return submissionCreatedAt ? pickNearestOrder(orders, submissionCreatedAt) : orders[0];
}

function normalizeOrder(raw, mapping) {
  const order = expandFields(raw, mapping);

  // 时间戳转 ISO
  for (const key of ["payTime", "created", "consignTime", "auditTime", "ptConsignTime", "signTime"]) {
    if (order[key] && typeof order[key] === "number" && order[key] > 1000000000000) {
      order[key] = new Date(order[key]).toISOString();
    }
  }

  // 展开子订单字段
  if (Array.isArray(order.orders)) {
    order.orders = order.orders.map((o) => expandFields(o, mapping));
  }

  return order;
}
