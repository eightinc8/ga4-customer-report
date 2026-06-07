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
    const { loginId, password, companyName, ga4PropertyId } = await request.json();

    if (!loginId || !password || !companyName) {
      return NextResponse.json(
        { error: "ログインID、パスワード、会社名は必須です" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "パスワードは8文字以上にしてください" },
        { status: 400 }
      );
    }

    const db = getDb();

    const existing = db
      .prepare("SELECT id FROM users WHERE login_id = ?")
      .get(loginId);
    if (existing) {
      return NextResponse.json(
        { error: "このログインIDは既に使用されています" },
        { status: 409 }
      );
    }

    const hash = bcryptjs.hashSync(password, 12);
    const result = db
      .prepare(
        "INSERT INTO users (login_id, password_hash, company_name, ga4_property_id, role) VALUES (?, ?, ?, ?, 'customer')"
      )
      .run(loginId, hash, companyName, ga4PropertyId || null);

    const customer = {
      id: result.lastInsertRowid,
      login_id: loginId,
      company_name: companyName,
      ga4_property_id: ga4PropertyId || null,
      is_active: 1,
      created_at: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, customer });
  } catch {
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
