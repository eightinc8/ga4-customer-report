import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

interface FunnelStep {
  id: number;
  step_order: number;
  label: string;
  step_type: string;
  step_value: string;
}

// ファネルの段階一覧を取得
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

  const db = getDb();
  const steps = db
    .prepare("SELECT id, step_order, label, step_type, step_value FROM funnel_steps WHERE user_id = ? ORDER BY step_order ASC, id ASC")
    .all(parseInt(userId)) as FunnelStep[];
  return NextResponse.json({ steps });
}

// 段階を追加（末尾に）
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  try {
    const body = await request.json();
    const userId = parseInt(body.userId);
    if (!userId || !body.label || !body.value) {
      return NextResponse.json({ error: "userId・label・value は必須です" }, { status: 400 });
    }

    const type = body.type === "event" ? "event" : "page";
    let value = String(body.value).trim();
    // ページの場合はパスに正規化
    if (type === "page") {
      if (/^https?:\/\//i.test(value)) {
        try {
          const u = new URL(value);
          value = u.pathname + u.search;
        } catch {
          /* そのまま */
        }
      }
      if (!value.startsWith("/")) value = "/" + value;
    }

    const db = getDb();
    const maxRow = db
      .prepare("SELECT COALESCE(MAX(step_order), -1) AS m FROM funnel_steps WHERE user_id = ?")
      .get(userId) as { m: number };
    const result = db
      .prepare("INSERT INTO funnel_steps (user_id, step_order, label, step_type, step_value) VALUES (?, ?, ?, ?, ?)")
      .run(userId, maxRow.m + 1, String(body.label).trim(), type, value);
    return NextResponse.json({ success: true, id: result.lastInsertRowid });
  } catch {
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
