import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

interface TrackedPage {
  id: number;
  user_id: number;
  path: string;
  label: string | null;
  created_at: string;
}

// 登録ページ一覧を取得
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const db = getDb();
  const pages = db
    .prepare("SELECT id, user_id, path, label, created_at FROM tracked_pages WHERE user_id = ? ORDER BY id ASC")
    .all(parseInt(userId)) as TrackedPage[];

  return NextResponse.json({ pages });
}

// 登録ページを追加
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const userId = parseInt(body.userId);
    if (!userId || !body.path) {
      return NextResponse.json({ error: "userId と path は必須です" }, { status: 400 });
    }

    // URLが入力された場合はパス部分のみに正規化
    let path = String(body.path).trim();
    if (/^https?:\/\//i.test(path)) {
      try {
        const u = new URL(path);
        path = u.pathname + u.search;
      } catch {
        /* そのまま使う */
      }
    }
    if (!path.startsWith("/")) path = "/" + path;

    const label = body.label ? String(body.label).trim() : null;

    const db = getDb();
    try {
      const result = db
        .prepare("INSERT INTO tracked_pages (user_id, path, label) VALUES (?, ?, ?)")
        .run(userId, path, label);
      return NextResponse.json({ success: true, id: result.lastInsertRowid });
    } catch {
      return NextResponse.json({ error: "このページは既に登録されています" }, { status: 409 });
    }
  } catch {
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
