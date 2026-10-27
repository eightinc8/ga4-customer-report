import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// GAS用: GA4プロパティIDに紐づくページ分類ルール（サービス/集客）を返す（APIキー認証）
export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  if (apiKey !== process.env.GAS_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const propertyId = request.nextUrl.searchParams.get("propertyId");
  if (!propertyId) {
    return NextResponse.json({ error: "propertyId is required" }, { status: 400 });
  }

  const db = getDb();
  const user = db
    .prepare("SELECT id FROM users WHERE ga4_property_id = ? AND is_active = 1")
    .get(propertyId) as { id: number } | undefined;
  if (!user) return NextResponse.json({ groups: [] });

  const groups = db
    .prepare("SELECT group_key AS \"group\", pattern FROM seo_page_groups WHERE user_id = ? ORDER BY id ASC")
    .all(user.id) as { group: string; pattern: string }[];

  return NextResponse.json({ groups });
}
