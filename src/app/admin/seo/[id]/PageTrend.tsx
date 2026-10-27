"use client";

import { useEffect, useMemo, useState } from "react";
import { ChangeEvent, CHANGE_FIELD_LABEL, dateLabel, weekLabel, WeekPoint } from "@/lib/seo-history";

interface QuerySeries {
  q: string;
  totalImp: number;
  byWeek: Record<string, { pos: number; imp: number; clicks: number }>;
}

interface HistoryResponse {
  points: WeekPoint[];
  queries: QuerySeries[];
  changes: ChangeEvent[];
}

const LINE = "#2563eb"; // blue-600（単一系列なので1色）
const GRID = "#e5e7eb";
const INK_MUTED = "#6b7280";
const MARK = "#d97706"; // amber-600: 変更を観測した週の印

/**
 * 1系列の折れ線グラフ（SVG）。順位は小さいほど良いので invert=true で上が1位
 * - 線2px・マーカー8px（白2pxリング）・薄い実線グリッド・ホバーで最寄り点のツールチップ
 */
function LineChart({
  title,
  points,
  value,
  invert = false,
  changeWeeks,
  unit = "",
}: {
  title: string;
  points: WeekPoint[];
  value: (p: WeekPoint) => number | null;
  invert?: boolean;
  changeWeeks: Map<string, string>; // week → 変更項目のラベル
  unit?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 360;
  const H = 150;
  const padL = 34;
  const padR = 14;
  const padT = 16;
  const padB = 24;

  const data = points.map((p, i) => ({ i, week: p.week, v: value(p) }));
  const vals = data.map((d) => d.v).filter((v): v is number => v !== null);
  if (vals.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-3">
        <p className="text-xs font-bold text-gray-700 mb-1">{title}</p>
        <p className="text-[11px] text-gray-400">データがありません</p>
      </div>
    );
  }
  // 順位は上端を常に1位に、回数は下端を0に固定する
  const min = invert ? 1 : 0;
  let max = Math.max(...vals);
  if (max <= min) max = min + 1;
  const pad = (max - min) * 0.1;
  const lo = min;
  const hi = max + pad;

  const x = (i: number) => (data.length === 1 ? (padL + (W - padR)) / 2 : padL + ((W - padL - padR) * i) / (data.length - 1));
  const y = (v: number) => {
    const t = (v - lo) / (hi - lo);
    return invert ? padT + (H - padT - padB) * t : H - padB - (H - padT - padB) * t;
  };
  const ticks = 3;
  const tickVals = Array.from({ length: ticks }, (_, k) => lo + ((hi - lo) * k) / (ticks - 1));
  const pathD = data
    .filter((d) => d.v !== null)
    .map((d, k) => `${k === 0 ? "M" : "L"}${x(d.i).toFixed(1)},${y(d.v as number).toFixed(1)}`)
    .join(" ");
  const last = [...data].reverse().find((d) => d.v !== null);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 relative">
      <p className="text-xs font-bold text-gray-700 mb-1">{title}</p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label={`${title}の週別推移`}
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * W;
          let best = 0;
          let bestD = Infinity;
          for (const d of data) {
            const dd = Math.abs(x(d.i) - px);
            if (dd < bestD) {
              bestD = dd;
              best = d.i;
            }
          }
          setHover(best);
        }}
        onMouseLeave={() => setHover(null)}
      >
        {tickVals.map((tv) => (
          <g key={tv}>
            <line x1={padL} x2={W - padR} y1={y(tv)} y2={y(tv)} stroke={GRID} strokeWidth={1} />
            <text x={padL - 4} y={y(tv) + 3} fontSize={9} fill={INK_MUTED} textAnchor="end">
              {invert ? Math.round(tv) : Math.round(tv).toLocaleString()}
            </text>
          </g>
        ))}
        {data.map((d) =>
          changeWeeks.has(d.week) ? (
            <g key={`c${d.i}`}>
              <line x1={x(d.i)} x2={x(d.i)} y1={padT - 6} y2={H - padB} stroke={MARK} strokeWidth={1} />
              <text x={x(d.i)} y={padT - 8} fontSize={8} fill={MARK} textAnchor="middle">
                {changeWeeks.get(d.week)}
              </text>
            </g>
          ) : null
        )}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke="#9ca3af" strokeWidth={1} />}
        {pathD && <path d={pathD} fill="none" stroke={LINE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
        {data.map((d) =>
          d.v !== null ? (
            <circle key={d.i} cx={x(d.i)} cy={y(d.v)} r={hover === d.i ? 5 : 4} fill={LINE} stroke="#fff" strokeWidth={2} />
          ) : null
        )}
        {last && last.v !== null && (
          <text x={Math.min(x(last.i) + 6, W - 2)} y={y(last.v) - 7} fontSize={10} fill="#111827" textAnchor={x(last.i) > W - 40 ? "end" : "start"}>
            {invert ? `${last.v.toFixed(1)}位` : `${Math.round(last.v).toLocaleString()}${unit}`}
          </text>
        )}
        {data.map((d, k) =>
          k === 0 || k === data.length - 1 || (data.length > 6 && k % Math.ceil(data.length / 5) === 0) ? (
            <text key={`x${d.i}`} x={x(d.i)} y={H - 8} fontSize={9} fill={INK_MUTED} textAnchor={k === 0 ? "start" : k === data.length - 1 ? "end" : "middle"}>
              {weekLabel(d.week)}
            </text>
          ) : null
        )}
      </svg>
      {hover !== null && (
        <div className="absolute top-8 right-3 text-[11px] bg-gray-900 text-white rounded px-2 py-1 pointer-events-none">
          {weekLabel(data[hover].week)}: {data[hover].v === null ? "データなし" : invert ? `${(data[hover].v as number).toFixed(1)}位` : `${Math.round(data[hover].v as number).toLocaleString()}${unit}`}
          {changeWeeks.has(data[hover].week) && <span className="text-amber-300"> ・{changeWeeks.get(data[hover].week)}変更</span>}
        </div>
      )}
    </div>
  );
}

/** 詳細パネル用: 週別推移（グラフ＋表）、クエリ別順位、変更イベント */
export default function PageTrend({ userId, path }: { userId: number; path: string }) {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/seo-history?userId=${userId}&path=${encodeURIComponent(path)}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "取得に失敗しました");
        if (alive) setData(j);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [userId, path]);

  const changeWeeks = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of data?.changes || []) {
      const l = CHANGE_FIELD_LABEL[c.field];
      m.set(c.week, m.has(c.week) ? `${m.get(c.week)}・${l}` : l);
    }
    return m;
  }, [data]);

  if (error) return <p className="text-xs text-red-600">{error}</p>;
  if (!data) return <p className="text-xs text-gray-400">推移を読み込み中…</p>;

  const pts = data.points;
  const weeks = pts.map((p) => p.week);
  const recentWeeks = weeks.slice(-8);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-bold text-gray-700">週別の推移（{pts.length}週分）</h4>
        {changeWeeks.size > 0 && <span className="text-[11px] text-amber-700">縦線 = タイトル・説明文・h1 の変更を観測した週</span>}
      </div>

      {pts.length >= 2 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <LineChart title="平均掲載順位（上ほど良い）" points={pts} value={(p) => (p.imp && p.imp > 0 ? p.avgPos : null)} invert changeWeeks={changeWeeks} />
          <LineChart title="検索での表示回数 / 週" points={pts} value={(p) => p.imp} changeWeeks={changeWeeks} unit="回" />
          <LineChart title="自然検索セッション / 週" points={pts} value={(p) => p.organic} changeWeeks={changeWeeks} />
        </div>
      ) : (
        <p className="text-[11px] text-gray-500 bg-gray-50 border border-gray-200 rounded px-3 py-2 mb-3">
          推移グラフは2週分以上たまると表示されます（毎週月曜の分析で1週分ずつ増えます）。
        </p>
      )}

      {/* 週別テーブル（グラフの表ビュー） */}
      <div className="overflow-x-auto">
        <table className="text-[11px] bg-white border border-gray-200 rounded w-full">
          <thead>
            <tr className="text-gray-400 border-b border-gray-100">
              <th className="text-left px-2 py-1">週</th>
              <th className="text-left px-2 py-1">クロール日</th>
              <th className="text-right px-2 py-1">順位</th>
              <th className="text-right px-2 py-1">表示</th>
              <th className="text-right px-2 py-1">クリック</th>
              <th className="text-right px-2 py-1">自然検索</th>
              <th className="text-right px-2 py-1">スコア</th>
              <th className="text-left px-2 py-1">変更</th>
            </tr>
          </thead>
          <tbody>
            {[...pts].reverse().map((p) => (
              <tr key={p.week} className={`border-b border-gray-50 ${changeWeeks.has(p.week) ? "bg-amber-50" : ""}`}>
                <td className="px-2 py-1 text-gray-800 whitespace-nowrap">{weekLabel(p.week)}</td>
                <td className="px-2 py-1 text-gray-500 whitespace-nowrap">{dateLabel(p.analyzedAt)}</td>
                <td className="px-2 py-1 text-right tabular-nums">{p.imp && p.imp > 0 && p.avgPos !== null ? p.avgPos.toFixed(1) : "-"}</td>
                <td className="px-2 py-1 text-right tabular-nums">{p.imp !== null ? p.imp.toLocaleString() : "-"}</td>
                <td className="px-2 py-1 text-right tabular-nums">{p.clicks !== null ? p.clicks.toLocaleString() : "-"}</td>
                <td className="px-2 py-1 text-right tabular-nums">{p.organic.toLocaleString()}</td>
                <td className="px-2 py-1 text-right tabular-nums">{p.crawlOk ? p.score : <span className="text-red-500">取得失敗</span>}</td>
                <td className="px-2 py-1 text-amber-700">{changeWeeks.get(p.week) || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* クエリ別の順位推移 */}
      {data.queries.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <p className="text-[11px] text-gray-500 mb-1">検索クエリ別の順位（直近{recentWeeks.length}週・表示回数の多い順）</p>
          <table className="text-[11px] bg-white border border-gray-200 rounded">
            <thead>
              <tr className="text-gray-400 border-b border-gray-100">
                <th className="text-left px-2 py-1">クエリ</th>
                {recentWeeks.map((w) => (
                  <th key={w} className={`text-right px-2 py-1 whitespace-nowrap ${changeWeeks.has(w) ? "text-amber-700" : ""}`}>
                    {weekLabel(w)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.queries.map((qs) => (
                <tr key={qs.q} className="border-b border-gray-50">
                  <td className="px-2 py-1 text-gray-800 whitespace-nowrap">{qs.q}</td>
                  {recentWeeks.map((w) => {
                    const c = qs.byWeek[w];
                    return (
                      <td key={w} className="px-2 py-1 text-right tabular-nums" title={c ? `表示${c.imp}・クリック${c.clicks}` : ""}>
                        {c ? c.pos.toFixed(1) : <span className="text-gray-300">-</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 変更イベント */}
      {data.changes.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] text-gray-500 mb-1">このページで検出した変更</p>
          <ul className="space-y-1 text-xs">
            {[...data.changes].reverse().map((c, i) => (
              <li key={i} className="bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                <span className="font-medium text-amber-800">{weekLabel(c.week)}（{dateLabel(c.observedAt)}観測）{CHANGE_FIELD_LABEL[c.field]}を変更</span>
                <div className="text-gray-500 mt-0.5 break-words">前: {c.before || "（なし）"}</div>
                <div className="text-gray-900 break-words">後: {c.after || "（なし）"}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
