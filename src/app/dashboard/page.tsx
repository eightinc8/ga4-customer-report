import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import ReportCard from "@/components/ReportCard";
import PdfDownloadButton from "@/components/PdfDownloadButton";

interface Report {
  id: number;
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
  prev_avg_session_duration: number;
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "admin") redirect("/admin");

  const db = getDb();
  const reports = db
    .prepare(
      "SELECT * FROM reports WHERE user_id = ? ORDER BY week_start DESC LIMIT 12"
    )
    .all(session.id) as Report[];

  const latest = reports[0] || null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header companyName={session.companyName} role={session.role} />

      <main className="max-w-6xl mx-auto px-6 py-8">
        {!latest ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <p className="text-gray-500">まだレポートデータがありません</p>
            <p className="text-sm text-gray-400 mt-2">
              データは毎週自動的に更新されます
            </p>
          </div>
        ) : (
          <>
            <div id="report-content" className="bg-white rounded-lg border border-gray-200 p-8 mb-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-800">
                  週次レポート - {session.companyName} 様
                </h2>
                <PdfDownloadButton
                  companyName={session.companyName}
                  weekStart={latest.week_start}
                  weekEnd={latest.week_end}
                />
              </div>

              <p className="text-sm text-gray-500 mb-4">
                対象期間: {latest.week_start} 〜 {latest.week_end}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                <ReportCard
                  label="セッション数"
                  current={latest.sessions}
                  previous={latest.prev_sessions}
                />
                <ReportCard
                  label="ページビュー"
                  current={latest.pageviews}
                  previous={latest.prev_pageviews}
                />
                <ReportCard
                  label="ユーザー数"
                  current={latest.users_count}
                  previous={latest.prev_users_count}
                />
                <ReportCard
                  label="直帰率"
                  current={latest.bounce_rate}
                  previous={latest.prev_bounce_rate}
                  isPercentage
                  invertColor
                />
                <ReportCard
                  label="平均セッション時間"
                  current={Math.round(latest.avg_session_duration)}
                  previous={Math.round(latest.prev_avg_session_duration)}
                  unit="秒"
                />
              </div>
            </div>

            {reports.length > 1 && (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <h3 className="text-sm font-medium text-gray-700 px-5 py-3 border-b border-gray-200">
                  過去のレポート
                </h3>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-5 py-2 text-gray-500 font-medium">期間</th>
                      <th className="text-right px-5 py-2 text-gray-500 font-medium">セッション</th>
                      <th className="text-right px-5 py-2 text-gray-500 font-medium">PV</th>
                      <th className="text-right px-5 py-2 text-gray-500 font-medium">ユーザー</th>
                      <th className="text-right px-5 py-2 text-gray-500 font-medium">直帰率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((r) => (
                      <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-5 py-2 text-gray-700">
                          {r.week_start} 〜 {r.week_end}
                        </td>
                        <td className="text-right px-5 py-2 text-gray-700">
                          {r.sessions.toLocaleString()}
                        </td>
                        <td className="text-right px-5 py-2 text-gray-700">
                          {r.pageviews.toLocaleString()}
                        </td>
                        <td className="text-right px-5 py-2 text-gray-700">
                          {r.users_count.toLocaleString()}
                        </td>
                        <td className="text-right px-5 py-2 text-gray-700">
                          {r.bounce_rate.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
