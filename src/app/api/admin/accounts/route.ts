import { NextRequest, NextResponse } from "next/server";
import { getSession, canEdit } from "@/lib/auth";
import { getDb } from "@/lib/db";
import bcryptjs from "bcryptjs";

const LIST_SQL = `SELECT u.id, u.login_id, u.company_name, u.role, u.is_active, u.created_at,
  (SELECT MAX(created_at) FROM login_logs l WHERE l.user_id = u.id AND l.success = 1) AS last_login
  FROM users u WHERE u.role IN ('admin', 'viewer') ORDER BY u.id`;

// 管理画面アカウント一覧
export async function GET() {
  const session = await getSession();
  if (!session || !canEdit(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const accounts = getDb().prepare(LIST_SQL).all();
  return NextResponse.json({ accounts });
}

// 管理画面アカウントを追加
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !canEdit(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { loginId, displayName, role, password } = await request.json();
    const id = String(loginId || "").trim();
    const name = String(displayName || "").trim();

    if (!id || !name || !password) {
      return NextResponse.json({ error: "ログインID・表示名・パスワードは必須です" }, { status: 400 });
    }
    if (id.length > 100 || /\s/.test(id)) {
      return NextResponse.json({ error: "ログインIDに空白は使えません" }, { status: 400 });
    }
    if (String(password).length < 8) {
      return NextResponse.json({ error: "パスワードは8文字以上にしてください" }, { status: 400 });
    }
    const finalRole = role === "admin" ? "admin" : "viewer";

    const db = getDb();
    const existing = db.prepare("SELECT id FROM users WHERE login_id = ?").get(id);
    if (existing) {
      return NextResponse.json({ error: "このログインIDは既に使用されています" }, { status: 409 });
    }

    const hash = bcryptjs.hashSync(String(password), 12);
    const result = db
      .prepare("INSERT INTO users (login_id, password_hash, company_name, role) VALUES (?, ?, ?, ?)")
      .run(id, hash, name, finalRole);

    const account = db
      .prepare("SELECT id, login_id, company_name, role, is_active, created_at FROM users WHERE id = ?")
      .get(result.lastInsertRowid);
    return NextResponse.json({ success: true, account });
  } catch {
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
