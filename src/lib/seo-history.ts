/**
 * SEO分析の週次履歴
 * - seo_analysis は (user_id, week_start, path) ごとに毎週1行保存されるので、週を並べると履歴になる
 * - 連続する週でタイトル・説明文・h1 が変わっていれば「変更イベント」として検出
 * - 変更週の前後N週の順位・表示・クリック・自然検索を平均して効果を見る
 * 純粋関数のみ（サーバー・クライアント両方から利用）
 */

export interface HistoryRow {
  path: string;
  week_start: string;
  week_end: string | null;
  score: number;
  organic_sessions: number;
  ai_sessions: number;
  analyzed_at: string | null;
  crawl_ok: number | boolean | null;
  title: string | null;
  description: string | null;
  h1: string | null;
  avg_pos: number | null;
  total_imp: number | null;
  total_clicks: number | null;
}

export interface WeekPoint {
  week: string;
  weekEnd: string | null;
  analyzedAt: string | null;
  crawlOk: boolean;
  title: string;
  description: string;
  h1: string;
  score: number;
  organic: number;
  ai: number;
  avgPos: number | null;
  imp: number | null;
  clicks: number | null;
}

export type ChangeField = "title" | "description" | "h1";

export const CHANGE_FIELD_LABEL: Record<ChangeField, string> = {
  title: "タイトル",
  description: "説明文",
  h1: "h1",
};

export interface MetricPair {
  before: number | null;
  after: number | null;
}

export interface Effect {
  beforeWeeks: number; // 平均に使った週数
  afterWeeks: number;
  pos: MetricPair; // 平均順位（小さいほど良い）
  imp: MetricPair; // 週あたり表示回数
  clicks: MetricPair; // 週あたりクリック
  organic: MetricPair; // 週あたり自然検索セッション
}

export interface ChangeEvent {
  path: string;
  field: ChangeField;
  week: string; // 変更後の値を初めて観測した週
  prevWeek: string; // 変更前の値を最後に観測した週
  observedAt: string | null; // クロール日時
  before: string;
  after: string;
  effect: Effect;
}

function norm(s: string | null | undefined): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function toPoint(r: HistoryRow): WeekPoint {
  return {
    week: r.week_start,
    weekEnd: r.week_end,
    analyzedAt: r.analyzed_at,
    crawlOk: r.crawl_ok === 1 || r.crawl_ok === true,
    title: norm(r.title),
    description: norm(r.description),
    h1: norm(r.h1),
    score: r.score ?? 0,
    organic: r.organic_sessions ?? 0,
    ai: r.ai_sessions ?? 0,
    avgPos: num(r.avg_pos),
    imp: num(r.total_imp),
    clicks: num(r.total_clicks),
  };
}

/** path → 週順の履歴 */
export function buildHistories(rows: HistoryRow[]): Map<string, WeekPoint[]> {
  const m = new Map<string, WeekPoint[]>();
  for (const r of rows) {
    const arr = m.get(r.path) || [];
    arr.push(toPoint(r));
    m.set(r.path, arr);
  }
  for (const arr of m.values()) arr.sort((a, b) => a.week.localeCompare(b.week));
  return m;
}

function avg(vals: (number | null)[]): number | null {
  const xs = vals.filter((v): v is number => v !== null && Number.isFinite(v));
  if (xs.length === 0) return null;
  return Math.round((xs.reduce((s, v) => s + v, 0) / xs.length) * 10) / 10;
}

/**
 * 変更週の前後N週の平均
 * before: 変更週より前（最大N週）、after: 変更週を含むそれ以降（最大N週）
 * 順位は表示回数のある週だけで平均（SCデータが無い週は除く）
 */
export function effectOf(points: WeekPoint[], changeWeek: string, n = 4): Effect {
  const before = points.filter((p) => p.week < changeWeek).slice(-n);
  const after = points.filter((p) => p.week >= changeWeek).slice(0, n);
  const pair = (pick: (p: WeekPoint) => number | null): MetricPair => ({ before: avg(before.map(pick)), after: avg(after.map(pick)) });
  return {
    beforeWeeks: before.length,
    afterWeeks: after.length,
    pos: pair((p) => (p.imp && p.imp > 0 ? p.avgPos : null)),
    imp: pair((p) => p.imp),
    clicks: pair((p) => p.clicks),
    organic: pair((p) => p.organic),
  };
}

/** 連続する週の比較でタイトル・説明文・h1 の変更を検出（両週ともクロール成功している場合のみ） */
export function detectChanges(path: string, points: WeekPoint[], n = 4): ChangeEvent[] {
  const events: ChangeEvent[] = [];
  const fields: ChangeField[] = ["title", "description", "h1"];
  let prev: WeekPoint | null = null;
  for (const p of points) {
    if (!p.crawlOk) continue;
    if (prev) {
      for (const f of fields) {
        if (prev[f] !== p[f]) {
          events.push({ path, field: f, week: p.week, prevWeek: prev.week, observedAt: p.analyzedAt, before: prev[f], after: p[f], effect: effectOf(points, p.week, n) });
        }
      }
    }
    prev = p;
  }
  return events;
}

export function detectAllChanges(histories: Map<string, WeekPoint[]>, n = 4): ChangeEvent[] {
  const all: ChangeEvent[] = [];
  for (const [path, pts] of histories) all.push(...detectChanges(path, pts, n));
  // 新しい順 → 同じ週ならタイトル → 説明文 → h1
  const order: Record<ChangeField, number> = { title: 0, description: 1, h1: 2 };
  all.sort((a, b) => b.week.localeCompare(a.week) || a.path.localeCompare(b.path) || order[a.field] - order[b.field]);
  return all;
}

/** 順位の差分（負なら改善）。表示用に "↑3.2" のような文字列も返す */
export function posDelta(pair: MetricPair): { delta: number | null; label: string; good: boolean | null } {
  if (pair.before === null || pair.after === null) return { delta: null, label: "-", good: null };
  const d = Math.round((pair.after - pair.before) * 10) / 10;
  if (Math.abs(d) < 0.05) return { delta: 0, label: "変化なし", good: null };
  return { delta: d, label: d < 0 ? `${Math.abs(d)}位 上昇` : `${d}位 下落`, good: d < 0 };
}

/** 回数系の差分（正なら改善） */
export function countDelta(pair: MetricPair): { delta: number | null; pct: number | null; good: boolean | null } {
  if (pair.before === null || pair.after === null) return { delta: null, pct: null, good: null };
  const d = Math.round((pair.after - pair.before) * 10) / 10;
  const pct = pair.before > 0 ? Math.round(((pair.after - pair.before) / pair.before) * 100) : null;
  if (Math.abs(d) < 0.05) return { delta: 0, pct: 0, good: null };
  return { delta: d, pct, good: d > 0 };
}

/** 週の表示用: 2026-10-19 → 10/19週 */
export function weekLabel(week: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(week);
  return m ? `${parseInt(m[1], 10)}/${parseInt(m[2], 10)}週` : week;
}

/** 日時の表示用: ISO → 2026/10/27 */
export function dateLabel(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}
