"use client";

import { useMemo, useState } from "react";
import { GROUP_META, GROUP_ORDER, GroupKey } from "@/lib/seo-groups";

export interface SeoRow {
  path: string;
  score: number;
  organic: number;
  ai: number;
  data: Record<string, unknown>;
  group: GroupKey;
}

interface Check {
  id: string;
  label: string;
  ok: boolean;
  weight: number;
  detail: string;
  advice: string;
}
interface Query {
  q: string;
  clicks: number;
  imp: number;
  ctr: number;
  pos: number;
}
interface Sc {
  queries?: Query[];
  missed?: Query[];
  avgPos?: number;
  totalQueries?: number;
  totalImp?: number;
  totalClicks?: number;
}

type SortKey = "organic" | "score" | "imp" | "ai";
type Filter = GroupKey | "all";

function scoreColor(score: number) {
  if (score >= 80) return "bg-green-100 text-green-700";
  if (score >= 60) return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
}

function scOf(r: SeoRow): Sc | null {
  const sc = r.data.sc as Sc | null | undefined;
  return sc && Array.isArray(sc.queries) && sc.queries.length > 0 ? sc : null;
}

export default function SeoTable({ rows, groupsConfigured }: { rows: SeoRow[]; groupsConfigured: boolean }) {
  const hasService = rows.some((r) => r.group === "service");
  const [filter, setFilter] = useState<Filter>(groupsConfigured && hasService ? "service" : "all");
  const [sort, setSort] = useState<SortKey>("organic");
  const [open, setOpen] = useState<Set<string>>(new Set());

  const visible = useMemo(() => {
    const arr = rows.filter((r) => filter === "all" || r.group === filter);
    arr.sort((a, b) => {
      if (sort === "score") return a.score - b.score;
      if (sort === "ai") return b.ai - a.ai;
      if (sort === "imp") return (scOf(b)?.totalImp ?? 0) - (scOf(a)?.totalImp ?? 0);
      return b.organic - a.organic;
    });
    return arr;
  }, [rows, filter, sort]);

  const analyzed = rows.filter((r) => "crawlOk" in r.data);
  const pending = rows.length - analyzed.length;
  const avg = analyzed.length ? Math.round(analyzed.reduce((s, r) => s + r.score, 0) / analyzed.length) : 0;
  const needFix = analyzed.filter((r) => r.score < 60).length;
  const hasSc = rows.some((r) => scOf(r) !== null);

  // 分類ごとの集計
  const groupStats = useMemo(
    () =>
      GROUP_ORDER.map((g) => {
        const rs = rows.filter((r) => r.group === g);
        const an = rs.filter((r) => "crawlOk" in r.data);
        let imp = 0, clicks = 0, posW = 0;
        for (const r of rs) {
          const sc = scOf(r);
          if (!sc) continue;
          imp += sc.totalImp ?? 0;
          clicks += sc.totalClicks ?? 0;
          posW += (sc.avgPos ?? 0) * (sc.totalImp ?? 0);
        }
        return {
          g,
          pages: rs.length,
          avg: an.length ? Math.round(an.reduce((s, r) => s + r.score, 0) / an.length) : null,
          low: an.filter((r) => r.score < 60).length,
          organic: rs.reduce((s, r) => s + r.organic, 0),
          imp,
          clicks,
          avgPos: imp > 0 ? posW / imp : null,
        };
      }),
    [rows]
  );

  function toggle(path: string) {
    setOpen((prev) => {
      const n = new Set(prev);
      if (n.has(path)) n.delete(path);
      else n.add(path);
      return n;
    });
  }

  return (
    <>
      {/* サマリー */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500">分析ページ数</p>
          <p className="text-2xl font-bold text-gray-900">{rows.length}</p>
          {pending > 0 && <p className="text-xs text-blue-600">解析中 {pending}件（再読み込みで更新）</p>}
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500">平均スコア</p>
          <p className="text-2xl font-bold text-gray-900">{avg}<span className="text-sm text-gray-400"> /100</span></p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500">要改善（60点未満）</p>
          <p className="text-2xl font-bold text-red-600">{needFix}<span className="text-sm text-gray-400"> ページ</span></p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Search Console</p>
          <p className={`text-sm font-bold mt-1 ${hasSc ? "text-green-600" : "text-gray-400"}`}>{hasSc ? "連携済み" : "未連携"}</p>
          {!hasSc && <p className="text-xs text-gray-400">キーワード分析にはSC権限が必要</p>}
        </div>
      </div>

      {/* 分類別サマリー（クリックで絞り込み） */}
      {groupsConfigured ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {groupStats.map((s) => {
            const meta = GROUP_META[s.g];
            const active = filter === s.g;
            return (
              <button
                key={s.g}
                onClick={() => setFilter(active ? "all" : s.g)}
                className={`text-left bg-white rounded-lg border p-4 transition-all ${active ? "border-blue-500 ring-2 ring-blue-100" : "border-gray-200 hover:border-blue-300"}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded border ${meta.badge}`}>{meta.label}</span>
                  <span className="text-xs text-gray-500">{s.pages}ページ</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-[10px] text-gray-400">平均スコア</p>
                    <p className={`text-lg font-bold ${s.avg == null ? "text-gray-300" : s.avg >= 80 ? "text-green-600" : s.avg >= 60 ? "text-yellow-600" : "text-red-600"}`}>{s.avg ?? "-"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400">自然検索/週</p>
                    <p className="text-lg font-bold text-gray-800">{s.organic.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400">SC表示 / 順位</p>
                    <p className="text-lg font-bold text-gray-800">
                      {s.imp > 0 ? s.imp.toLocaleString() : "-"}
                      <span className="text-xs font-normal text-gray-400"> / {s.avgPos != null ? s.avgPos.toFixed(1) : "-"}</span>
                    </p>
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 mt-2">要改善 {s.low}ページ{s.imp > 0 ? ` ・ クリック ${s.clicks.toLocaleString()}` : ""}</p>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-6">
          「ページ分類の設定」でサービス（CV直結）と集客（コラム・事例）のディレクトリを登録すると、分類ごとの集計と絞り込みができ、サービスページは流入が少なくても必ず分析対象に含まれるようになります。
        </p>
      )}

      {/* 絞り込み・並び替え */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-3 text-sm">
        {groupsConfigured && (
          <div className="flex items-center gap-2">
            <span className="text-gray-500">表示:</span>
            {(["all", ...GROUP_ORDER] as Filter[]).map((f) => {
              const count = f === "all" ? rows.length : rows.filter((r) => r.group === f).length;
              const label = f === "all" ? "すべて" : GROUP_META[f].label;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-md border text-xs ${filter === f ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
                >
                  {label} <span className="opacity-60">{count}</span>
                </button>
              );
            })}
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-gray-500">並び順:</span>
          {([
            ["organic", "自然検索の流入が多い順"],
            ["imp", "検索での表示が多い順（伸びしろ）"],
            ["score", "スコアが低い順（要改善）"],
            ["ai", "AI検索の流入が多い順"],
          ] as [SortKey, string][]).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setSort(k)}
              className={`px-3 py-1.5 rounded-md border text-xs ${sort === k ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 一覧 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-gray-500 font-medium w-10">#</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">ページ</th>
              <th className="text-right px-4 py-3 text-gray-500 font-medium">自然検索</th>
              <th className="text-right px-4 py-3 text-gray-500 font-medium">AI検索</th>
              <th className="text-right px-4 py-3 text-gray-500 font-medium" title="Search Console の表示回数">表示</th>
              <th className="text-right px-4 py-3 text-gray-500 font-medium">順位</th>
              <th className="text-center px-4 py-3 text-gray-500 font-medium">スコア</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">主な課題</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">
                  この分類に該当するページはまだありません。ルール登録後、次回の分析から対象に含まれます。
                </td>
              </tr>
            )}
            {visible.map((r, i) => {
              const d = r.data;
              const isAnalyzed = "crawlOk" in d;
              const title = (d.title as string) || "";
              const url = (d.url as string) || "";
              const checks = (d.checks as Check[]) || [];
              const sc = scOf(r);
              const fails = checks.filter((c) => !c.ok);
              const isOpen = open.has(r.path);
              const meta = GROUP_META[r.group];
              return (
                <FragmentRow key={r.path}>
                  <tr className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => toggle(r.path)}>
                    <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-3">
                      {url ? (
                        <a href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-blue-600 hover:underline block truncate max-w-md">
                          {title || r.path}
                        </a>
                      ) : (
                        <p className="text-gray-800 truncate max-w-md">{title || r.path}</p>
                      )}
                      <p className="text-xs text-gray-400 truncate max-w-md flex items-center gap-1.5">
                        {groupsConfigured && (
                          <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded border ${meta.badge}`}>{meta.short}</span>
                        )}
                        <span className="truncate">{r.path}</span>
                      </p>
                    </td>
                    <td className="text-right px-4 py-3 text-gray-800 font-medium">{r.organic.toLocaleString()}</td>
                    <td className="text-right px-4 py-3 text-gray-700">{r.ai}</td>
                    <td className="text-right px-4 py-3 text-gray-700">{sc && sc.totalImp ? sc.totalImp.toLocaleString() : "-"}</td>
                    <td className="text-right px-4 py-3 text-gray-700">{sc && sc.avgPos ? sc.avgPos.toFixed(1) : "-"}</td>
                    <td className="text-center px-4 py-3">
                      {isAnalyzed ? (
                        <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold ${scoreColor(r.score)}`}>{r.score}</span>
                      ) : (
                        <span className="text-xs text-blue-500">解析中</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {fails.slice(0, 3).map((c) => (
                          <span key={c.id} className="text-[11px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-100">{c.label.replace(/（.*?）/, "")}</span>
                        ))}
                        {fails.length > 3 && <span className="text-[11px] text-gray-400">+{fails.length - 3}</span>}
                        {isAnalyzed && fails.length === 0 && <span className="text-[11px] text-green-600">課題なし</span>}
                      </div>
                    </td>
                  </tr>

                  {isOpen && isAnalyzed && (
                    <tr className="bg-gray-50 border-t border-gray-100">
                      <td colSpan={8} className="px-6 py-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* チェックリスト */}
                          <div>
                            <h4 className="text-xs font-bold text-gray-700 mb-2">チェック項目（できている / できていない）</h4>
                            <div className="space-y-1.5">
                              {checks.map((c) => (
                                <div key={c.id} className="flex items-start gap-2 text-xs">
                                  <span className={`mt-0.5 shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] ${c.ok ? "bg-green-500" : "bg-red-500"}`}>{c.ok ? "✓" : "✗"}</span>
                                  <div>
                                    <p className="text-gray-800">{c.label} <span className="text-gray-400">— {c.detail}</span></p>
                                    {!c.ok && c.advice && <p className="text-red-600 mt-0.5">→ {c.advice}</p>}
                                  </div>
                                </div>
                              ))}
                            </div>

                            <h4 className="text-xs font-bold text-gray-700 mt-4 mb-2">ページ情報</h4>
                            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
                              <dt className="text-gray-400">タイトル文字数</dt><dd>{String(d.titleCoreLen ?? d.titleLen ?? "-")}字<span className="text-gray-400">（サイト名込み {String(d.titleLen ?? "-")}字）</span></dd>
                              <dt className="text-gray-400">説明文文字数</dt><dd>{String(d.descLen ?? "-")}字</dd>
                              <dt className="text-gray-400">本文文字数</dt><dd>{Number(d.bodyChars ?? 0).toLocaleString()}字</dd>
                              <dt className="text-gray-400">見出し(h2)</dt><dd>{String(d.h2Count ?? "-")}個</dd>
                              <dt className="text-gray-400">内部 / 外部リンク</dt><dd>{String(d.internalLinks ?? "-")} / {String(d.externalLinks ?? "-")}本</dd>
                              <dt className="text-gray-400">公開日 / 更新日</dt><dd>{String(d.publishedAt ?? "-")} / {String(d.modifiedAt ?? "-")}</dd>
                              <dt className="text-gray-400">公開からの日数</dt><dd>{d.ageDays != null ? `${d.ageDays}日` : "-"}</dd>
                            </dl>
                            {d.description ? <p className="text-xs text-gray-500 mt-2 bg-white border border-gray-200 rounded p-2">説明文: {String(d.description)}</p> : null}
                          </div>

                          {/* 検索クエリ */}
                          <div>
                            {sc && sc.queries && sc.queries.length > 0 ? (
                              <>
                                <h4 className="text-xs font-bold text-gray-700 mb-2">
                                  流入している検索クエリ TOP10（全{sc.totalQueries ?? 0}クエリ・表示 {(sc.totalImp ?? 0).toLocaleString()}回・クリック {(sc.totalClicks ?? 0).toLocaleString()}回）
                                </h4>
                                <table className="w-full text-xs bg-white border border-gray-200 rounded">
                                  <thead><tr className="text-gray-400 border-b border-gray-100">
                                    <th className="text-left px-2 py-1">クエリ</th><th className="text-right px-2 py-1">クリック</th><th className="text-right px-2 py-1">表示</th><th className="text-right px-2 py-1">CTR</th><th className="text-right px-2 py-1">順位</th>
                                  </tr></thead>
                                  <tbody>
                                    {sc.queries.map((q, qi) => (
                                      <tr key={qi} className="border-b border-gray-50">
                                        <td className="px-2 py-1 text-gray-800">{q.q}</td>
                                        <td className="text-right px-2 py-1">{q.clicks}</td>
                                        <td className="text-right px-2 py-1">{q.imp.toLocaleString()}</td>
                                        <td className="text-right px-2 py-1">{q.ctr.toFixed(1)}%</td>
                                        <td className="text-right px-2 py-1">{q.pos.toFixed(1)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>

                                {sc.missed && sc.missed.length > 0 && (
                                  <>
                                    <h4 className="text-xs font-bold text-red-700 mt-4 mb-2">取りこぼしクエリ（表示は多いのにクリックされていない）</h4>
                                    <div className="flex flex-wrap gap-1.5">
                                      {sc.missed.map((q, qi) => (
                                        <span key={qi} className="text-[11px] px-2 py-1 rounded bg-red-50 text-red-700 border border-red-100" title={`表示${q.imp} / 順位${q.pos.toFixed(1)} / CTR${q.ctr.toFixed(1)}%`}>
                                          {q.q} <span className="text-red-400">({q.pos.toFixed(0)}位)</span>
                                        </span>
                                      ))}
                                    </div>
                                    <p className="text-[11px] text-gray-400 mt-1">→ これらの語をタイトル・見出し・本文に取り込むと伸びしろがあります。</p>
                                  </>
                                )}
                              </>
                            ) : (
                              <div className="text-xs text-gray-400 bg-white border border-gray-200 rounded p-3">
                                Search Consoleのデータがありません。サイトURLの設定と、GAS実行アカウントへのSearch Console閲覧権限の付与が必要です。
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </FragmentRow>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 mt-3">
        ※ 行をクリックすると詳細（チェック項目・検索クエリ）が開きます。スコアは項目ごとの重み付け合計を100点換算した目安です（採点基準は上の「詳しく見る」）。
      </p>
    </>
  );
}

function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
