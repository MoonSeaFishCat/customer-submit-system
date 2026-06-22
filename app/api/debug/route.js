import { NextResponse } from "next/server";
import { initDb, getSubmissions, getTemplates } from "@/lib/db";

export async function GET() {
  try {
    await initDb();

    const templates = await getTemplates({ includeInactive: true });
    const result = await getSubmissions({ pageSize: 5, page: 1 });

    return NextResponse.json({
      success: true,
      dbClient: process.env.DB_CLIENT || "sqlite",
      mysqlUrl: process.env.MYSQL_URL ? "configured" : "not configured",
      templatesCount: templates.length,
      submissionsCount: result.total || 0,
      firstSubmission: result.submissions?.[0] || null,
      templates: templates.map(t => ({ id: t.id, name: t.name, slug: t.slug })),
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}
