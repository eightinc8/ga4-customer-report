import { NextRequest, NextResponse } from "next/server";
import { getSession, isStaff } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { detectChanges, HistoryRow, toPoint, WeekPoint } from "@/lib/seo-history";

interface QueryPoint {
  q: string;
  week: string;
  pos: number;
  imp: number;
  clicks: number;
}

// 1ページの週次履歴（順位・表示・クリック・自然検索・スコア）と、検索クエリ別の順位推移、変更イベント
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || !isStaff(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const userId = parseInt(request.nextUrl.searchParams.get("userId") || "");
  const path = request.nextUrl.searchParams.get("path") || "";
  if (!userId || !path) return NextResponse.json({ error: "userId と path は必須です" }, { status: 400 });

  const db = getDb();
  const rows = db
    .prepare(
      `SELECT path, week_start, week_end, score, organic_sessions, ai_sessions, data
       FROM seo_analysis WHERE user_id = ? AND path = ? ORDER BY week_start ASC LIMIT 52`
    )
    .all(userId, path) as { path: string; week_start: string; week_end: string | null; score: number; organic_sessions: number; ai_sessions: number; data: string }[];

  const points: WeekPoint[] = [];
  const queryPoints: QueryPoint[] = [];
  for (const r of rows) {
    let d: Record<string, unknown> = {};
    try {
      d = JSON.parse(r.data || "{}");
    } catch {
      d = {};
    }
    const sc = (d.sc as { avgPos?: number; totalImp?: number; totalClicks?: number; queries?: { q: string; pos: number; imp: number; clicks: number }[] } | null) || null;
    const hr: HistoryRow = {
      path: r.path,
      week_start: r.week_start,
      week_end: r.week_end,
      score: r.score,
      organic_sessions: r.organic_sessions,
      ai_sessions: r.ai_sessions,
      analyzed_at: (d.analyzedAt as string) || null,
      crawl_ok: "crawlOk" in d ? (d.crawlOk ? 1 : 0) : null,
      title: (d.title as string) || null,
      description: (d.description as string) || null,
      h1: (d.h1 as string) || null,
      avg_pos: sc?.avgPos ?? null,
      total_imp: sc?.totalImp ?? null,
      total_clicks: sc?.totalClicks ?? null,
    };
    points.push(toPoint(hr));
    for (const q of sc?.queries || []) {
      queryPoints.push({ q: q.q, week: r.week_start, pos: q.pos, imp: q.imp, clicks: q.clicks });
    }
  }

  // クエリ別推移: 期間全体で表示回数の多い上位8クエリ
  const impByQuery = new Map<string, number>();
  for (const qp of queryPoints) impByQuery.set(qp.q, (impByQuery.get(qp.q) || 0) + qp.imp);
  const topQueries = [...impByQuery.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([q]) => q);
  const queries = topQueries.map((q) => ({
    q,
    totalImp: impByQuery.get(q) || 0,
    byWeek: Object.fromEntries(queryPoints.filter((p) => p.q === q).map((p) => [p.week, { pos: p.pos, imp: p.imp, clicks: p.clicks }])),
  }));

  return NextResponse.json({ points, queries, changes: detectChanges(path, points) });
}
