/**
 * タイトル改善アドバイス
 * - 現在のタイトル全文を「本来のタイトル（core）」と「サイト共通の末尾（suffix）」に分けて見せる
 *   （末尾はサイト内の他ページと共通している部分として検出。保存済みの titleCore より優先）
 * - Search Console の主要クエリの語がタイトルに含まれているかを語単位で判定し、不足語を列挙
 * - 機械的に組んだ「変更例」を数パターン出す（最終的な文言は人が整える前提）
 * 純粋関数のみ（サーバー・クライアント両方から利用）
 */

export interface TitleQuery {
  q: string;
  imp: number;
  clicks: number;
  pos: number;
}

export interface TitleSource {
  path?: string;
  crawlOk?: boolean;
  title?: string;
  titleCore?: string;
  h1?: string;
  staleYear?: number | null;
  sc?: { queries?: TitleQuery[] } | null;
}

export type TitleStatus = "ok" | "improve" | "fix";

export interface TitleExample {
  label: string;
  title: string;
  len: number; // 全体の文字数
}

export interface TitleAdvice {
  title: string; // 現在のタイトル全文
  core: string; // サイト共通末尾を除いた本来のタイトル
  suffix: string; // サイト共通末尾（区切り文字を含む）
  coreLen: number;
  suffixLen: number; // 区切り文字を除いた末尾の文字数
  h1: string;
  hasSc: boolean;
  queries: TitleQuery[]; // 主要クエリ（表示回数順 上位3）
  missing: string[]; // 主要クエリの語でタイトルに無いもの
  issues: string[];
  examples: TitleExample[];
  status: TitleStatus;
}

export interface SiteContext {
  titles: string[]; // サイト内の全タイトル（共通末尾の検出用）
  region: string; // 検索クエリから推定した主な地域語（「香川」「周南市」など）
  siteName?: string; // 顧客名（店名が取れない時の末尾）
}

export const TITLE_STATUS_META: Record<TitleStatus, { label: string; badge: string }> = {
  fix: { label: "要変更", badge: "bg-red-100 text-red-700 border-red-200" },
  improve: { label: "改善余地", badge: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  ok: { label: "OK", badge: "bg-green-100 text-green-700 border-green-200" },
};

const SEP_SPLIT = /\s*[-|｜–—]\s*/;
const SEP_SCAN = /\s*[-|｜–—]\s*/g;
const SEP_LEAD = /^\s*([-|｜–—])\s*/;

const PREFS = "北海道 青森 岩手 宮城 秋田 山形 福島 茨城 栃木 群馬 埼玉 千葉 東京 神奈川 新潟 富山 石川 福井 山梨 長野 岐阜 静岡 愛知 三重 滋賀 京都 大阪 兵庫 奈良 和歌山 鳥取 島根 岡山 広島 山口 徳島 香川 愛媛 高知 福岡 佐賀 長崎 熊本 大分 宮崎 鹿児島 沖縄".split(" ");

export function queryTokens(q: string): string[] {
  return String(q || "")
    .split(/[\s　]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 1);
}

function has(text: string, tok: string): boolean {
  return !!tok && text.toLowerCase().includes(tok.toLowerCase());
}

function normTitle(t: string | undefined): string {
  return (t || "").replace(/\s+/g, " ").trim();
}

/** 地域語か（都道府県名、または 〜市/区/町/村） */
export function isRegionToken(tok: string): boolean {
  const t = tok.replace(/(県|府|都)$/, "");
  if (PREFS.includes(t)) return true;
  // 「木村」「田村」のような姓を除くため3文字以上（堺市のような2字の市は対象外）
  return /^[^\s　]{2,4}(市|区|町|村)$/.test(tok);
}

/** サイト全体の検索クエリから、表示回数の合計が最も大きい地域語を推定 */
export function detectSiteRegion(rows: TitleSource[]): string {
  const score = new Map<string, number>();
  for (const r of rows) {
    for (const q of r.sc?.queries || []) {
      for (const tok of queryTokens(q.q)) {
        if (!isRegionToken(tok)) continue;
        score.set(tok, (score.get(tok) || 0) + (q.imp || 0));
      }
    }
  }
  let best = "";
  let bestScore = 0;
  for (const [tok, s] of score) {
    if (s > bestScore) {
      best = tok;
      bestScore = s;
    }
  }
  return best;
}

export function buildSiteContext(rows: TitleSource[], siteName?: string): SiteContext {
  return {
    titles: rows.filter((r) => r.crawlOk !== false).map((r) => normTitle(r.title)).filter(Boolean),
    region: detectSiteRegion(rows),
    siteName,
  };
}

/**
 * サイト内の他ページ2件以上と共通する末尾を検出し、タイトルを core / suffix に分ける。
 * 見つからなければ保存済みの titleCore（title の先頭に一致する場合）を使う。
 */
export function splitTitle(title: string, storedCore: string | undefined, titles: string[]): { core: string; suffix: string } {
  if (titles.length >= 3) {
    // 区切り位置を先に全部取り出す（グローバル正規表現を exec と replace で共用すると無限ループになるため）
    for (const m of [...title.matchAll(SEP_SCAN)]) {
      const idx = m.index ?? 0;
      const suffix = title.slice(idx);
      const candidate = title.slice(0, idx).trim();
      if (candidate.length < 2 || suffix.split(SEP_SPLIT).join("").length < 4) continue;
      const shared = titles.filter((t) => t !== title && t.endsWith(suffix)).length;
      if (shared >= 2) return { core: candidate, suffix };
    }
  }
  const sc = normTitle(storedCore);
  if (sc && title.startsWith(sc) && sc.length < title.length) return { core: sc, suffix: title.slice(sc.length) };
  return { core: title, suffix: "" };
}

/**
 * サイト共通末尾から短い店名候補を取り出す
 * 例: 「 - 香川でガラスコーティング専門店ならカーケアグランツ｜四国の施工実績多数」→「カーケアグランツ」
 * 取れなければ fallback（顧客名）を使う
 */
export function brandFromSuffix(suffix: string, fallback?: string): string {
  const segs = suffix.split(SEP_SPLIT).map((s) => s.trim()).filter(Boolean);
  const cands: string[] = [];
  // 「〜専門店ならカーケアグランツ」のような「なら＋店名」
  for (const seg of [...segs].reverse()) {
    const m = /なら\s*([^\s　]{2,16})$/.exec(seg);
    if (m) cands.push(m[1]);
  }
  const last = segs[segs.length - 1] || "";
  if (last) {
    cands.push(last);
    const words = last.split(/[\s　]+/).filter(Boolean);
    if (words.length > 1) cands.push(words[words.length - 1]);
  }
  if (fallback) cands.push(fallback.trim());
  const good = cands.filter((c) => c.length >= 2 && c.length <= 16 && !/(なら|お探し|実績|おすすめ|お任せ|おまかせ)/.test(c));
  return good[0] || (fallback || "").trim();
}

export function buildTitleAdvice(src: TitleSource, ctx: SiteContext, duplicatePaths: string[] = []): TitleAdvice {
  const title = normTitle(src.title);
  const { core, suffix } = splitTitle(title, src.titleCore, ctx.titles);
  const sepMatch = SEP_LEAD.exec(suffix);
  const sepChar = sepMatch ? sepMatch[1] : "｜";
  const sep = sepChar === "｜" ? "｜" : ` ${sepChar} `; // 元の区切りの空白の付け方に合わせる
  const suffixBody = suffix.replace(SEP_LEAD, "").trim();
  const h1 = normTitle(src.h1);

  const queries = [...(src.sc?.queries || [])]
    .filter((q) => q && q.q)
    .sort((a, b) => (b.imp || 0) - (a.imp || 0))
    .slice(0, 3);
  const hasSc = queries.length > 0;

  // 不足語: 主要クエリの語のうちタイトルに無いもの（長い語に含まれる短い語は省く）
  const missingAll: string[] = [];
  for (const q of queries) {
    for (const tok of queryTokens(q.q)) {
      if (!has(title, tok) && !missingAll.includes(tok)) missingAll.push(tok);
    }
  }
  const missing = missingAll.filter((t) => !missingAll.some((o) => o !== t && o.includes(t))).slice(0, 4);
  const q1 = queries[0];
  const q1Missing = q1 ? queryTokens(q1.q).filter((t) => !has(title, t)) : [];
  // 1ページ目付近か、表示がある程度あるクエリだけを「狙うべき主要クエリ」とみなす
  const q1Strong = !!q1 && (q1.pos <= 20 || q1.imp >= 20);

  const issues: string[] = [];
  let status: TitleStatus = "ok";
  const fix = (msg: string) => {
    issues.push(msg);
    status = "fix";
  };
  const improve = (msg: string) => {
    issues.push(msg);
    if (status === "ok") status = "improve";
  };
  const note = (msg: string) => issues.push(msg); // 状態は変えない補足

  const base = { title, core, suffix, coreLen: core.length, suffixLen: suffixBody.length, h1, hasSc, queries, missing };
  if (src.crawlOk === false || !title) {
    return { ...base, status: "fix", issues: [src.crawlOk === false ? "ページを取得できていません" : "タイトルが取得できません"], examples: [] };
  }

  const coreLen = core.length;
  const impSum = queries.reduce((s, q) => s + (q.imp || 0), 0);
  // 短すぎるタイトルは、検索での表示がある（需要がある）ページでは「要変更」、無ければ「改善余地」
  if (coreLen < 20) (impSum >= 20 ? fix : improve)(`本来のタイトルが${coreLen}字と短すぎる（28〜40字が目安）`);
  else if (coreLen < 28) improve(`本来のタイトルが${coreLen}字と短め（28〜40字が目安）`);
  else if (coreLen > 50) fix(`本来のタイトルが${coreLen}字と長すぎる（検索結果で途切れる）`);
  else if (coreLen > 40) improve(`本来のタイトルが${coreLen}字と長め（40字以内が目安）`);

  if (suffixBody.length > 20) improve(`サイト共通の末尾が${suffixBody.length}字と長く、全体${title.length}字（検索結果は30字前後で途切れる）`);

  if (q1 && q1Missing.length > 0) {
    if (q1Strong) fix(`主要クエリ「${q1.q}」の語がタイトルに無い: ${q1Missing.join("・")}`);
    else improve(`主要クエリ「${q1.q}」の語がタイトルに無い: ${q1Missing.join("・")}（${q1.pos.toFixed(0)}位・表示${q1.imp}回と弱いため参考）`);
  }
  const otherMissing = missing.filter((t) => !q1Missing.includes(t));
  if (otherMissing.length > 0) improve(`上位クエリの語も未使用: ${otherMissing.join("・")}`);
  if (!hasSc) note("Search Console未連携のため、検索クエリとの照合はできていません");

  const h1Mismatch = !!h1 && !has(title, h1) && !has(h1, core);
  if (h1Mismatch) improve(`h1「${h1}」とタイトルが一致していない（揃えると評価が安定）`);
  if (src.staleYear) fix(`タイトルに古い年号「${src.staleYear}年」`);
  if (duplicatePaths.length > 0) fix(`同じタイトルのページが他に${duplicatePaths.length}件（${duplicatePaths.slice(0, 3).join(", ")}${duplicatePaths.length > 3 ? " …" : ""}）`);

  // ---- 変更例（機械的に組んだ案。文言は人が整える前提） ----
  const brand = brandFromSuffix(suffix, ctx.siteName);
  // 末尾: 現在の末尾が短ければそのまま、長ければ店名だけに
  const tail = suffixBody ? (suffixBody.length <= 20 ? `${sep}${suffixBody}` : brand ? `${sep}${brand}` : "") : brand && !has(core, brand) ? `${sep}${brand}` : "";
  const region = ctx.region;

  const examples: TitleExample[] = [];
  const push = (label: string, t: string) => {
    const s = normTitle(t);
    if (!s || s === title || examples.some((e) => e.title === s)) return;
    examples.push({ label, title: s, len: s.length });
  };

  if (hasSc && q1 && q1Strong && q1Missing.length > 0) {
    push("主要クエリを先頭に", `${queryTokens(q1.q).join(" ")}${sep}${core}${coreLen > 40 ? "" : tail}`);
  }
  // 語を足す余地があるのは本来のタイトルが短めのページだけ。足す語は主要クエリ優先で最大3語
  const addable = [...q1Missing.filter((t) => q1Strong), ...otherMissing].filter((t) => t.length >= 2).slice(0, 3);
  if (hasSc && addable.length > 0 && coreLen <= 32) {
    push("不足している語を補う", `${core} ${addable.join(" ")}${tail}`);
  }
  if (region && !has(core, region) && coreLen <= 32) {
    push("地域を入れる", `${core} ${region}${tail}`);
  }
  if (suffixBody.length > 20 && tail !== suffix) push("末尾を短く", `${core}${tail}`);
  if (h1Mismatch) push("h1に揃える", has(h1, brand) || SEP_SPLIT.test(h1) ? h1 : `${h1}${tail}`);

  return { ...base, coreLen, issues, examples: examples.slice(0, 3), status };
}

/** 同じタイトルを持つページ（テンプレート設定漏れなどの検出用）: title → paths */
export function findDuplicateTitles(rows: { path: string; title?: string }[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const r of rows) {
    const t = normTitle(r.title);
    if (!t) continue;
    const arr = m.get(t) || [];
    arr.push(r.path);
    m.set(t, arr);
  }
  for (const [t, paths] of m) if (paths.length < 2) m.delete(t);
  return m;
}
