import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import bcryptjs from "bcryptjs";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "全項目を入力してください" }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: "パスワードは8文字以上にしてください" }, { status: 400 });
    }

    const db = getDb();
    const user = db
      .prepare("SELECT password_hash FROM users WHERE id = ?")
      .get(session.id) as { password_hash: string } | undefined;

    if (!user || !bcryptjs.compareSync(currentPassword, user.password_hash)) {
      return NextResponse.json({ error: "現在のパスワードが正しくありません" }, { status: 401 });
    }

    const newHash = bcryptjs.hashSync(newPassword, 12);
    db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(
      newHash,
      session.id
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
