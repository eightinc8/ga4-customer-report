import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { redirect } from "next/navigation";
import Header from "@/components/Header";

interface ReportRow {
  user_id: number;
  company_name: string;
  login_id: string;
  week_start: string;
  week_end: string;
  sessions: number;
  pageviews: number;
  users_count: number;
  bounce_rate: number;
  avg_session_duration: number;
  prev_sessions: number;
  prev_pageviews: number;
  prev_users_count: number;
  prev_bounce_rate: number;
  new_users: number;
  returning_users: number;
  prev_new_users: number;
  prev_returning_users: number;
  traffic_sources: string;
}

function changeRate(current: number, previous: number): string {
  if (previous === 0) return "-";
  const diff = ((current - previous) / previous) * 100;
  const sign = diff > 0 ? "+" : "";
  return `${sign}${diff.toFixed(1)}%`;
}

export default async function AdminReportsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const db = getDb();

  const latestReports = db
    .prepare(
      `SELECT u.company_name, u.login_id, r.*
       FROM reports r
       JOIN users u ON r.user_id = u.id
       WHERE r.id IN (
         SELECT MAX(id) FROM reports GROUP BY user_id
       )
       ORDER BY r.sessions DESC`
    )
    .all() as ReportRow[];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header companyName={session.companyName} role={session.role} />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <h2 className="text-xl font-bold text-gray-800 mb-6">全顧客レポート</h2>

        {latestReports.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <p className="text-gray-500">レポートデータがありません</p>
          </div>
        ) : (
          <div className="space-y-6">
            {latestReports.map((r) => (
              <a key={r.login_id} href={`/admin/reports/${r.user_id}`} className="block bg-white rounded-lg border border-gray-200 p-6 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-800">{r.company_name} <span className="text-sm font-normal text-blue-600">→ 詳細</span></h3>
                  <span className="text-sm text-gray-500">
                    {r.week_start} 〜 {r.week_end}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">セッション</p>
                    <p className="text-xl font-bold text-gray-900">{r.sessions.toLocaleString()}</p>
                    <p className={`text-xs ${r.sessions >= r.prev_sessions ? "text-green-600" : "text-red-600"}`}>
                      前週比 {changeRate(r.sessions, r.prev_sessions)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">PV</p>
                    <p className="text-xl font-bold text-gray-900">{r.pageviews.toLocaleString()}</p>
                    <p className={`text-xs ${r.pageviews >= r.prev_pageviews ? "text-green-600" : "text-red-600"}`}>
                      前週比 {changeRate(r.pageviews, r.prev_pageviews)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">ユーザー（全体）</p>
                    <p className="text-xl font-bold text-gray-900">{r.users_count.toLocaleString()}</p>
                    <p className={`text-xs ${r.users_count >= r.prev_users_count ? "text-green-600" : "text-red-600"}`}>
                      前週比 {changeRate(r.users_count, r.prev_users_count)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">新規ユーザー</p>
                    <p className="text-xl font-bold text-blue-600">{(r.new_users || 0).toLocaleString()}</p>
                    <p className={`text-xs ${(r.new_users || 0) >= (r.prev_new_users || 0) ? "text-green-600" : "text-red-600"}`}>
                      前週比 {changeRate(r.new_users || 0, r.prev_new_users || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">リピーター</p>
                    <p className="text-xl font-bold text-orange-600">{(r.returning_users || 0).toLocaleString()}</p>
                    <p className={`text-xs ${(r.returning_users || 0) >= (r.prev_returning_users || 0) ? "text-green-600" : "text-red-600"}`}>
                      前週比 {changeRate(r.returning_users || 0, r.prev_returning_users || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">直帰率</p>
                    <p className="text-xl font-bold text-gray-900">{r.bounce_rate.toFixed(1)}%</p>
                    <p className={`text-xs ${r.bounce_rate <= r.prev_bounce_rate ? "text-green-600" : "text-red-600"}`}>
                      前週比 {changeRate(r.bounce_rate, r.prev_bounce_rate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">平均セッション時間</p>
                    <p className="text-xl font-bold text-gray-900">{Math.round(r.avg_session_duration)}秒</p>
                  </div>
                </div>

                {/* 流入元バー */}
                {(() => {
                  let ts: { direct?: number; organic_search?: number; ai_search?: number; social?: number; other?: number };
                  try { ts = JSON.parse(r.traffic_sources || "{}"); } catch { ts = {}; }
                  const d = ts.direct || 0, o = ts.organic_search || 0, a = ts.ai_search || 0, s = ts.social || 0, ot = ts.other || 0;
                  const total = d + o + a + s + ot;
                  if (total === 0) return null;
                  const items = [
                    { label: "直接", v: d, c: "bg-blue-500" },
                    { label: "自然検索", v: o, c: "bg-green-500" },
                    { label: "AI", v: a, c: "bg-purple-500" },
                    { label: "SNS", v: s, c: "bg-pink-500" },
                    { label: "他", v: ot, c: "bg-gray-400" },
                  ];
                  return (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-xs text-gray-500 mb-1.5">流入元</p>
                      <div className="flex h-2.5 rounded-full overflow-hidden mb-1.5">
                        {items.filter(i => i.v > 0).map((item, idx) => (
                          <div key={idx} className={item.c} style={{ width: `${(item.v / total) * 100}%` }} />
                        ))}
                      </div>
                      <div className="flex gap-3 text-xs text-gray-500">
                        {items.filter(i => i.v > 0).map((item, idx) => (
                          <span key={idx} className="flex items-center gap-1">
                            <span className={`inline-block w-2 h-2 rounded-full ${item.c}`} />
                            {item.label} {item.v.toLocaleString()}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </a>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
