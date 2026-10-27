"use client";

import { useState } from "react";
import { GROUP_META, GROUP_ORDER, GroupKey } from "@/lib/seo-groups";
import { ChangeEvent, CHANGE_FIELD_LABEL, countDelta, dateLabel, MetricPair, posDelta, weekLabel } from "@/lib/seo-history";

export interface ChangeRow extends ChangeEvent {
  group: GroupKey;
}

type Filter = GroupKey | "all";

function Delta({ pair, kind }: { pair: MetricPair; kind: "pos" | "count" }) {
  if (kind === "pos") {
    const d = posDelta(pair);
    return (
      <span className="whitespace-nowrap tabular-nums">
        {pair.before === null ? "-" : pair.before.toFixed(1)} → {pair.after === null ? "-" : pair.after.toFixed(1)}
        {d.delta !== null && d.delta !== 0 && (
          <span className={`ml-1 font-medium ${d.good ? "text-green-700" : "text-red-700"}`}>
            {d.good ? "▲" : "▼"} {d.label}
          </span>
        )}
      </span>
    );
  }
  const d = countDelta(pair);
  return (
    <span className="whitespace-nowrap tabular-nums">
      {pair.before === null ? "-" : Math.round(pair.before).toLocaleString()} → {pair.after === null ? "-" : Math.round(pair.after).toLocaleString()}
      {d.delta !== null && d.delta !== 0 && (
        <span className={`ml-1 font-medium ${d.good ? "text-green-700" : "text-red-700"}`}>
          {d.good ? "▲" : "▼"}
          {d.pct !== null ? ` ${Math.abs(d.pct)}%` : ` ${Math.abs(d.delta)}`}
        </span>
      )}
    </span>
  );
}

/** サイト全体の変更履歴（タイトル・説明文・h1）と前後の効果。SeoTable の「変更履歴」タブの中身 */
export default function ChangeHistory({
  changes,
  weeksAvailable,
  firstWeek,
  groupsConfigured,
}: {
  changes: ChangeRow[];
  weeksAvailable: number;
  firstWeek: string | null;
  groupsConfigured: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const visible = changes.filter((c) => filter === "all" || c.group === filter);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-gray-100">
        <p className="text-xs text-gray-500">
          毎週のクロール結果を前の週と比べ、タイトル・説明文・h1 が変わった週を自動で記録。変更前後（最大4週ずつ）の平均順位・表示・クリック・自然検索を並べます。
          {firstWeek && <span className="ml-1 text-gray-400">履歴 {weekLabel(firstWeek)}〜 ・ {weeksAvailable}週分</span>}
        </p>
        {groupsConfigured && changes.length > 0 && (
          <div className="flex items-center gap-1 text-xs">
            {(["all", ...GROUP_ORDER] as Filter[]).map((f) => {
              const count = f === "all" ? changes.length : changes.filter((c) => c.group === f).length;
              const label = f === "all" ? "すべて" : GROUP_META[f].label;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-md border ${filter === f ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}
                >
                  {label} <span className="opacity-60">{count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm text-gray-500">
          {changes.length === 0 ? (
            <>
              <p className="font-medium text-gray-700">変更はまだ検出されていません</p>
              <p className="text-xs text-gray-400 mt-1">
                {weeksAvailable < 2
                  ? "比較には2週分の結果が必要です。次回の週次分析（月曜）から、前の週と違うタイトル・説明文・h1 があればここに並びます。"
                  : "現在の履歴の範囲では、タイトル・説明文・h1 はどのページも変わっていません。"}
              </p>
            </>
          ) : (
            <p>この分類に該当する変更はありません。</p>
          )}
        </div>
      ) : (
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
            <tr>
              <th className="text-left px-3 py-2.5 font-medium whitespace-nowrap">観測週</th>
              <th className="text-left px-3 py-2.5 font-medium min-w-[11rem]">ページ・項目</th>
              <th className="text-left px-3 py-2.5 font-medium w-[36%]">変更前 → 変更後</th>
              <th className="text-left px-3 py-2.5 font-medium whitespace-nowrap">平均順位</th>
              <th className="text-left px-3 py-2.5 font-medium whitespace-nowrap">表示 / 週</th>
              <th className="text-left px-3 py-2.5 font-medium whitespace-nowrap">クリック / 週</th>
              <th className="text-left px-3 py-2.5 font-medium whitespace-nowrap">自然検索 / 週</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((c, i) => {
              const meta = GROUP_META[c.group];
              const thin = c.effect.afterWeeks < 2;
              return (
                <tr key={`${c.path}-${c.field}-${c.week}-${i}`} className="border-b border-gray-100 align-top">
                  <td className="px-3 py-3 whitespace-nowrap">
                    <p className="text-gray-900 font-semibold">{weekLabel(c.week)}</p>
                    <p className="text-gray-400">{dateLabel(c.observedAt)} 観測</p>
                  </td>
                  <td className="px-3 py-3">
                    <p className="text-gray-900 font-semibold break-words">
                      {groupsConfigured && <span className={`mr-1 text-[10px] px-1.5 py-0.5 rounded border font-normal ${meta.badge}`}>{meta.short}</span>}
                      {c.path}
                    </p>
                    <p className="text-amber-700 mt-0.5">{CHANGE_FIELD_LABEL[c.field]}を変更</p>
                  </td>
                  <td className="px-3 py-3">
                    <p className="text-gray-500 break-words">前: {c.before || "（なし）"}</p>
                    <p className="text-gray-900 break-words mt-0.5">後: {c.after || "（なし）"}</p>
                  </td>
                  <td className="px-3 py-3"><Delta pair={c.effect.pos} kind="pos" /></td>
                  <td className="px-3 py-3"><Delta pair={c.effect.imp} kind="count" /></td>
                  <td className="px-3 py-3"><Delta pair={c.effect.clicks} kind="count" /></td>
                  <td className="px-3 py-3">
                    <Delta pair={c.effect.organic} kind="count" />
                    <p className="text-[10px] text-gray-400 mt-0.5 whitespace-nowrap">
                      前{c.effect.beforeWeeks}週 / 後{c.effect.afterWeeks}週の平均{thin ? "（判定はまだ早い）" : ""}
                    </p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <p className="text-xs text-gray-400 px-5 py-3 border-t border-gray-100">
        変更は週1回のクロールで検出するため、日付は「変更後の内容を初めて観測した週」です。効果は変更後2〜4週分たまってから判断してください。順位は表示回数のあった週だけで平均しています。
      </p>
    </div>
  );
}
