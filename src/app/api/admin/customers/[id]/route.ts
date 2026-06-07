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
    const { isActive } = await request.json();
    const db = getDb();

    db.prepare("UPDATE users SET is_active = ?, updated_at = datetime('now') WHERE id = ? AND role = 'customer'").run(
      isActive,
      parseInt(id)
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
