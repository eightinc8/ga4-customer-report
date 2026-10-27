import { NextRequest, NextResponse } from "next/server";
import { getSession, canEdit } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !canEdit(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const { id } = await params;
  getDb().prepare("DELETE FROM seo_page_groups WHERE id = ?").run(parseInt(id));
  return NextResponse.json({ success: true });
}

// 分類（service / content）の切り替え
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !canEdit(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const { id } = await params;
  const body = await request.json();
  const group = body.group === "content" ? "content" : "service";
  getDb().prepare("UPDATE seo_page_groups SET group_key = ? WHERE id = ?").run(group, parseInt(id));
  return NextResponse.json({ success: true });
}
