import { initDb, getTemplates } from "../lib/db.js";

async function main() {
  await initDb();
  const templates = await getTemplates({ includeInactive: true });
  console.log(`数据库初始化完成，当前模板数：${templates.length}`);
  console.log(`数据库类型：${process.env.DB_CLIENT || "sqlite"}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
