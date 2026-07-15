import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

interface StepRow {
  id: number;
  user_id: number;
  step_order: number;
}

// 段階を削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  try {
    const { id } = await params;
    const db = getDb();
    db.prepare("DELETE FROM funnel_steps WHERE id = ?").run(parseInt(id));
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}

// 並び替え（上/下に移動）
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
    const direction = body.direction === "up" ? "up" : "down";
    const db = getDb();

    const step = db
      .prepare("SELECT id, user_id, step_order FROM funnel_steps WHERE id = ?")
      .get(parseInt(id)) as StepRow | undefined;
    if (!step) return NextResponse.json({ error: "見つかりません" }, { status: 404 });

    // 隣の段階を取得
    const neighbor = db
      .prepare(
        direction === "up"
          ? "SELECT id, user_id, step_order FROM funnel_steps WHERE user_id = ? AND step_order < ? ORDER BY step_order DESC LIMIT 1"
          : "SELECT id, user_id, step_order FROM funnel_steps WHERE user_id = ? AND step_order > ? ORDER BY step_order ASC LIMIT 1"
      )
      .get(step.user_id, step.step_order) as StepRow | undefined;

    if (neighbor) {
      const swap = db.transaction(() => {
        db.prepare("UPDATE funnel_steps SET step_order = ? WHERE id = ?").run(neighbor.step_order, step.id);
        db.prepare("UPDATE funnel_steps SET step_order = ? WHERE id = ?").run(step.step_order, neighbor.id);
      });
      swap();
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
