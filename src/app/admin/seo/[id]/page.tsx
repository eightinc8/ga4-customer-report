import { getSession, isStaff, canEdit } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import SeoTable, { SeoRow } from "./SeoTable";
import SeoGroupsManager, { Suggestion } from "./SeoGroupsManager";
import ScoringCriteria from "./ScoringCriteria";
import ChangeHistory, { ChangeRow } from "./ChangeHistory";
import { classifyPath, normalizePath, normalizePattern, GroupRule } from "@/lib/seo-groups";
import { buildHistories, detectAllChanges, HistoryRow } from "@/lib/seo-history";

interface User {
  id: number;
  company_name: string;
  ga4_property_id: string;
}

interface DbRow {
  path: string;
  data: string;
  score: number;
  organic_sessions: number;
  ai_sessions: number;
  week_start: string;
  week_end: string | null;
}

export default async function SeoAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isStaff(session.role)) redirect("/dashboard");

  const { id } = await params;
  const db = getDb();

  const customer = db
    .prepare("SELECT id, company_name, ga4_property_id FROM users WHERE id = ? AND role = 'customer'")
    .get(parseInt(id)) as User | undefined;
  if (!customer) redirect("/admin");

  const rules = db
    .prepare("SELECT id, group_key, pattern, label FROM seo_page_groups WHERE user_id = ? ORDER BY group_key DESC, pattern ASC")
    .all(customer.id) as GroupRule[];

  const latest = db
    .prepare("SELECT week_start FROM seo_analysis WHERE user_id = ? ORDER BY week_start DESC LIMIT 1")
    .get(customer.id) as { week_start: string } | undefined;

  const weeks = db
    .prepare("SELECT DISTINCT week_start FROM seo_analysis WHERE user_id = ? ORDER BY week_start DESC LIMIT 12")
    .all(customer.id) as { week_start: string }[];

  const rows: SeoRow[] = latest
    ? (
        db
          .prepare(
            "SELECT path, data, score, organic_sessions, ai_sessions, week_start, week_end FROM seo_analysis WHERE user_id = ? AND week_start = ? ORDER BY organic_sessions DESC"
          )
          .all(customer.id, latest.week_start) as DbRow[]
      ).map((r) => {
        let data: Record<string, unknown> = {};
        try {
          data = JSON.parse(r.data || "{}");
        } catch {
          data = {};
        }
        return { path: r.path, score: r.score, organic: r.organic_sessions, ai: r.ai_sessions, data, group: classifyPath(r.path, rules) };
      })
    : [];

  const weekEnd = rows.length > 0 ? ((db.prepare("SELECT week_end FROM seo_analysis WHERE user_id = ? AND week_start = ? LIMIT 1").get(customer.id, latest!.week_start) as { week_end: string | null } | undefined)?.week_end ?? null) : null;

  // 分類候補: 分析ページの先頭ディレクトリ（未分類のもの）
  const covered = new Set(rules.map((r) => normalizePattern(r.pattern)));
  const dirMap = new Map<string, Suggestion>();
  for (const r of rows) {
    const seg = normalizePath(r.path).split("/")[1];
    if (!seg) continue;
    const pattern = `/${seg}/`;
    if (covered.has(pattern)) continue;
    const cur = dirMap.get(pattern) || { pattern, pages: 0, organic: 0 };
    cur.pages += 1;
    cur.organic += r.organic;
    dirMap.set(pattern, cur);
  }
  const suggestions = [...dirMap.values()].sort((a, b) => b.pages - a.pages).slice(0, 12);

  // 変更履歴: 全週の軽量データ（JSON全体は読まず json_extract で必要な項目だけ）から
  // タイトル・説明文・h1 の変更を検出し、前後の順位・表示・クリック・自然検索を比較
  const historyRows = db
    .prepare(
      `SELECT path, week_start, week_end, score, organic_sessions, ai_sessions,
              json_extract(data, '$.analyzedAt') AS analyzed_at,
              json_extract(data, '$.crawlOk') AS crawl_ok,
              json_extract(data, '$.title') AS title,
              json_extract(data, '$.description') AS description,
              json_extract(data, '$.h1') AS h1,
              json_extract(data, '$.sc.avgPos') AS avg_pos,
              json_extract(data, '$.sc.totalImp') AS total_imp,
              json_extract(data, '$.sc.totalClicks') AS total_clicks
       FROM seo_analysis
       WHERE user_id = ? AND week_start >= (SELECT MIN(week_start) FROM (SELECT DISTINCT week_start FROM seo_analysis WHERE user_id = ? ORDER BY week_start DESC LIMIT 52))
       ORDER BY path, week_start`
    )
    .all(customer.id, customer.id) as HistoryRow[];
  const histories = buildHistories(historyRows);
  const changes: ChangeRow[] = detectAllChanges(histories).map((c) => ({ ...c, group: classifyPath(c.path, rules) }));
  const allWeeks = [...new Set(historyRows.map((r) => r.week_start))].sort();
  const lastChange: Record<string, { week: string; field: string }> = {};
  for (const c of changes) if (!lastChange[c.path]) lastChange[c.path] = { week: c.week, field: c.field };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header companyName={session.companyName} role={session.role} />
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6 print:hidden">
          <a href={`/admin/reports/${customer.id}`} className="text-sm text-blue-600 hover:text-blue-800">
            ← {customer.company_name} のレポートに戻る
          </a>
        </div>

        <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-800">{customer.company_name} — SEOページ分析</h2>
            <p className="text-sm text-gray-500 mt-1">
              自然検索の流入が多い上位ページと、CV直結のサービスページを、タイトル・説明文・本文・リンク・鮮度・検索クエリの観点で採点します。
            </p>
            <ScoringCriteria />
          </div>
          {latest && (
            <p className="text-sm text-gray-500">
              分析対象週: <span className="font-medium text-gray-700">{latest.week_start}{weekEnd ? ` 〜 ${weekEnd}` : ""}</span>
              {weeks.length > 1 && <span className="ml-2 text-xs text-gray-400">（履歴 {weeks.length}週分）</span>}
            </p>
          )}
        </div>

        <SeoGroupsManager userId={customer.id} rules={rules} suggestions={suggestions} readOnly={!canEdit(session.role)} />

        {rows.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <p className="text-gray-500">まだ分析データがありません。</p>
            <p className="text-xs text-gray-400 mt-2">GASの週次実行（または testSeoSingleCustomer）後に表示されます。</p>
          </div>
        ) : (
          <SeoTable rows={rows} groupsConfigured={rules.length > 0} companyName={customer.company_name} userId={customer.id} lastChange={lastChange} />
        )}

        {rows.length > 0 && (
          <ChangeHistory changes={changes} weeksAvailable={allWeeks.length} firstWeek={allWeeks[0] ?? null} groupsConfigured={rules.length > 0} />
        )}
      </main>
    </div>
  );
}
