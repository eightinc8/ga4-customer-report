import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const db = getDb();
    const userId = parseInt(id);

    // 有効/無効の切替
    if (body.isActive !== undefined) {
      db.prepare("UPDATE users SET is_active = ?, updated_at = datetime('now') WHERE id = ? AND role = 'customer'").run(
        body.isActive,
        userId
      );
      return NextResponse.json({ success: true });
    }

    // 顧客情報の編集
    if (body.companyName !== undefined) {
      const updates: string[] = [];
      const values: (string | null)[] = [];

      if (body.companyName) {
        updates.push("company_name = ?");
        values.push(body.companyName);
      }
      if (body.loginId !== undefined) {
        // 重複チェック
        if (body.loginId) {
          const existing = db
            .prepare("SELECT id FROM users WHERE login_id = ? AND id != ?")
            .get(body.loginId, userId);
          if (existing) {
            return NextResponse.json({ error: "このログインIDは既に使用されています" }, { status: 409 });
          }
        }
        updates.push("login_id = ?");
        values.push(body.loginId || `customer_${userId}`);
      }
      if (body.ga4PropertyId !== undefined) {
        updates.push("ga4_property_id = ?");
        values.push(body.ga4PropertyId || null);
      }

      if (updates.length > 0) {
        updates.push("updated_at = datetime('now')");
        values.push(String(userId));
        db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ? AND role = 'customer'`).run(...values);
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "更新内容がありません" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
