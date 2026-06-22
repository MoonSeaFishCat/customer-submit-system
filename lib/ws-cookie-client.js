import net from "node:net";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

const WS_HOST = process.env.WS_COOKIE_HOST || "127.0.0.1";
const WS_PORT = parseInt(process.env.WS_COOKIE_PORT || "8765", 10);
const CACHE_FILE = process.env.WS_COOKIE_CACHE_FILE || "data/cookie_cache.json";

// ── 帧编解码 ────────────────────────────────────────────────

function encodeFrame(payload, opcode = 0x1) {
  const data = typeof payload === "string" ? Buffer.from(payload, "utf8") : payload;
  const len = data.length;

  let header;
  if (len <= 125) {
    header = Buffer.alloc(2);
    header[0] = 0x80 | opcode;
    header[1] = 0x80 | len;
  } else if (len <= 0xffff) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 0x80 | 127;
    // Node.js Buffer 不支持 writeUInt64BE，拆成两个 32 位写
    header.writeUInt32BE(Math.floor(len / 2 ** 32), 2);
    header.writeUInt32BE(len >>> 0, 6);
  }

  const maskKey = crypto.randomBytes(4);
  const masked = Buffer.allocUnsafe(len);
  for (let i = 0; i < len; i++) {
    masked[i] = data[i] ^ maskKey[i % 4];
  }

  return Buffer.concat([header, maskKey, masked]);
}

function decodeFrame(buf) {
  if (buf.length < 2) return { payload: null, consumed: 0 };

  const opcode = buf[0] & 0x0f;
  const masked = (buf[1] & 0x80) !== 0;
  let len = buf[1] & 0x7f;
  let idx = 2;

  if (len === 126) {
    if (buf.length < 4) return { payload: null, consumed: 0 };
    len = buf.readUInt16BE(2);
    idx = 4;
  } else if (len === 127) {
    if (buf.length < 10) return { payload: null, consumed: 0 };
    len = buf.readUInt32BE(6); // 只取低 32 位，够用
    idx = 10;
  }

  let maskKey = null;
  if (masked) {
    if (buf.length < idx + 4) return { payload: null, consumed: 0 };
    maskKey = buf.slice(idx, idx + 4);
    idx += 4;
  }

  if (buf.length < idx + len) return { payload: null, consumed: 0 };

  let payload = buf.slice(idx, idx + len);
  if (masked && maskKey) {
    payload = Buffer.from(payload);
    for (let i = 0; i < payload.length; i++) payload[i] ^= maskKey[i % 4];
  }

  const consumed = idx + len;

  if (opcode === 0x8) return { payload: "CLOSE", consumed };
  if (opcode === 0x9) return { payload: "PING", consumed };
  if (opcode === 0xa) return { payload: "PONG", consumed };

  return { payload: payload.toString("utf8"), consumed };
}

// ── 握手 ────────────────────────────────────────────────────

async function wsConnect(host, port, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const sock = new net.Socket();
    sock.setTimeout(timeoutMs);

    sock.connect(port, host, () => {
      const key = crypto.randomBytes(16).toString("base64");
      const req = [
        `GET / HTTP/1.1`,
        `Host: ${host}:${port}`,
        `Upgrade: websocket`,
        `Connection: Upgrade`,
        `Sec-WebSocket-Key: ${key}`,
        `Sec-WebSocket-Version: 13`,
        `\r\n`,
      ].join("\r\n");

      sock.write(req);

      let resp = Buffer.alloc(0);
      const onData = (chunk) => {
        resp = Buffer.concat([resp, chunk]);
        if (!resp.includes(Buffer.from("\r\n\r\n"))) return;

        sock.removeListener("data", onData);
        sock.setTimeout(0);

        const respStr = resp.toString("utf8");
        if (!respStr.startsWith("HTTP/1.1 101")) {
          sock.destroy();
          return reject(new Error(`WebSocket 握手失败: ${respStr.slice(0, 80)}`));
        }

        const expectedAccept = crypto
          .createHash("sha1")
          .update(key + WS_GUID)
          .digest("base64");

        if (!respStr.includes(`Sec-WebSocket-Accept: ${expectedAccept}`)) {
          sock.destroy();
          return reject(new Error("WebSocket 握手 Accept 不匹配"));
        }

        // 握手响应之后可能已经紧跟了 WS 帧数据，剥离出来备用
        const headerEnd = resp.indexOf(Buffer.from("\r\n\r\n")) + 4;
        const leftover = resp.slice(headerEnd);
        resolve({ sock, leftover });
      };

      sock.on("data", onData);
    });

    sock.once("error", reject);
    sock.once("timeout", () => {
      sock.destroy();
      reject(new Error("WebSocket 连接超时"));
    });
  });
}

// ── 读取一条完整 WS 消息 ─────────────────────────────────────

async function recvMessage(sock, state, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve(null); // 超时返回 null，由调用方决定重试还是退出
    }, timeoutMs);

    function tryDecode() {
      while (state.buf.length >= 2) {
        const { payload, consumed } = decodeFrame(state.buf);
        if (payload === null) break;
        state.buf = state.buf.slice(consumed);
        if (payload === "PING" || payload === "PONG") continue;
        if (payload === "CLOSE") {
          cleanup();
          return resolve(null);
        }
        cleanup();
        return resolve(payload);
      }
    }

    function onData(chunk) {
      state.buf = Buffer.concat([state.buf, chunk]);
      tryDecode();
    }

    function onError(err) {
      cleanup();
      reject(err);
    }

    function cleanup() {
      clearTimeout(timer);
      sock.removeListener("data", onData);
      sock.removeListener("error", onError);
    }

    sock.on("data", onData);
    sock.once("error", onError);

    // 可能握手时就已经有剩余数据
    if (state.buf.length > 0) tryDecode();
  });
}

// ── 缓存读写 ─────────────────────────────────────────────────

let cacheLock = Promise.resolve();

async function readCache() {
  try {
    if (!existsSync(CACHE_FILE)) return {};
    const content = await fs.readFile(CACHE_FILE, "utf8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}

async function writeCache(cache) {
  cacheLock = cacheLock.then(async () => {
    try {
      await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
      await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), "utf8");
    } catch {
      // 缓存写失败不影响主流程
    }
  });
  await cacheLock;
}

function cacheKey(platform, store, account) {
  return `${platform}|${store}|${account}`;
}

// ── 公开 API ─────────────────────────────────────────────────

/**
 * 向 WS Cookie 服务请求 Cookie。
 *
 * @param {object} opts
 * @param {string} opts.platform
 * @param {string} opts.store
 * @param {string} opts.account
 * @param {string} opts.password
 * @param {object} [opts.extra]
 * @param {number} [opts.timeout=0]  0 表示无限等待
 * @returns {Promise<object>}  服务端返回的 JSON 对象，含 cookie 字段时表示成功
 */
export async function requestCookie({ platform, store, account, password, extra, timeout = 0 }) {
  const { sock, leftover } = await wsConnect(WS_HOST, WS_PORT);
  const state = { buf: leftover };

  try {
    const msg = { type: "request", platform, store, account, password };
    if (extra != null) msg.extra = extra;
    sock.write(encodeFrame(JSON.stringify(msg)));

    const infiniteWait = !timeout || timeout <= 0;
    const deadline = infiniteWait ? Infinity : Date.now() + timeout * 1000;
    let lastResp = null;

    while (true) {
      const remaining = infiniteWait ? 5000 : Math.min(5000, deadline - Date.now());
      if (remaining <= 0) break;

      const raw = await recvMessage(sock, state, remaining);
      if (raw === null) {
        if (infiniteWait) continue;
        break;
      }

      let resp;
      try {
        resp = JSON.parse(raw);
      } catch {
        continue;
      }

      lastResp = resp;
      const status = String(resp.status || "").toLowerCase();

      if (resp.cookie) {
        const cache = await readCache();
        cache[cacheKey(platform, store, account)] = {
          platform,
          store,
          account,
          cookie: resp.cookie,
          extra: resp.extra,
          updated_at: new Date().toISOString(),
        };
        await writeCache(cache);
        return resp;
      }

      if (status === "queued" || status === "pending" || status === "processing") continue;

      return resp;
    }

    if (lastResp) return lastResp;
    throw new Error("服务端无响应");
  } finally {
    try {
      sock.write(encodeFrame(Buffer.alloc(0), 0x8));
    } catch {}
    sock.destroy();
  }
}

/**
 * 读取本地缓存的 Cookie，不发起网络请求。
 * @returns {object|null}
 */
export async function getCachedCookie(platform, store, account) {
  const cache = await readCache();
  return cache[cacheKey(platform, store, account)] ?? null;
}

/**
 * 读取并删除本地缓存的 Cookie。
 * @returns {object|null}
 */
export async function popCachedCookie(platform, store, account) {
  const cache = await readCache();
  const key = cacheKey(platform, store, account);
  const entry = cache[key] ?? null;
  if (entry) {
    delete cache[key];
    await writeCache(cache);
  }
  return entry;
}
