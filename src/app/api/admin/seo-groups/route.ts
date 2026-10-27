import { NextRequest, NextResponse } from "next/server";
import { getSession, isStaff, canEdit } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { normalizePattern } from "@/lib/seo-groups";

// ページ分類ルール一覧
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || !isStaff(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

  const rules = getDb()
    .prepare("SELECT id, group_key, pattern, label FROM seo_page_groups WHERE user_id = ? ORDER BY group_key DESC, pattern ASC")
    .all(parseInt(userId));
  return NextResponse.json({ rules });
}

// ルールを追加
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !canEdit(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  try {
    const body = await request.json();
    const userId = parseInt(body.userId);
    const pattern = normalizePattern(String(body.pattern || ""));
    if (!userId || !pattern) {
      return NextResponse.json({ error: "userId と pattern は必須です" }, { status: 400 });
    }
    const group = body.group === "content" ? "content" : "service";
    const label = body.label ? String(body.label).trim() : null;

    const db = getDb();
    // 同じパターンがあれば分類を上書き
    const existing = db
      .prepare("SELECT id FROM seo_page_groups WHERE user_id = ? AND pattern = ?")
      .get(userId, pattern) as { id: number } | undefined;
    if (existing) {
      db.prepare("UPDATE seo_page_groups SET group_key = ?, label = COALESCE(?, label) WHERE id = ?").run(group, label, existing.id);
      return NextResponse.json({ success: true, id: existing.id, updated: true });
    }
    const result = db
      .prepare("INSERT INTO seo_page_groups (user_id, group_key, pattern, label) VALUES (?, ?, ?, ?)")
      .run(userId, group, pattern, label);
    return NextResponse.json({ success: true, id: result.lastInsertRowid });
  } catch {
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
