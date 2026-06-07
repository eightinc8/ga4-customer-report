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
       ORDER BY u.company_name`
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

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
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
                    <p className="text-xs text-gray-500">ユーザー</p>
                    <p className="text-xl font-bold text-gray-900">{r.users_count.toLocaleString()}</p>
                    <p className={`text-xs ${r.users_count >= r.prev_users_count ? "text-green-600" : "text-red-600"}`}>
                      前週比 {changeRate(r.users_count, r.prev_users_count)}
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
              </a>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
