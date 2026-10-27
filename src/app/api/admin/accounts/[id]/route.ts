import { NextRequest, NextResponse } from "next/server";
import { getSession, canEdit } from "@/lib/auth";
import { getDb } from "@/lib/db";
import bcryptjs from "bcryptjs";

interface StaffRow {
  id: number;
  role: string;
  is_active: number;
}

// 管理画面アカウントの変更（権限 / 有効無効 / パスワード再設定）
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !canEdit(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const targetId = parseInt(id);
    const body = await request.json();
    const db = getDb();

    const target = db
      .prepare("SELECT id, role, is_active FROM users WHERE id = ? AND role IN ('admin', 'viewer')")
      .get(targetId) as StaffRow | undefined;
    if (!target) {
      return NextResponse.json({ error: "アカウントが見つかりません" }, { status: 404 });
    }
    if (target.id === session.id && (body.role !== undefined || body.isActive !== undefined)) {
      return NextResponse.json({ error: "自分自身の権限・状態は変更できません" }, { status: 400 });
    }

    // 最後の有効な管理者を無効化・降格させない
    const willLoseAdmin =
      target.role === "admin" && target.is_active === 1 &&
      ((body.role !== undefined && body.role !== "admin") || (body.isActive !== undefined && Number(body.isActive) === 0));
    if (willLoseAdmin) {
      const activeAdmins = db
        .prepare("SELECT COUNT(*) AS cnt FROM users WHERE role = 'admin' AND is_active = 1")
        .get() as { cnt: number };
      if (activeAdmins.cnt <= 1) {
        return NextResponse.json({ error: "有効な管理者が1人もいなくなるため変更できません" }, { status: 400 });
      }
    }

    if (body.role !== undefined) {
      const role = body.role === "admin" ? "admin" : "viewer";
      db.prepare("UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?").run(role, targetId);
      return NextResponse.json({ success: true });
    }

    if (body.isActive !== undefined) {
      db.prepare("UPDATE users SET is_active = ?, updated_at = datetime('now') WHERE id = ?").run(
        Number(body.isActive) ? 1 : 0,
        targetId
      );
      return NextResponse.json({ success: true });
    }

    if (body.newPassword !== undefined) {
      const pw = String(body.newPassword);
      if (pw.length < 8) {
        return NextResponse.json({ error: "パスワードは8文字以上にしてください" }, { status: 400 });
      }
      db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(
        bcryptjs.hashSync(pw, 12),
        targetId
      );
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "更新内容がありません" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
