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

/** サイト全体の変更履歴（タイトル・説明文・h1）と前後の効果 */
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
  const [open, setOpen] = useState(true);
  const visible = changes.filter((c) => filter === "all" || c.group === filter);

  return (
    <div className="bg-white rounded-lg border border-gray-200 mt-8">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-5 py-3 text-left">
        <div>
          <h3 className="text-sm font-bold text-gray-800">
            タイトル・説明文・h1 の変更履歴と効果
            <span className="ml-2 text-xs font-normal text-gray-500">{changes.length}件</span>
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            毎週のクロール結果を前の週と比べて変更を自動で記録し、変更前後（最大4週ずつ）の平均順位・表示・クリック・自然検索を並べます。
            {firstWeek && <>（履歴は {weekLabel(firstWeek)} から・現在 {weeksAvailable}週分）</>}
          </p>
        </div>
        <span className="text-xs text-gray-400">{open ? "閉じる ▲" : "開く ▼"}</span>
      </button>

      {open && (
        <div className="border-t border-gray-100">
          {groupsConfigured && changes.length > 0 && (
            <div className="flex items-center gap-2 px-5 py-3 text-sm">
              <span className="text-gray-500">表示:</span>
              {(["all", ...GROUP_ORDER] as Filter[]).map((f) => {
                const count = f === "all" ? changes.length : changes.filter((c) => c.group === f).length;
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

          {visible.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-500">
              {changes.length === 0 ? (
                <>
                  <p>変更はまだ検出されていません。</p>
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
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium whitespace-nowrap">観測週 / 日</th>
                    <th className="text-left px-3 py-2 font-medium">ページ・項目</th>
                    <th className="text-left px-3 py-2 font-medium w-[36%]">変更前 → 変更後</th>
                    <th className="text-left px-3 py-2 font-medium whitespace-nowrap">平均順位</th>
                    <th className="text-left px-3 py-2 font-medium whitespace-nowrap">表示 / 週</th>
                    <th className="text-left px-3 py-2 font-medium whitespace-nowrap">クリック / 週</th>
                    <th className="text-left px-3 py-2 font-medium whitespace-nowrap">自然検索 / 週</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((c, i) => {
                    const meta = GROUP_META[c.group];
                    const thin = c.effect.afterWeeks < 2;
                    return (
                      <tr key={`${c.path}-${c.field}-${c.week}-${i}`} className="border-t border-gray-100 align-top">
                        <td className="px-3 py-2 whitespace-nowrap">
                          <p className="text-gray-800 font-medium">{weekLabel(c.week)}</p>
                          <p className="text-gray-400">{dateLabel(c.observedAt)}</p>
                        </td>
                        <td className="px-3 py-2 min-w-[11rem]">
                          <p className="text-gray-800 break-words">
                            {groupsConfigured && <span className={`mr-1 text-[10px] px-1.5 py-0.5 rounded border ${meta.badge}`}>{meta.short}</span>}
                            {c.path}
                          </p>
                          <p className="text-[11px] text-amber-700">{CHANGE_FIELD_LABEL[c.field]}</p>
                        </td>
                        <td className="px-3 py-2">
                          <p className="text-gray-500 break-words">前: {c.before || "（なし）"}</p>
                          <p className="text-gray-900 break-words">後: {c.after || "（なし）"}</p>
                        </td>
                        <td className="px-3 py-2"><Delta pair={c.effect.pos} kind="pos" /></td>
                        <td className="px-3 py-2"><Delta pair={c.effect.imp} kind="count" /></td>
                        <td className="px-3 py-2"><Delta pair={c.effect.clicks} kind="count" /></td>
                        <td className="px-3 py-2">
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
            </div>
          )}
          <p className="text-[11px] text-gray-400 px-5 py-3 border-t border-gray-100">
            ※ 変更は週1回のクロールで検出するため、記録される日付は「変更後の内容を初めて観測した週」です。効果は変更後2〜4週分たまってから判断してください。順位は表示回数のあった週だけで平均しています。
          </p>
        </div>
      )}
    </div>
  );
}
