"use client";

import { useMemo, useState } from "react";
import { GROUP_META, GroupKey } from "@/lib/seo-groups";
import { buildSiteContext, buildTitleAdvice, findDuplicateTitles, TitleAdvice, TitleSource } from "@/lib/seo-title";
import TitleAdviceBlock, { CurrentTitle, TitleStatusBadge } from "./TitleAdviceBlock";
import PageTrend from "./PageTrend";
import ChangeHistory, { ChangeRow } from "./ChangeHistory";
import { CHANGE_FIELD_LABEL, ChangeField, weekLabel } from "@/lib/seo-history";

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

type Tab = GroupKey | "all" | "history";
type Mode = "list" | "title";
type SortKey = "imp" | "pos" | "clicks" | "organic" | "score" | "ai";
type DetailTab = "title" | "trend" | "checks" | "queries";

function scOf(r: SeoRow): Sc | null {
  const sc = r.data.sc as Sc | null | undefined;
  return sc && Array.isArray(sc.queries) && sc.queries.length > 0 ? sc : null;
}

function scoreClass(score: number) {
  if (score >= 80) return "text-green-700";
  if (score >= 60) return "text-yellow-700";
  return "text-red-700";
}

function posClass(pos: number | null) {
  if (pos === null) return "text-gray-300";
  if (pos <= 10) return "text-green-700 font-semibold";
  if (pos <= 20) return "text-yellow-700 font-semibold";
  return "text-gray-700";
}

export default function SeoTable({
  rows,
  groupsConfigured,
  companyName,
  userId,
  lastChange = {},
  changes,
  weeksAvailable,
  firstWeek,
}: {
  rows: SeoRow[];
  groupsConfigured: boolean;
  companyName: string;
  userId: number;
  lastChange?: Record<string, { week: string; field: string }>;
  changes: ChangeRow[];
  weeksAvailable: number;
  firstWeek: string | null;
}) {
  const hasService = rows.some((r) => r.group === "service");
  const hasSc = rows.some((r) => scOf(r) !== null);
  const [tab, setTab] = useState<Tab>(groupsConfigured && hasService ? "service" : "all");
  const [mode, setMode] = useState<Mode>("list");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: hasSc ? "imp" : "organic", dir: "desc" });
  const [open, setOpen] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("title");

  // タイトル改善アドバイス（サイト共通末尾・地域語・重複タイトルは全ページから判定）
  const advice = useMemo(() => {
    const analyzedRows = rows.filter((r) => "crawlOk" in r.data);
    const sources = analyzedRows.map((r) => ({ ...(r.data as unknown as TitleSource), path: r.path }));
    const ctx = buildSiteContext(sources, companyName);
    const dups = findDuplicateTitles(sources.map((s) => ({ path: s.path || "", title: s.title })));
    const m = new Map<string, TitleAdvice>();
    for (const s of sources) {
      const t = (s.title || "").replace(/\s+/g, " ").trim();
      const dupPaths = (dups.get(t) || []).filter((p) => p !== s.path);
      m.set(s.path || "", buildTitleAdvice(s, ctx, dupPaths));
    }
    return m;
  }, [rows, companyName]);

  const inTab = (r: SeoRow) => tab === "all" || tab === "history" || r.group === tab;

  const visible = useMemo(() => {
    const arr = rows.filter(inTab);
    const val = (r: SeoRow): number | null => {
      const sc = scOf(r);
      switch (sort.key) {
        case "imp":
          return sc?.totalImp ?? null;
        case "pos":
          return sc && sc.totalImp ? (sc.avgPos ?? null) : null;
        case "clicks":
          return sc?.totalClicks ?? null;
        case "organic":
          return r.organic;
        case "ai":
          return r.ai;
        case "score":
          return r.score;
      }
    };
    arr.sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      if (va === null && vb === null) return 0;
      if (va === null) return 1; // データ無しは常に末尾
      if (vb === null) return -1;
      return sort.dir === "desc" ? vb - va : va - vb;
    });
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, tab, sort]);

  // タブごとの要点
  const summary = useMemo(() => {
    const rs = rows.filter(inTab);
    let imp = 0,
      clicks = 0,
      posW = 0;
    for (const r of rs) {
      const sc = scOf(r);
      if (!sc) continue;
      imp += sc.totalImp ?? 0;
      clicks += sc.totalClicks ?? 0;
      posW += (sc.avgPos ?? 0) * (sc.totalImp ?? 0);
    }
    const analyzed = rs.filter((r) => "crawlOk" in r.data);
    return {
      pages: rs.length,
      pending: rs.length - analyzed.length,
      imp,
      clicks,
      avgPos: imp > 0 ? posW / imp : null,
      organic: rs.reduce((s, r) => s + r.organic, 0),
      titleFix: rs.filter((r) => advice.get(r.path)?.status === "fix").length,
      low: analyzed.filter((r) => r.score < 60).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, tab, advice]);

  const maxImp = Math.max(1, ...visible.map((r) => scOf(r)?.totalImp ?? 0));

  function clickSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: key === "pos" ? "asc" : "desc" }));
  }
  function toggle(path: string) {
    setOpen((o) => (o === path ? null : path));
    setDetailTab("title");
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    ...(groupsConfigured
      ? [
          { key: "service" as Tab, label: GROUP_META.service.label, count: rows.filter((r) => r.group === "service").length },
          { key: "content" as Tab, label: GROUP_META.content.label, count: rows.filter((r) => r.group === "content").length },
        ]
      : []),
    { key: "all", label: groupsConfigured ? "すべて" : "分析ページ", count: rows.length },
    { key: "history", label: "変更履歴", count: changes.length },
  ];

  const Th = ({ k, label, align = "right", title }: { k: SortKey; label: string; align?: "left" | "right"; title?: string }) => {
    const active = sort.key === k;
    return (
      <th
        className={`px-3 py-2.5 font-medium text-xs select-none cursor-pointer whitespace-nowrap ${align === "right" ? "text-right" : "text-left"} ${active ? "text-gray-900" : "text-gray-500 hover:text-gray-800"}`}
        onClick={() => clickSort(k)}
        title={title || "クリックで並び替え"}
      >
        {label}
        <span className={`ml-0.5 ${active ? "text-blue-600" : "text-gray-300"}`}>{active ? (sort.dir === "desc" ? "▼" : "▲") : "▽"}</span>
      </th>
    );
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* タブ */}
      <div className="flex items-end justify-between gap-3 px-4 pt-2 border-b border-gray-200">
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm border-b-2 -mb-px transition-colors ${tab === t.key ? "border-blue-600 text-blue-700 font-bold" : "border-transparent text-gray-500 hover:text-gray-800"}`}
            >
              {t.label}
              <span className={`ml-1.5 text-xs ${tab === t.key ? "text-blue-500" : "text-gray-400"}`}>{t.count}</span>
            </button>
          ))}
        </div>
        {tab !== "history" && (
          <div className="flex items-center gap-1 pb-2 text-xs print:hidden">
            {(
              [
                ["list", "一覧"],
                ["title", "タイトル改善"],
              ] as [Mode, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setMode(k)}
                className={`px-3 py-1.5 rounded-md border ${mode === k ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === "history" ? (
        <ChangeHistory changes={changes} weeksAvailable={weeksAvailable} firstWeek={firstWeek} groupsConfigured={groupsConfigured} />
      ) : (
        <>
          {/* 要点 1行 */}
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2 px-5 py-4 border-b border-gray-100">
            <Stat label="ページ" value={summary.pages.toLocaleString()} sub={summary.pending > 0 ? `解析中 ${summary.pending}` : undefined} />
            {hasSc ? (
              <>
                <Stat label="検索での表示 / 週" value={summary.imp.toLocaleString()} />
                <Stat label="クリック / 週" value={summary.clicks.toLocaleString()} />
                <Stat label="平均順位" value={summary.avgPos !== null ? summary.avgPos.toFixed(1) : "-"} sub="表示回数で加重" />
              </>
            ) : (
              <span className="text-xs text-gray-400">Search Console 未連携（順位・表示は取れていません）</span>
            )}
            <Stat label="自然検索 / 週" value={summary.organic.toLocaleString()} />
            <Stat label="タイトル要変更" value={summary.titleFix.toLocaleString()} tone={summary.titleFix > 0 ? "warn" : "ok"} />
            <Stat label="スコア60未満" value={summary.low.toLocaleString()} tone={summary.low > 0 ? "warn" : "ok"} />
          </div>

          {visible.length === 0 && (
            <p className="px-5 py-10 text-center text-sm text-gray-400">この分類に該当するページはまだありません。ルール登録後、次回の分析から対象に含まれます。</p>
          )}

          {/* タイトル改善モード: ページごとのカード */}
          {mode === "title" && visible.length > 0 && (
            <div className="p-4 space-y-3 bg-gray-50">
              <p className="text-xs text-gray-500">
                「本来のタイトル」はサイト内の他ページと共通の末尾（店名・キャッチコピー）を除いた部分。変更例は主要クエリ・h1・店名から機械的に組んだ案なので、文言は整えてからお使いください。
              </p>
              {visible.map((r, i) => {
                const a = advice.get(r.path);
                const sc = scOf(r);
                return (
                  <TitleAdviceBlock
                    key={r.path}
                    a={a}
                    header={
                      <RowHeader index={i + 1} r={r} sc={sc} groupsConfigured={groupsConfigured} last={lastChange[r.path]} />
                    }
                  />
                );
              })}
            </div>
          )}

          {/* 一覧モード */}
          {mode === "list" && visible.length > 0 && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 w-8">#</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500">ページ</th>
                  {hasSc && <Th k="imp" label="検索表示" title="Search Console の週間表示回数。棒は一覧内の最大値との比" />}
                  {hasSc && <Th k="pos" label="順位" title="表示回数で加重した平均掲載順位（10位以内=緑、20位以内=黄）" />}
                  {hasSc && <Th k="clicks" label="クリック" />}
                  <Th k="organic" label="自然検索" title="GA4 の自然検索セッション / 週" />
                  <Th k="score" label="スコア" title="ページ内容の採点（100点満点）" />
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 min-w-[15rem]">タイトルの状態</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r, i) => {
                  const d = r.data;
                  const isAnalyzed = "crawlOk" in d;
                  const sc = scOf(r);
                  const a = advice.get(r.path);
                  const isOpen = open === r.path;
                  const imp = sc?.totalImp ?? null;
                  const pos = sc && sc.totalImp ? (sc.avgPos ?? null) : null;
                  const meta = GROUP_META[r.group];
                  const url = (d.url as string) || "";
                  return (
                    <RowGroup key={r.path}>
                      <tr className={`border-b border-gray-100 cursor-pointer ${isOpen ? "bg-blue-50/60" : "hover:bg-gray-50"}`} onClick={() => toggle(r.path)}>
                        <td className="px-3 py-3 text-xs text-gray-400 align-top">{i + 1}</td>
                        <td className="px-3 py-3 align-top">
                          <div className="flex items-center gap-2">
                            {groupsConfigured && tab === "all" && <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded border ${meta.badge}`}>{meta.short}</span>}
                            <span className="font-semibold text-gray-900 break-all">{r.path}</span>
                            {url && (
                              <a href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-xs text-blue-500 hover:underline shrink-0" title="ページを開く">
                                開く ↗
                              </a>
                            )}
                            {lastChange[r.path] && (
                              <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 shrink-0">
                                {weekLabel(lastChange[r.path].week)} {CHANGE_FIELD_LABEL[lastChange[r.path].field as ChangeField] ?? lastChange[r.path].field}変更
                              </span>
                            )}
                          </div>
                          <p className="text-xs mt-0.5 max-w-2xl line-clamp-2">
                            {a ? <CurrentTitle a={a} /> : isAnalyzed ? <span className="text-gray-400">（タイトルなし）</span> : <span className="text-blue-500">解析中</span>}
                          </p>
                        </td>
                        {hasSc && (
                          <td className="px-3 py-3 align-top text-right">
                            {imp !== null ? (
                              <div className="flex items-center justify-end gap-2">
                                <span className="tabular-nums text-gray-900">{imp.toLocaleString()}</span>
                                <span className="inline-block w-16 h-1.5 bg-gray-100 rounded-sm overflow-hidden">
                                  <span className="block h-full bg-blue-500 rounded-sm" style={{ width: `${Math.max(2, (imp / maxImp) * 100)}%` }} />
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                        )}
                        {hasSc && (
                          <td className={`px-3 py-3 align-top text-right tabular-nums ${posClass(pos)}`}>{pos !== null ? pos.toFixed(1) : "-"}</td>
                        )}
                        {hasSc && <td className="px-3 py-3 align-top text-right tabular-nums text-gray-900">{sc ? (sc.totalClicks ?? 0).toLocaleString() : <span className="text-gray-300">-</span>}</td>}
                        <td className="px-3 py-3 align-top text-right tabular-nums text-gray-900">{r.organic.toLocaleString()}</td>
                        <td className={`px-3 py-3 align-top text-right tabular-nums ${isAnalyzed ? scoreClass(r.score) : "text-blue-500"}`}>{isAnalyzed ? r.score : "…"}</td>
                        <td className="px-3 py-3 align-top">
                          {a && (
                            <div className="flex items-start gap-2">
                              <TitleStatusBadge status={a.status} />
                              <span className="text-xs text-gray-600 leading-5">{a.tags.slice(0, 3).join("・")}</span>
                            </div>
                          )}
                        </td>
                      </tr>

                      {isOpen && isAnalyzed && (
                        <tr className="border-b border-gray-200 bg-gray-50">
                          <td colSpan={hasSc ? 8 : 5} className="px-5 py-4">
                            <div className="flex items-center gap-1 mb-3 text-xs">
                              {(
                                [
                                  ["title", "タイトル改善"],
                                  ["trend", "推移"],
                                  ["checks", "チェック項目"],
                                  ["queries", "検索クエリ"],
                                ] as [DetailTab, string][]
                              ).map(([k, label]) => (
                                <button
                                  key={k}
                                  onClick={() => setDetailTab(k)}
                                  className={`px-3 py-1.5 rounded-md border ${detailTab === k ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-100"}`}
                                >
                                  {label}
                                </button>
                              ))}
                              <button onClick={() => setOpen(null)} className="ml-auto text-gray-400 hover:text-gray-700 px-2">閉じる ✕</button>
                            </div>
                            {detailTab === "title" && a && <TitleAdviceBlock a={a} />}
                            {detailTab === "trend" && <PageTrend userId={userId} path={r.path} />}
                            {detailTab === "checks" && <ChecksPanel d={d} />}
                            {detailTab === "queries" && <QueriesPanel sc={sc} />}
                          </td>
                        </tr>
                      )}
                    </RowGroup>
                  );
                })}
              </tbody>
            </table>
          )}
          <p className="text-xs text-gray-400 px-5 py-3 border-t border-gray-100">
            行をクリックすると「タイトル改善・推移・チェック項目・検索クエリ」が開きます。列見出しのクリックで並び替え。
          </p>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "warn" | "ok" }) {
  return (
    <div>
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className={`text-xl font-bold leading-tight ${tone === "warn" ? "text-red-600" : tone === "ok" ? "text-green-700" : "text-gray-900"}`}>
        {value}
        {sub && <span className="ml-1.5 text-[11px] font-normal text-gray-400">{sub}</span>}
      </p>
    </div>
  );
}

function RowHeader({
  index,
  r,
  sc,
  groupsConfigured,
  last,
}: {
  index: number;
  r: SeoRow;
  sc: Sc | null;
  groupsConfigured: boolean;
  last?: { week: string; field: string };
}) {
  const meta = GROUP_META[r.group];
  const url = (r.data.url as string) || "";
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
      <span className="text-gray-400">{index}</span>
      {groupsConfigured && <span className={`text-[10px] px-1.5 py-0.5 rounded border ${meta.badge}`}>{meta.short}</span>}
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-700 hover:underline break-all">{r.path}</a>
      ) : (
        <span className="font-semibold text-gray-900 break-all">{r.path}</span>
      )}
      {sc && (
        <span className="tabular-nums">
          表示 {(sc.totalImp ?? 0).toLocaleString()} ・ 順位 {sc.totalImp && sc.avgPos ? sc.avgPos.toFixed(1) : "-"} ・ クリック {(sc.totalClicks ?? 0).toLocaleString()}
        </span>
      )}
      <span className="tabular-nums">自然検索 {r.organic.toLocaleString()}</span>
      {last && (
        <span className="text-amber-700">
          最終変更 {weekLabel(last.week)}（{CHANGE_FIELD_LABEL[last.field as ChangeField] ?? last.field}）
        </span>
      )}
    </div>
  );
}

function ChecksPanel({ d }: { d: Record<string, unknown> }) {
  const checks = (d.checks as Check[]) || [];
  const fails = checks.filter((c) => !c.ok);
  const oks = checks.filter((c) => c.ok);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <h4 className="text-xs font-bold text-gray-700 mb-2">できていない項目 {fails.length}</h4>
        {fails.length === 0 && <p className="text-xs text-green-700">すべての項目をクリアしています。</p>}
        <div className="space-y-2">
          {fails.map((c) => (
            <div key={c.id} className="bg-white border border-gray-200 rounded p-2.5 text-xs">
              <p className="text-gray-900 font-medium">
                ✗ {c.label} <span className="text-gray-400 font-normal">— {c.detail}</span>
              </p>
              {c.advice && <p className="text-gray-600 mt-1">→ {c.advice}</p>}
            </div>
          ))}
        </div>
        <h4 className="text-xs font-bold text-gray-500 mt-4 mb-1">できている項目 {oks.length}</h4>
        <p className="text-xs text-gray-500 leading-6">{oks.map((c) => c.label.replace(/（.*?）/, "")).join(" ・ ")}</p>
      </div>
      <div>
        <h4 className="text-xs font-bold text-gray-700 mb-2">ページ情報</h4>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs text-gray-700">
          <dt className="text-gray-400">説明文</dt>
          <dd>{d.description ? `${String(d.descLen)}字 — ${String(d.description)}` : <span className="text-red-600">未設定</span>}</dd>
          <dt className="text-gray-400">本文</dt>
          <dd>{Number(d.bodyChars ?? 0).toLocaleString()}字 ・ h2 {String(d.h2Count ?? "-")}個</dd>
          <dt className="text-gray-400">リンク</dt>
          <dd>内部 {String(d.internalLinks ?? "-")} / 外部 {String(d.externalLinks ?? "-")}本</dd>
          <dt className="text-gray-400">公開 / 更新</dt>
          <dd>
            {String(d.publishedAt ?? "-")} / {String(d.modifiedAt ?? "-")}
            {d.ageDays != null && <span className="text-gray-400">（公開から{String(d.ageDays)}日）</span>}
          </dd>
          <dt className="text-gray-400">AI検索流入</dt>
          <dd>{String(d.aiSessions ?? 0)}セッション</dd>
        </dl>
      </div>
    </div>
  );
}

function QueriesPanel({ sc }: { sc: Sc | null }) {
  if (!sc || !sc.queries || sc.queries.length === 0) {
    return (
      <p className="text-xs text-gray-500">
        Search Console のデータがありません。サイトURLの設定と、GAS実行アカウントへの Search Console 閲覧権限の付与が必要です。
      </p>
    );
  }
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <h4 className="text-xs font-bold text-gray-700 mb-2">
          流入している検索クエリ TOP10
          <span className="font-normal text-gray-400 ml-2">全{sc.totalQueries ?? 0}クエリ ・ 表示 {(sc.totalImp ?? 0).toLocaleString()} ・ クリック {(sc.totalClicks ?? 0).toLocaleString()}</span>
        </h4>
        <table className="w-full text-xs bg-white border border-gray-200 rounded">
          <thead>
            <tr className="text-gray-400 border-b border-gray-100">
              <th className="text-left px-2 py-1.5">クエリ</th>
              <th className="text-right px-2 py-1.5">表示</th>
              <th className="text-right px-2 py-1.5">クリック</th>
              <th className="text-right px-2 py-1.5">CTR</th>
              <th className="text-right px-2 py-1.5">順位</th>
            </tr>
          </thead>
          <tbody>
            {sc.queries.map((q, qi) => (
              <tr key={qi} className="border-b border-gray-50">
                <td className="px-2 py-1.5 text-gray-800">{q.q}</td>
                <td className="text-right px-2 py-1.5 tabular-nums">{q.imp.toLocaleString()}</td>
                <td className="text-right px-2 py-1.5 tabular-nums">{q.clicks}</td>
                <td className="text-right px-2 py-1.5 tabular-nums">{q.ctr.toFixed(1)}%</td>
                <td className={`text-right px-2 py-1.5 tabular-nums ${posClass(q.pos)}`}>{q.pos.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <h4 className="text-xs font-bold text-gray-700 mb-2">取りこぼしクエリ（表示は多いのにクリックされていない）</h4>
        {sc.missed && sc.missed.length > 0 ? (
          <>
            <div className="flex flex-wrap gap-1.5">
              {sc.missed.map((q, qi) => (
                <span key={qi} className="text-xs px-2 py-1 rounded bg-white border border-gray-200 text-gray-800" title={`表示${q.imp} / 順位${q.pos.toFixed(1)} / CTR${q.ctr.toFixed(1)}%`}>
                  {q.q} <span className="text-gray-400">{q.pos.toFixed(0)}位</span>
                </span>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">これらの語をタイトル・見出し・本文に取り込むと伸びしろがあります。</p>
          </>
        ) : (
          <p className="text-xs text-gray-500">該当なし</p>
        )}
      </div>
    </div>
  );
}

function RowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
