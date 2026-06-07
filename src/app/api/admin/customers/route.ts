import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import bcryptjs from "bcryptjs";

async function syncToSpreadsheet(companyName: string, loginId: string, ga4PropertyId: string) {
  const gasUrl = process.env.GAS_WEBAPP_URL;
  if (!gasUrl) return;

  try {
    await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "addCustomer",
        companyName,
        loginId,
        ga4PropertyId,
      }),
    });
  } catch (e) {
    console.error("スプレッドシート同期エラー:", e);
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { loginId, password, companyName, ga4PropertyId } = await request.json();

    if (!companyName) {
      return NextResponse.json(
        { error: "会社名は必須です" },
        { status: 400 }
      );
    }

    if (password && password.length < 8) {
      return NextResponse.json(
        { error: "パスワードは8文字以上にしてください" },
        { status: 400 }
      );
    }

    const db = getDb();

    if (loginId) {
      const existing = db
        .prepare("SELECT id FROM users WHERE login_id = ?")
        .get(loginId);
      if (existing) {
        return NextResponse.json(
          { error: "このログインIDは既に使用されています" },
          { status: 409 }
        );
      }
    }

    const hash = password ? bcryptjs.hashSync(password, 12) : null;
    const finalLoginId = loginId || `customer_${Date.now()}`;

    const result = db
      .prepare(
        "INSERT INTO users (login_id, password_hash, company_name, ga4_property_id, role) VALUES (?, ?, ?, ?, 'customer')"
      )
      .run(finalLoginId, hash || "nologin", companyName, ga4PropertyId || null);

    // スプレッドシートに自動同期
    await syncToSpreadsheet(companyName, finalLoginId, ga4PropertyId || "");

    const customer = {
      id: result.lastInsertRowid,
      login_id: loginId || "",
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
