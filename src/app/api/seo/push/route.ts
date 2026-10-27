import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { analyzePages, SeoInput } from "@/lib/seo-analyzer";

// GASから「上位ページ＋自然/AI流入＋Search Consoleデータ」を受け取り、
// 保存後にバックグラウンドで各ページをクロール・採点する
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  if (apiKey !== process.env.GAS_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await request.json();
    const db = getDb();

    const user = db
      .prepare("SELECT id FROM users WHERE ga4_property_id = ? AND is_active = 1")
      .get(data.propertyId) as { id: number } | undefined;
    if (!user) return NextResponse.json({ error: "Property not found" }, { status: 404 });

    const weekStart: string = data.weekStart;
    const weekEnd: string = data.weekEnd || null;
    // 上位50 ＋ サービスページ（CV直結）の強制追加分
    const pages: SeoInput[] = Array.isArray(data.pages) ? data.pages.slice(0, 120) : [];
    if (!weekStart || pages.length === 0) {
      return NextResponse.json({ error: "weekStart と pages は必須です" }, { status: 400 });
    }

    const insert = db.prepare(
      `INSERT OR REPLACE INTO seo_analysis
       (user_id, week_start, week_end, path, data, score, organic_sessions, ai_sessions)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
    );
    const tx = db.transaction((rows: SeoInput[]) => {
      for (const p of rows) {
        insert.run(user.id, weekStart, weekEnd, p.path, JSON.stringify(p), p.organicSessions || 0, p.aiSessions || 0);
      }
    });
    tx(pages);

    // レスポンスを返した後も解析を継続（GAS側のタイムアウトを避ける）
    void runAnalysis(user.id, weekStart, pages);

    return NextResponse.json({ success: true, count: pages.length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}

async function runAnalysis(userId: number, weekStart: string, pages: SeoInput[]) {
  const db = getDb();
  const upd = db.prepare("UPDATE seo_analysis SET data = ?, score = ? WHERE user_id = ? AND week_start = ? AND path = ?");
  try {
    await analyzePages(
      pages,
      (r) => {
        try {
          upd.run(JSON.stringify(r), r.score, userId, weekStart, r.path);
        } catch (e) {
          console.error("seo update error", e);
        }
      },
      3
    );
  } catch (e) {
    console.error("seo analysis error", e);
  }
}
