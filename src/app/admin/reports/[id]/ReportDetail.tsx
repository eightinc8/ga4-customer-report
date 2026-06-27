"use client";

import { useState } from "react";
import ReportCard from "@/components/ReportCard";

interface PageItem {
  title: string;
  path: string;
  url?: string;
  views: number;
  prevViews?: number;
  trend?: number[];
}

// 推移ミニグラフ
function Sparkline({ data, color, width = 90 }: { data: number[]; color?: string; width?: number }) {
  if (!data || data.length < 2) return <span className="text-gray-300 text-xs">-</span>;
  const w = width;
  const h = 24;
  const max = Math.max(...data, 1);
  const step = w / (data.length - 1);
  const points = data.map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * (h - 2) - 1).toFixed(1)}`);
  const last = data[data.length - 1];
  const prev = data[data.length - 2];
  const lineColor = color ?? (last >= prev ? "#16a34a" : "#dc2626");
  const [lx, ly] = points[points.length - 1].split(",");
  return (
    <svg width={w} height={h} className="inline-block align-middle" aria-label="推移">
      <polyline points={points.join(" ")} fill="none" stroke={lineColor} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="2" fill={lineColor} />
    </svg>
  );
}

const CHANNEL_DEFS = [
  { key: "direct", label: "直接流入", dot: "bg-blue-500", stroke: "#3b82f6" },
  { key: "organic_search", label: "自然検索", dot: "bg-green-500", stroke: "#22c55e" },
  { key: "ai_search", label: "AI検索", dot: "bg-purple-500", stroke: "#a855f7" },
  { key: "social", label: "SNS流入", dot: "bg-pink-500", stroke: "#ec4899" },
  { key: "other", label: "その他", dot: "bg-gray-400", stroke: "#9ca3af" },
] as const;

function parseTraffic(json: string): Record<string, number> {
  try {
    return JSON.parse(json || "{}");
  } catch {
    return {};
  }
}

interface KeywordItem {
  keyword: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface TrackedPageItem {
  path: string;
  label?: string;
  url?: string;
  views: number;
  prevViews?: number;
  bounceRate: number;
  prevBounceRate?: number;
  avgEngagementTime: number;
  prevAvgEngagementTime?: number;
  scrollRate: number;
  prevScrollRate?: number;
  trend?: number[];
}

// 指標カード（前週比つき）
function Metric({
  label,
  value,
  cur,
  prev,
  invert,
}: {
  label: string;
  value: string;
  cur: number;
  prev?: number;
  invert?: boolean;
}) {
  const p = prev ?? 0;
  const diff = p === 0 ? null : ((cur - p) / p) * 100;
  const good = diff === null ? true : invert ? cur <= p : cur >= p;
  return (
    <div className="bg-white rounded-md p-3 border border-gray-100">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-bold text-gray-900">{value}</p>
      {diff === null ? (
        <p className="text-xs text-gray-400">前週比 -</p>
      ) : (
        <p className={`text-xs ${good ? "text-green-600" : "text-red-600"}`}>
          前週比 {diff > 0 ? "+" : ""}
          {diff.toFixed(1)}%
        </p>
      )}
    </div>
  );
}

interface TrafficSources {
  direct: number;
  organic_search: number;
  ai_search: number;
  social: number;
  other: number;
}

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
  new_users: number;
  returning_users: number;
  prev_new_users: number;
  prev_returning_users: number;
  top_pages: string;
  top_keywords: string;
  traffic_sources: string;
  prev_traffic_sources: string;
  tracked_pages: string;
}

type Period = "1w" | "1m" | "3m";

export default function ReportDetail({
  reports,
  companyName,
}: {
  reports: Report[];
  companyName: string;
}) {
  const [period, setPeriod] = useState<Period>("1w");

  const filteredReports = (() => {
    if (reports.length === 0) return [];
    const now = new Date();
    switch (period) {
      case "1w":
        return reports.slice(0, 1);
      case "1m": {
        const oneMonthAgo = new Date(now);
        oneMonthAgo.setMonth(now.getMonth() - 1);
        return reports.filter((r) => new Date(r.week_start) >= oneMonthAgo);
      }
      case "3m": {
        const threeMonthsAgo = new Date(now);
        threeMonthsAgo.setMonth(now.getMonth() - 3);
        return reports.filter((r) => new Date(r.week_start) >= threeMonthsAgo);
      }
    }
  })();

  const latest = reports[0] || null;

  const periodLabels: Record<Period, string> = {
    "1w": "最新週",
    "1m": "1ヶ月",
    "3m": "3ヶ月",
  };

  // 期間合計の計算（1ヶ月・3ヶ月の場合）
  const totals =
    filteredReports.length > 1
      ? {
          sessions: filteredReports.reduce((s, r) => s + r.sessions, 0),
          pageviews: filteredReports.reduce((s, r) => s + r.pageviews, 0),
          users: filteredReports.reduce((s, r) => s + r.users_count, 0),
          avgBounceRate:
            filteredReports.reduce((s, r) => s + r.bounce_rate, 0) /
            filteredReports.length,
          avgDuration:
            filteredReports.reduce((s, r) => s + r.avg_session_duration, 0) /
            filteredReports.length,
        }
      : null;

  return (
    <>
      {/* 期間切替ボタン + PDF出力 */}
      <div className="flex items-center justify-between gap-2 mb-6 print:hidden">
        <div className="flex gap-2">
          {(["1w", "1m", "3m"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                period === p
                  ? "bg-blue-600 text-white"
                  : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium transition-colors"
        >
          PDF保存 / 印刷
        </button>
      </div>

      {/* 印刷時のみ表示されるタイトル */}
      <div className="hidden print:block mb-4">
        <h2 className="text-xl font-bold text-gray-900">{companyName}</h2>
        <p className="text-sm text-gray-600">
          {periodLabels[period]}レポート
          {filteredReports.length > 0 &&
            `（${filteredReports[filteredReports.length - 1].week_start} 〜 ${filteredReports[0].week_end}）`}
        </p>
      </div>

      {!latest ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-500">レポートデータがありません</p>
        </div>
      ) : period === "1w" ? (
        /* 最新週：カード表示 */
        <div id="report-content" className="bg-white rounded-lg border border-gray-200 p-8 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800">{companyName}</h3>
            <span className="text-sm text-gray-500">
              {latest.week_start} 〜 {latest.week_end}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <ReportCard label="セッション数" current={latest.sessions} previous={latest.prev_sessions} />
            <ReportCard label="ページビュー" current={latest.pageviews} previous={latest.prev_pageviews} />
            <ReportCard label="ユーザー数" current={latest.users_count} previous={latest.prev_users_count} />
            <ReportCard label="新規ユーザー" current={latest.new_users || 0} previous={latest.prev_new_users || 0} />
            <ReportCard label="リピーター" current={latest.returning_users || 0} previous={latest.prev_returning_users || 0} />
            <ReportCard label="直帰率" current={latest.bounce_rate} previous={latest.prev_bounce_rate} isPercentage invertColor />
            <ReportCard label="平均セッション時間" current={Math.round(latest.avg_session_duration)} previous={Math.round(latest.prev_avg_session_duration)} unit="秒" />
          </div>

          {/* 流入元別セッション */}
          {(() => {
            const ts: TrafficSources = (() => { try { return JSON.parse(latest.traffic_sources || "{}"); } catch { return {}; } })();
            const pts: TrafficSources = (() => { try { return JSON.parse(latest.prev_traffic_sources || "{}"); } catch { return {}; } })();
            const hasData = (ts.direct || 0) + (ts.organic_search || 0) + (ts.ai_search || 0) + (ts.social || 0) + (ts.other || 0) > 0;
            if (!hasData) return null;
            const total = (ts.direct || 0) + (ts.organic_search || 0) + (ts.ai_search || 0) + (ts.social || 0) + (ts.other || 0);
            const items = [
              { label: "直接流入", value: ts.direct || 0, prev: pts.direct || 0, color: "bg-blue-500" },
              { label: "自然検索", value: ts.organic_search || 0, prev: pts.organic_search || 0, color: "bg-green-500" },
              { label: "AI検索", value: ts.ai_search || 0, prev: pts.ai_search || 0, color: "bg-purple-500" },
              { label: "SNS流入", value: ts.social || 0, prev: pts.social || 0, color: "bg-pink-500" },
              { label: "その他", value: ts.other || 0, prev: pts.other || 0, color: "bg-gray-400" },
            ];
            return (
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-700 mb-3">流入元別セッション</h4>
                {/* バー */}
                <div className="flex h-4 rounded-full overflow-hidden mb-3">
                  {items.filter(i => i.value > 0).map((item, idx) => (
                    <div key={idx} className={`${item.color}`} style={{ width: `${(item.value / total) * 100}%` }} title={`${item.label}: ${item.value}`} />
                  ))}
                </div>
                {/* 数値 */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {items.map((item, idx) => {
                    const diff = item.prev === 0 ? "-" : `${((item.value - item.prev) / item.prev * 100) > 0 ? "+" : ""}${((item.value - item.prev) / item.prev * 100).toFixed(1)}%`;
                    const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : "0";
                    return (
                      <div key={idx} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                          <span className="text-xs text-gray-500">{item.label}</span>
                        </div>
                        <p className="text-lg font-bold text-gray-900">{item.value.toLocaleString()}</p>
                        <p className="text-xs text-gray-400">{pct}%</p>
                        <p className={`text-xs ${item.value >= item.prev ? "text-green-600" : "text-red-600"}`}>
                          前週比 {diff}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* 登録ページの計測 */}
          {(() => {
            const tracked: TrackedPageItem[] = (() => { try { return JSON.parse(latest.tracked_pages || "[]"); } catch { return []; } })();
            if (tracked.length === 0) return null;
            return (
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-700 mb-3">登録ページの計測</h4>
                <div className="space-y-4">
                  {tracked.map((tp: TrackedPageItem, i: number) => (
                    <div key={i} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0">
                          {tp.url ? (
                            <a href={tp.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:underline truncate block">
                              {tp.label || tp.path}
                            </a>
                          ) : (
                            <p className="text-sm font-medium text-gray-800 truncate">{tp.label || tp.path}</p>
                          )}
                          <p className="text-xs text-gray-400 truncate">{tp.path}</p>
                        </div>
                        <div className="shrink-0 text-center" title={(tp.trend || []).join(" → ")}>
                          <Sparkline data={tp.trend || []} />
                          <p className="text-[10px] text-gray-400">PV推移(8週)</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <Metric label="PV" value={tp.views.toLocaleString()} cur={tp.views} prev={tp.prevViews} />
                        <Metric label="直帰率" value={`${(tp.bounceRate || 0).toFixed(1)}%`} cur={tp.bounceRate || 0} prev={tp.prevBounceRate} invert />
                        <Metric label="滞在時間" value={`${Math.round(tp.avgEngagementTime || 0)}秒`} cur={tp.avgEngagementTime || 0} prev={tp.prevAvgEngagementTime} />
                        <Metric label="スクロール率" value={`${(tp.scrollRate || 0).toFixed(1)}%`} cur={tp.scrollRate || 0} prev={tp.prevScrollRate} />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  ※ スクロール率＝ページ末尾付近（90%）まで読まれた割合の目安。滞在時間＝平均エンゲージメント時間。
                </p>
              </div>
            );
          })()}

          {/* 人気ページ */}
          {(() => {
            const pages: PageItem[] = (() => { try { return JSON.parse(latest.top_pages || "[]"); } catch { return []; } })();
            if (pages.length === 0) return null;
            return (
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-700 mb-3">人気ページ TOP20</h4>
                <div className="bg-gray-50 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left px-4 py-2 text-gray-500 font-medium w-8">#</th>
                        <th className="text-left px-4 py-2 text-gray-500 font-medium">ページタイトル</th>
                        <th className="text-right px-4 py-2 text-gray-500 font-medium">PV</th>
                        <th className="text-right px-4 py-2 text-gray-500 font-medium">前週比</th>
                        <th className="text-center px-4 py-2 text-gray-500 font-medium">推移（8週）</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pages.map((p: PageItem, i: number) => {
                        const prev = p.prevViews || 0;
                        const diff = prev === 0 ? null : ((p.views - prev) / prev) * 100;
                        return (
                        <tr key={i} className="border-b border-gray-100">
                          <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                          <td className="px-4 py-2">
                            {p.url ? (
                              <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate max-w-md block">
                                {p.title}
                              </a>
                            ) : (
                              <p className="text-gray-800 truncate max-w-md">{p.title}</p>
                            )}
                            <p className="text-xs text-gray-400 truncate max-w-md">{p.path}</p>
                          </td>
                          <td className="text-right px-4 py-2 text-gray-700 font-medium">{p.views.toLocaleString()}</td>
                          <td className="text-right px-4 py-2 text-xs">
                            {diff === null ? (
                              <span className="text-blue-500">新規</span>
                            ) : (
                              <span className={p.views >= prev ? "text-green-600" : "text-red-600"}>
                                {diff > 0 ? "+" : ""}{diff.toFixed(1)}%
                              </span>
                            )}
                          </td>
                          <td className="text-center px-4 py-2" title={(p.trend || []).join(" → ")}>
                            <Sparkline data={p.trend || []} />
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-gray-400 mt-2">※ 推移は過去8週間の週次PV。タイトルをクリックすると記事が開きます（サイトURL設定時）。</p>
              </div>
            );
          })()}

          {/* 人気キーワード */}
          {(() => {
            const keywords: KeywordItem[] = (() => { try { return JSON.parse(latest.top_keywords || "[]"); } catch { return []; } })();
            if (keywords.length === 0) return null;
            return (
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-700 mb-3">検索キーワード TOP10</h4>
                <div className="bg-gray-50 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left px-4 py-2 text-gray-500 font-medium w-8">#</th>
                        <th className="text-left px-4 py-2 text-gray-500 font-medium">キーワード</th>
                        <th className="text-right px-4 py-2 text-gray-500 font-medium">クリック</th>
                        <th className="text-right px-4 py-2 text-gray-500 font-medium">表示回数</th>
                        <th className="text-right px-4 py-2 text-gray-500 font-medium">CTR</th>
                        <th className="text-right px-4 py-2 text-gray-500 font-medium">掲載順位</th>
                      </tr>
                    </thead>
                    <tbody>
                      {keywords.map((k: KeywordItem, i: number) => (
                        <tr key={i} className="border-b border-gray-100">
                          <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                          <td className="px-4 py-2 text-gray-800">{k.keyword}</td>
                          <td className="text-right px-4 py-2 text-gray-700">{k.clicks}</td>
                          <td className="text-right px-4 py-2 text-gray-700">{k.impressions.toLocaleString()}</td>
                          <td className="text-right px-4 py-2 text-gray-700">{k.ctr}%</td>
                          <td className="text-right px-4 py-2 text-gray-700">{k.position}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      ) : (
        /* 1ヶ月・3ヶ月：合計 + 週次一覧 */
        <>
          {totals && (
            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">
                {periodLabels[period]}の合計・平均（{filteredReports.length}週分）
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                <div>
                  <p className="text-xs text-gray-500">セッション合計</p>
                  <p className="text-xl font-bold text-gray-900">{totals.sessions.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">PV合計</p>
                  <p className="text-xl font-bold text-gray-900">{totals.pageviews.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">ユーザー合計</p>
                  <p className="text-xl font-bold text-gray-900">{totals.users.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">平均直帰率</p>
                  <p className="text-xl font-bold text-gray-900">{totals.avgBounceRate.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">平均セッション時間</p>
                  <p className="text-xl font-bold text-gray-900">{Math.round(totals.avgDuration)}秒</p>
                </div>
              </div>
            </div>
          )}

          {/* 流入元別セッションの推移 */}
          {(() => {
            // 古い→新しい順に並べ替え
            const chrono = [...filteredReports].reverse();
            const channels = CHANNEL_DEFS.map((c) => {
              const weekly = chrono.map((r) => parseTraffic(r.traffic_sources)[c.key] || 0);
              const total = weekly.reduce((s, v) => s + v, 0);
              const first = weekly[0] || 0;
              const last = weekly[weekly.length - 1] || 0;
              const change = first === 0 ? null : ((last - first) / first) * 100;
              return { ...c, weekly, total, change };
            });
            const grandTotal = channels.reduce((s, c) => s + c.total, 0);
            if (grandTotal === 0) return null;

            return (
              <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-1">流入元別セッションの推移</h3>
                <p className="text-xs text-gray-400 mb-4">期間内（古い週→新しい週）で、どの流入元が伸びている/減っているかを確認できます。</p>

                {/* 期間合計の構成バー */}
                <div className="flex h-4 rounded-full overflow-hidden mb-4">
                  {channels.filter((c) => c.total > 0).map((c) => (
                    <div key={c.key} className={c.dot} style={{ width: `${(c.total / grandTotal) * 100}%` }} title={`${c.label}: ${c.total.toLocaleString()}`} />
                  ))}
                </div>

                {/* チャネル別カード */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {channels.map((c) => {
                    const pct = grandTotal > 0 ? ((c.total / grandTotal) * 100).toFixed(1) : "0";
                    return (
                      <div key={c.key} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
                          <span className="text-xs text-gray-500">{c.label}</span>
                        </div>
                        <p className="text-lg font-bold text-gray-900">{c.total.toLocaleString()}</p>
                        <p className="text-xs text-gray-400 mb-1">{pct}%</p>
                        <Sparkline data={c.weekly} color={c.stroke} width={110} />
                        <p className={`text-xs mt-1 ${c.change === null ? "text-gray-400" : c.change >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {c.change === null ? "期間内 -" : `期間内 ${c.change > 0 ? "+" : ""}${c.change.toFixed(1)}%`}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-400 mt-2">※「期間内」は最初の週と最新の週の比較です。</p>
              </div>
            );
          })()}

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-5 py-3 text-gray-500 font-medium">期間</th>
                  <th className="text-right px-5 py-3 text-gray-500 font-medium">セッション</th>
                  <th className="text-right px-5 py-3 text-gray-500 font-medium">PV</th>
                  <th className="text-right px-5 py-3 text-gray-500 font-medium">ユーザー</th>
                  <th className="text-right px-5 py-3 text-gray-500 font-medium">直帰率</th>
                  <th className="text-right px-5 py-3 text-gray-500 font-medium">前週比</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map((r) => {
                  const sessionDiff =
                    r.prev_sessions === 0
                      ? "-"
                      : `${(((r.sessions - r.prev_sessions) / r.prev_sessions) * 100).toFixed(1)}%`;
                  const isUp = r.sessions >= r.prev_sessions;
                  return (
                    <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-5 py-2 text-gray-700">
                        {r.week_start} 〜 {r.week_end}
                      </td>
                      <td className="text-right px-5 py-2 text-gray-700">{r.sessions.toLocaleString()}</td>
                      <td className="text-right px-5 py-2 text-gray-700">{r.pageviews.toLocaleString()}</td>
                      <td className="text-right px-5 py-2 text-gray-700">{r.users_count.toLocaleString()}</td>
                      <td className="text-right px-5 py-2 text-gray-700">{r.bounce_rate.toFixed(1)}%</td>
                      <td className={`text-right px-5 py-2 font-medium ${isUp ? "text-green-600" : "text-red-600"}`}>
                        {sessionDiff}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
