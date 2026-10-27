/**
 * SEO分析のページ分類（サービス=CV直結 / 集客=コラム・事例 / その他）
 * 顧客ごとに「パスの前方一致ルール」を登録し、分析ページを分類する
 */

export type GroupKey = "service" | "content" | "other";
export type RuleGroup = Exclude<GroupKey, "other">;

export interface GroupRule {
  id?: number;
  group_key: RuleGroup;
  pattern: string;
  label?: string | null;
}

export const GROUP_ORDER: GroupKey[] = ["service", "content", "other"];

export const GROUP_META: Record<GroupKey, { label: string; short: string; badge: string; desc: string }> = {
  service: {
    label: "サービス（CV直結）",
    short: "サービス",
    badge: "bg-orange-100 text-orange-700 border-orange-200",
    desc: "サービスのカテゴリトップや各サービスページ。お問い合わせに直結するため最優先で改善する。",
  },
  content: {
    label: "集客（コラム・事例）",
    short: "集客",
    badge: "bg-sky-100 text-sky-700 border-sky-200",
    desc: "コラム・施工事例など、見込み客の入口になるページ。サービスページの次に重要。",
  },
  other: {
    label: "その他",
    short: "その他",
    badge: "bg-gray-100 text-gray-600 border-gray-200",
    desc: "会社案内・採用・お知らせなど上記以外。",
  },
};

/** クエリ・フラグメントを除き、末尾スラッシュを落とす（GA4とSCの表記差を吸収） */
export function normalizePath(p: string): string {
  let s = String(p || "").replace(/[?#].*$/, "");
  if (s.length > 1) s = s.replace(/\/+$/, "");
  return s || "/";
}

/** 入力（URLまたはパス）を保存用のパターン形式「/dir/」に揃える */
export function normalizePattern(input: string): string {
  let s = String(input || "").trim();
  if (/^https?:\/\//i.test(s)) {
    try {
      s = new URL(s).pathname;
    } catch {
      /* そのまま */
    }
  }
  s = s.replace(/[?#].*$/, "");
  if (!s.startsWith("/")) s = "/" + s;
  if (s.length > 1) s = s.replace(/\/+$/, "") + "/";
  return s;
}

/** パスがパターン（そのページ自身、または配下）に一致するか */
export function matchesPattern(path: string, pattern: string): boolean {
  const n = normalizePath(path);
  const q = normalizePath(pattern);
  if (q === "/") return n === "/";
  return n === q || n.startsWith(q + "/");
}

export function classifyPath(path: string, rules: GroupRule[]): GroupKey {
  // トップページは登録不要で常にサービス（CV直結）扱い
  if (normalizePath(path) === "/") return "service";
  if (rules.some((r) => r.group_key === "service" && matchesPattern(path, r.pattern))) return "service";
  if (rules.some((r) => r.group_key === "content" && matchesPattern(path, r.pattern))) return "content";
  return "other";
}
