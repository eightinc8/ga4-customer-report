import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import SeoTable, { SeoRow } from "./SeoTable";

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
  if (session.role !== "admin") redirect("/dashboard");

  const { id } = await params;
  const db = getDb();

  const customer = db
    .prepare("SELECT id, company_name, ga4_property_id FROM users WHERE id = ? AND role = 'customer'")
    .get(parseInt(id)) as User | undefined;
  if (!customer) redirect("/admin");

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
        return { path: r.path, score: r.score, organic: r.organic_sessions, ai: r.ai_sessions, data };
      })
    : [];

  const weekEnd = rows.length > 0 ? ((db.prepare("SELECT week_end FROM seo_analysis WHERE user_id = ? AND week_start = ? LIMIT 1").get(customer.id, latest!.week_start) as { week_end: string | null } | undefined)?.week_end ?? null) : null;

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
              自然検索の流入が多い上位ページを、タイトル・説明文・本文・リンク・鮮度・検索クエリの観点で採点します。
            </p>
          </div>
          {latest && (
            <p className="text-sm text-gray-500">
              分析対象週: <span className="font-medium text-gray-700">{latest.week_start}{weekEnd ? ` 〜 ${weekEnd}` : ""}</span>
              {weeks.length > 1 && <span className="ml-2 text-xs text-gray-400">（履歴 {weeks.length}週分）</span>}
            </p>
          )}
        </div>

        {rows.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <p className="text-gray-500">まだ分析データがありません。</p>
            <p className="text-xs text-gray-400 mt-2">GASの週次実行（または testSeoSingleCustomer）後に表示されます。</p>
          </div>
        ) : (
          <SeoTable rows={rows} />
        )}
      </main>
    </div>
  );
}
