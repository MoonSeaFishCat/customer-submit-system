import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import mysql from "mysql2/promise";
import { createId, jsonStringify, nowIso, safeJsonParse, slugify } from "./utils.js";

const DB_CLIENT = (process.env.DB_CLIENT || "sqlite").toLowerCase();
const SQLITE_PATH = process.env.SQLITE_PATH || "data/customer-submit.sqlite";
const MYSQL_URL = process.env.MYSQL_URL || "";

let sqlite;
let mysqlPool;

function normalizeRows(rows) {
  return rows.map((row) => ({
    ...row,
    fields: safeJsonParse(row.fields, []),
    data: safeJsonParse(row.data, {}),
    headers: safeJsonParse(row.headers, {}),
    webhook_urls: safeJsonParse(row.webhook_urls, []),
    webhook_headers: safeJsonParse(row.webhook_headers, {}),
    push_mode: row.push_mode || "manual",
    last_response: safeJsonParse(row.last_response, null),
    push_status: row.push_status || "pending",
    pushed_at: row.pushed_at || null
  }));
}

function getSqlite() {
  if (!sqlite) {
    const fullPath = path.join(process.cwd(), SQLITE_PATH);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    sqlite = new DatabaseSync(fullPath);
    sqlite.exec("PRAGMA journal_mode = WAL");
  }
  return sqlite;
}

function getMysqlPool() {
  if (!mysqlPool) {
    if (!MYSQL_URL) {
      throw new Error("使用 MySQL 时必须配置 MYSQL_URL");
    }
    mysqlPool = mysql.createPool(MYSQL_URL);
  }
  return mysqlPool;
}

export async function query(sql, params = []) {
  if (DB_CLIENT === "mysql") {
    const [rows] = await getMysqlPool().execute(sql, params);
    return rows;
  }

  const db = getSqlite();
  const trimmed = sql.trim().toLowerCase();
  if (trimmed.startsWith("select") || trimmed.startsWith("pragma")) {
    return db.prepare(sql).all(...params);
  }

  const result = db.prepare(sql).run(...params);
  return { insertId: result.lastInsertRowid, changes: result.changes };
}

async function ensureSubmissionPushColumns() {
  if (DB_CLIENT === "mysql") {
    try {
      await query("ALTER TABLE submissions ADD COLUMN push_status VARCHAR(40) DEFAULT 'pending'");
    } catch (error) {
      if (!String(error.message || "").toLowerCase().includes("duplicate")) {
        throw error;
      }
    }

    try {
      await query("ALTER TABLE submissions ADD COLUMN pushed_at VARCHAR(40)");
    } catch (error) {
      if (!String(error.message || "").toLowerCase().includes("duplicate")) {
        throw error;
      }
    }

    try {
      await query("ALTER TABLE templates ADD COLUMN push_mode VARCHAR(40) DEFAULT 'manual'");
    } catch (error) {
      if (!String(error.message || "").toLowerCase().includes("duplicate")) {
        throw error;
      }
    }

    return;
  }

  const columns = await query("PRAGMA table_info(submissions)");
  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has("push_status")) {
    await query("ALTER TABLE submissions ADD COLUMN push_status TEXT DEFAULT 'pending'");
  }

  if (!columnNames.has("pushed_at")) {
    await query("ALTER TABLE submissions ADD COLUMN pushed_at TEXT");
  }

  const templateColumns = await query("PRAGMA table_info(templates)");
  const templateColumnNames = new Set(templateColumns.map((column) => column.name));

  if (!templateColumnNames.has("push_mode")) {
    await query("ALTER TABLE templates ADD COLUMN push_mode TEXT DEFAULT 'manual'");
  }
}

export async function initDb() {
  if (DB_CLIENT === "mysql") {
    await query(`
      CREATE TABLE IF NOT EXISTS app_meta (
        key_name VARCHAR(120) PRIMARY KEY,
        value_text TEXT NOT NULL
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS templates (
        id VARCHAR(64) PRIMARY KEY,
        slug VARCHAR(120) UNIQUE NOT NULL,
        name VARCHAR(160) NOT NULL,
        description TEXT,
        fields JSON NOT NULL,
        webhook_urls JSON,
        webhook_headers JSON,
        push_mode VARCHAR(40) DEFAULT 'manual',
        active TINYINT DEFAULT 1,
        created_at VARCHAR(40) NOT NULL,
        updated_at VARCHAR(40) NOT NULL
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS submissions (
        id VARCHAR(64) PRIMARY KEY,
        template_id VARCHAR(64) NOT NULL,
        template_slug VARCHAR(120) NOT NULL,
        data JSON NOT NULL,
        status VARCHAR(40) DEFAULT 'new',
        push_status VARCHAR(40) DEFAULT 'pending',
        pushed_at VARCHAR(40),
        source VARCHAR(80),
        ip VARCHAR(80),
        user_agent TEXT,
        created_at VARCHAR(40) NOT NULL,
        updated_at VARCHAR(40) NOT NULL
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS webhook_logs (
        id VARCHAR(64) PRIMARY KEY,
        submission_id VARCHAR(64) NOT NULL,
        template_id VARCHAR(64) NOT NULL,
        url TEXT NOT NULL,
        ok TINYINT DEFAULT 0,
        status_code INT,
        last_response JSON,
        created_at VARCHAR(40) NOT NULL
      )
    `);
  } else {
    await query(`
      CREATE TABLE IF NOT EXISTS app_meta (
        key_name TEXT PRIMARY KEY,
        value_text TEXT NOT NULL
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS templates (
        id TEXT PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        fields TEXT NOT NULL,
        webhook_urls TEXT,
        webhook_headers TEXT,
        push_mode TEXT DEFAULT 'manual',
        active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS submissions (
        id TEXT PRIMARY KEY,
        template_id TEXT NOT NULL,
        template_slug TEXT NOT NULL,
        data TEXT NOT NULL,
        status TEXT DEFAULT 'new',
        push_status TEXT DEFAULT 'pending',
        pushed_at TEXT,
        source TEXT,
        ip TEXT,
        user_agent TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS webhook_logs (
        id TEXT PRIMARY KEY,
        submission_id TEXT NOT NULL,
        template_id TEXT NOT NULL,
        url TEXT NOT NULL,
        ok INTEGER DEFAULT 0,
        status_code INTEGER,
        last_response TEXT,
        created_at TEXT NOT NULL
      )
    `);
  }

  await ensureSubmissionPushColumns();
  await ensureApiKey();

  const seeded = await getMeta("template_seeded");
  if (seeded !== "1") {
    const existing = await getTemplates({ includeInactive: true });

    if (existing.length === 0) {
      await createTemplate({
        name: "客户资料登记",
        slug: "customer-info",
        description: "用于客服收集客户联系方式、业务需求和备注。",
        fields: [
          { key: "name", label: "客户姓名", type: "text", required: true, placeholder: "请输入客户姓名" },
          { key: "phone", label: "联系电话", type: "tel", required: true, placeholder: "手机号/座机" },
          { key: "wechat", label: "微信号", type: "text", required: false },
          { key: "business", label: "业务类型", type: "select", required: true, options: ["售前咨询", "售后问题", "投诉建议", "商务合作"] },
          { key: "message", label: "详细说明", type: "textarea", required: false }
        ],
        webhook_urls: [],
        webhook_headers: {},
        push_mode: "manual"
      });
    }

    await setMeta("template_seeded", "1");
  }
}

async function getMeta(key) {
  const rows = await query("SELECT value_text FROM app_meta WHERE key_name = ? LIMIT 1", [key]);
  return rows[0]?.value_text || null;
}

async function ensureApiKey() {
  const existing = await getMeta("api_key");
  if (existing) return existing;

  const apiKey = `csk_${crypto.randomBytes(24).toString("hex")}`;
  await setMeta("api_key", apiKey);
  return apiKey;
}

export async function getApiKey() {
  await ensureApiKey();
  return getMeta("api_key");
}

async function setMeta(key, value) {
  if (DB_CLIENT === "mysql") {
    await query(
      "INSERT INTO app_meta (key_name, value_text) VALUES (?, ?) ON DUPLICATE KEY UPDATE value_text = VALUES(value_text)",
      [key, value]
    );
    return;
  }

  await query(
    "INSERT INTO app_meta (key_name, value_text) VALUES (?, ?) ON CONFLICT(key_name) DO UPDATE SET value_text = excluded.value_text",
    [key, value]
  );
}

export async function getTemplates({ includeInactive = false } = {}) {
  const rows = await query(
    `SELECT * FROM templates ${includeInactive ? "" : "WHERE active = 1"} ORDER BY created_at DESC`
  );
  return normalizeRows(rows);
}

export async function getTemplateBySlug(slug, { includeInactive = false } = {}) {
  const rows = await query(
    `SELECT * FROM templates WHERE slug = ? ${includeInactive ? "" : "AND active = 1"} LIMIT 1`,
    [slug]
  );
  return normalizeRows(rows)[0] || null;
}

export async function getTemplateById(id) {
  const rows = await query("SELECT * FROM templates WHERE id = ? LIMIT 1", [id]);
  return normalizeRows(rows)[0] || null;
}

export async function createTemplate(input) {
  const id = createId("tpl");
  const ts = nowIso();
  const slug = slugify(createId("tpl"));
  await query(
    `INSERT INTO templates (id, slug, name, description, fields, webhook_urls, webhook_headers, push_mode, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      slug,
      input.name,
      input.description || "",
      jsonStringify(input.fields || []),
      jsonStringify(input.webhook_urls || []),
      jsonStringify(input.webhook_headers || {}),
      input.push_mode === "auto" ? "auto" : "manual",
      input.active === false ? 0 : 1,
      ts,
      ts
    ]
  );
  return getTemplateById(id);
}

export async function deleteTemplate(id) {
  const current = await getTemplateById(id);
  if (!current) return null;

  await query("DELETE FROM templates WHERE id = ?", [id]);
  return current;
}

export async function updateTemplate(id, input) {
  const current = await getTemplateById(id);
  if (!current) return null;

  const next = {
    slug: slugify(input.slug ?? current.slug),
    name: input.name ?? current.name,
    description: input.description ?? current.description,
    fields: input.fields ?? current.fields,
    webhook_urls: input.webhook_urls ?? current.webhook_urls,
    webhook_headers: input.webhook_headers ?? current.webhook_headers,
    push_mode: input.push_mode === undefined ? current.push_mode || "manual" : input.push_mode === "auto" ? "auto" : "manual",
    active: input.active === undefined ? current.active : input.active ? 1 : 0
  };

  await query(
    `UPDATE templates
     SET slug = ?, name = ?, description = ?, fields = ?, webhook_urls = ?, webhook_headers = ?, push_mode = ?, active = ?, updated_at = ?
     WHERE id = ?`,
    [
      next.slug,
      next.name,
      next.description,
      jsonStringify(next.fields),
      jsonStringify(next.webhook_urls),
      jsonStringify(next.webhook_headers),
      next.push_mode,
      next.active,
      nowIso(),
      id
    ]
  );

  return getTemplateById(id);
}

export async function createSubmission({ template, data, source, ip, userAgent }) {
  const id = createId("sub");
  const ts = nowIso();
  await query(
    `INSERT INTO submissions (id, template_id, template_slug, data, status, push_status, pushed_at, source, ip, user_agent, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      template.id,
      template.slug,
      jsonStringify(data),
      "new",
      "pending",
      null,
      source || "web",
      ip || "",
      userAgent || "",
      ts,
      ts
    ]
  );
  return getSubmissionById(id);
}

export async function getSubmissions({ templateSlug, limit = 100, page, pageSize, search, startDate, endDate, status, source } = {}) {
  const conditions = [];
  const params = [];

  if (templateSlug) {
    conditions.push("template_slug = ?");
    params.push(templateSlug);
  }
  if (status) {
    conditions.push("status = ?");
    params.push(status);
  }
  if (source) {
    conditions.push("source = ?");
    params.push(source);
  }
  if (search) {
    conditions.push("(data LIKE ? OR ip LIKE ? OR id LIKE ?)");
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (startDate) {
    conditions.push("created_at >= ?");
    params.push(startDate);
  }
  if (endDate) {
    conditions.push("created_at <= ?");
    params.push(endDate + " 23:59:59");
  }

  const where = conditions.length ? " WHERE " + conditions.join(" AND ") : "";

  if (pageSize) {
    const countRows = await query(`SELECT COUNT(*) as total FROM submissions${where}`, params);
    const total = Number(countRows[0]?.total ?? 0);
    const offset = (Number(page || 1) - 1) * Number(pageSize);
    const rows = await query(
      `SELECT * FROM submissions${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, Number(pageSize), offset]
    );
    return { submissions: normalizeRows(rows), total };
  }

  const rows = await query(
    `SELECT * FROM submissions${where} ORDER BY created_at DESC LIMIT ?`,
    [...params, Number(limit)]
  );
  return normalizeRows(rows);
}

export async function getSubmissionById(id) {
  const rows = await query("SELECT * FROM submissions WHERE id = ? LIMIT 1", [id]);
  return normalizeRows(rows)[0] || null;
}

export async function updateSubmission(id, input) {
  const current = await getSubmissionById(id);
  if (!current) return null;
  await query(
    `UPDATE submissions SET data = ?, status = ?, updated_at = ? WHERE id = ?`,
    [
      jsonStringify(input.data ?? current.data),
      input.status ?? current.status,
      nowIso(),
      id
    ]
  );
  return getSubmissionById(id);
}

export async function updateSubmissionPushStatus(id, pushStatus, pushedAt = null) {
  const current = await getSubmissionById(id);
  if (!current) return null;

  await query(
    `UPDATE submissions SET push_status = ?, pushed_at = ?, updated_at = ? WHERE id = ?`,
    [
      pushStatus || current.push_status || "pending",
      pushedAt === undefined ? current.pushed_at : pushedAt,
      nowIso(),
      id
    ]
  );

  return getSubmissionById(id);
}

export async function addTemplateSubmissionField(templateSlug, field) {
  const template = await getTemplateBySlug(templateSlug, { includeInactive: true });
  if (!template) return null;

  if ((template.fields || []).some((item) => item.key === field.key)) {
    return { template, submissions: await getSubmissions({ templateSlug, limit: 1000 }) };
  }

  const nextFields = [
    ...(template.fields || []),
    {
      key: field.key,
      label: field.label,
      type: field.type || "textarea",
      required: false,
      width: field.width || "half",
      adminOnly: Boolean(field.adminOnly)
    }
  ];

  const updatedTemplate = await updateTemplate(template.id, {
    fields: nextFields
  });

  const submissions = await getSubmissions({ templateSlug, limit: 1000 });

  await Promise.all(
    submissions.map((submission) => {
      if (Object.prototype.hasOwnProperty.call(submission.data || {}, field.key)) {
        return submission;
      }

      return updateSubmission(submission.id, {
        data: {
          ...(submission.data || {}),
          [field.key]: ""
        }
      });
    })
  );

  return {
    template: updatedTemplate,
    submissions: await getSubmissions({ templateSlug, limit: 1000 })
  };
}

export async function deleteSubmission(id) {
  const current = await getSubmissionById(id);
  if (!current) return null;

  await query("DELETE FROM webhook_logs WHERE submission_id = ?", [id]);
  await query("DELETE FROM submissions WHERE id = ?", [id]);
  return current;
}

export async function createWebhookLog({ submissionId, templateId, url, ok, statusCode, response }) {
  await query(
    `INSERT INTO webhook_logs (id, submission_id, template_id, url, ok, status_code, last_response, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      createId("wh"),
      submissionId,
      templateId,
      url,
      ok ? 1 : 0,
      statusCode || 0,
      jsonStringify(response),
      nowIso()
    ]
  );
}

export async function getWebhookLogs(submissionId) {
  const rows = await query(
    "SELECT * FROM webhook_logs WHERE submission_id = ? ORDER BY created_at DESC",
    [submissionId]
  );
  return normalizeRows(rows);
}
