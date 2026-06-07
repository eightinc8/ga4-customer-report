import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  if (session.role === "admin") {
    const reports = db
      .prepare(
        `SELECT r.*, u.company_name, u.login_id
         FROM reports r
         JOIN users u ON r.user_id = u.id
         ORDER BY r.week_start DESC`
      )
      .all();
    return NextResponse.json(reports);
  }

  const reports = db
    .prepare(
      `SELECT * FROM reports WHERE user_id = ? ORDER BY week_start DESC LIMIT 12`
    )
    .all(session.id);
  return NextResponse.json(reports);
}
