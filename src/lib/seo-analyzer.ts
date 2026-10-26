/**
 * SEOページ分析エンジン
 * - 各ページのHTMLを取得し、タイトル/説明文/本文/見出し/リンク/公開日を抽出
 * - GA4（自然・AI流入）と Search Console（クエリ・順位・取りこぼし）を合わせて採点
 */

export interface ScQuery {
  q: string;
  clicks: number;
  imp: number;
  ctr: number; // %
  pos: number;
}

export interface ScSummary {
  queries: ScQuery[]; // 表示回数の多い順 TOP10
  totalQueries: number;
  totalImp: number;
  totalClicks: number;
  avgPos: number;
  missed: ScQuery[]; // 取りこぼし候補（順位4〜20位・表示多い・CTR低い）
}

export interface SeoInput {
  path: string;
  url: string;
  organicSessions: number;
  aiSessions: number;
  sc?: ScSummary | null;
}

export interface SeoCheck {
  id: string;
  label: string;
  ok: boolean;
  weight: number;
  detail: string;
  advice: string;
}

export interface SeoResult extends SeoInput {
  crawlOk: boolean;
  crawlStatus: number;
  crawlError?: string;
  title: string;
  titleLen: number;
  titleCore: string; // サイト名などの末尾セグメントを除いた本来のタイトル
  titleCoreLen: number;
  h1: string;
  description: string;
  descLen: number;
  bodyChars: number;
  h2Count: number;
  internalLinks: number;
  externalLinks: number;
  publishedAt: string | null;
  modifiedAt: string | null;
  ageDays: number | null;
  updatedDays: number | null;
  staleYear: number | null;
  keywords: { q: string; inTitle: boolean; inDesc: boolean; bodyCount: number }[];
  score: number;
  checks: SeoCheck[];
  analyzedAt: string;
}

// ---------- HTML ユーティリティ ----------

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
}

function stripTags(fragment: string): string {
  return decodeEntities(
    fragment
      .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function getTitle(html: string): string {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return m ? stripTags(m[1]) : "";
}

function getMeta(html: string, keys: string[]): string {
  const wanted = keys.map((k) => k.toLowerCase());
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const nm = /(?:name|property|itemprop)\s*=\s*["']([^"']+)["']/i.exec(tag);
    if (!nm || !wanted.includes(nm[1].toLowerCase())) continue;
    const c = /content\s*=\s*["']([^"']*)["']/i.exec(tag);
    if (c) return decodeEntities(c[1]).replace(/\s+/g, " ").trim();
  }
  return "";
}

function getJsonLdDate(html: string, key: "datePublished" | "dateModified"): string {
  const re = new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`);
  const m = re.exec(html);
  return m ? m[1] : "";
}

function getFirstTimeTag(html: string): string {
  const m = /<time\b[^>]*datetime\s*=\s*["']([^"']+)["']/i.exec(html);
  return m ? m[1] : "";
}

function parseDate(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function pickRegion(html: string): string {
  const m =
    /<article\b[\s\S]*?<\/article>/i.exec(html) ||
    /<main\b[\s\S]*?<\/main>/i.exec(html) ||
    /<body\b[\s\S]*?<\/body>/i.exec(html);
  return m ? m[0] : html;
}

function countOccurrences(text: string, needle: string): number {
  if (!needle) return 0;
  const t = text.toLowerCase();
  const n = needle.toLowerCase();
  let count = 0;
  let idx = 0;
  while ((idx = t.indexOf(n, idx)) !== -1) {
    count++;
    idx += n.length;
  }
  return count;
}

// ---------- 取得 ----------

async function fetchHtml(url: string, timeoutMs = 12000): Promise<{ status: number; html: string; error?: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; GA4ReportBot/1.0; +https://ga4kanri.customer8.jp)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "ja,en;q=0.8",
      },
    });
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("html")) return { status: res.status, html: "", error: `HTMLではありません (${ct})` };
    const html = await res.text();
    return { status: res.status, html };
  } catch (e) {
    return { status: 0, html: "", error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

// ---------- 採点 ----------

function buildChecks(r: Omit<SeoResult, "score" | "checks" | "analyzedAt">): SeoCheck[] {
  const checks: SeoCheck[] = [];
  const add = (c: SeoCheck) => checks.push(c);
  const hasSc = !!(r.sc && r.sc.queries && r.sc.queries.length > 0);
  const mainKw = r.keywords[0];

  if (!r.crawlOk) {
    add({ id: "crawl", label: "ページ取得", ok: false, weight: 100, detail: r.crawlError || `HTTP ${r.crawlStatus}`, advice: "ページにアクセスできません。URL・公開状態・アクセス制限を確認してください。" });
    return checks;
  }

  const tl = r.titleCoreLen || r.titleLen;
  add({
    id: "titleLen",
    label: "タイトル文字数（サイト名除く 28〜40字）",
    ok: tl >= 28 && tl <= 40,
    weight: 10,
    detail: `${tl}字（サイト名込み ${r.titleLen}字）`,
    advice: tl < 28 ? "短すぎます。検索意図を含む語を足して28字以上に。" : tl > 40 ? "長すぎて検索結果で途切れます。40字以内を目安に。" : "",
  });

  if (mainKw) {
    add({
      id: "titleKw",
      label: `タイトルに主要キーワード「${mainKw.q}」`,
      ok: mainKw.inTitle,
      weight: 10,
      detail: mainKw.inTitle ? "含まれています" : "含まれていません",
      advice: mainKw.inTitle ? "" : "最も流入のあるクエリをタイトル前半に含めると順位・CTRが改善しやすいです。",
    });
  }

  add({
    id: "desc",
    label: "ディスクリプション（70〜130字）",
    ok: r.descLen >= 70 && r.descLen <= 130,
    weight: 10,
    detail: r.descLen === 0 ? "未設定" : `${r.descLen}字`,
    advice: r.descLen === 0 ? "meta descriptionが無く、検索結果の説明文を制御できていません。" : r.descLen < 70 ? "短すぎます。内容とベネフィットを70字以上で。" : r.descLen > 130 ? "長すぎて途切れます。130字以内に。" : "",
  });

  if (mainKw) {
    add({
      id: "descKw",
      label: "説明文に主要キーワード",
      ok: mainKw.inDesc,
      weight: 5,
      detail: mainKw.inDesc ? "含まれています" : "含まれていません",
      advice: mainKw.inDesc ? "" : "説明文に主要キーワードを入れると検索結果で太字強調されCTRが上がります。",
    });
  }

  add({
    id: "body",
    label: "本文ボリューム（2,000字以上）",
    ok: r.bodyChars >= 2000,
    weight: 10,
    detail: `${r.bodyChars.toLocaleString()}字`,
    advice: r.bodyChars < 2000 ? "情報量が少なめです。関連トピック・FAQ・事例を追加して厚みを。" : "",
  });

  if (mainKw) {
    add({
      id: "bodyKw",
      label: `本文に主要キーワード（3回以上）`,
      ok: mainKw.bodyCount >= 3,
      weight: 10,
      detail: `${mainKw.bodyCount}回`,
      advice: mainKw.bodyCount < 3 ? "本文での言及が少なく、検索意図との一致が弱い可能性。見出しや本文に自然に追加を。" : "",
    });
  }

  add({
    id: "h2",
    label: "見出し構造（h2が3つ以上）",
    ok: r.h2Count >= 3,
    weight: 5,
    detail: `h2 ${r.h2Count}個`,
    advice: r.h2Count < 3 ? "見出しで内容を区切ると読みやすさとAI検索での引用性が上がります。" : "",
  });

  add({
    id: "internal",
    label: "内部リンク（3本以上）",
    ok: r.internalLinks >= 3,
    weight: 10,
    detail: `${r.internalLinks}本`,
    advice: r.internalLinks < 3 ? "関連記事・サービス・料金ページへのリンクを本文内に追加し、回遊と成約導線を作ります。" : "",
  });

  add({
    id: "external",
    label: "外部リンク（1本以上）",
    ok: r.externalLinks >= 1,
    weight: 5,
    detail: `${r.externalLinks}本`,
    advice: r.externalLinks < 1 ? "信頼できる出典へのリンクは信頼性評価にプラスです。" : "",
  });

  const dateOk = r.publishedAt !== null || r.modifiedAt !== null;
  add({
    id: "date",
    label: "公開日・更新日が取得できる",
    ok: dateOk,
    weight: 5,
    detail: dateOk ? `公開 ${r.publishedAt ?? "-"} / 更新 ${r.modifiedAt ?? "-"}` : "取得できません",
    advice: dateOk ? "" : "公開日・更新日のメタ情報（article:published_time 等）が無く、鮮度を評価できません。",
  });

  const freshDays = r.updatedDays ?? r.ageDays;
  const stale = r.staleYear !== null;
  add({
    id: "fresh",
    label: "鮮度（1年以内の更新・年号が古くない）",
    ok: !stale && (freshDays === null || freshDays <= 365),
    weight: 10,
    detail: `${stale ? `タイトルに「${r.staleYear}年」` : ""}${stale && freshDays !== null ? " / " : ""}${freshDays !== null ? `最終更新から${freshDays}日` : ""}` || "判定材料なし",
    advice: stale ? `タイトルの年号が古く「賞味期限切れ」に見えます。内容を更新し「${new Date().getFullYear()}年版」に改稿を。` : freshDays !== null && freshDays > 365 ? "1年以上更新されていません。最新情報を追記して更新日を新しく。" : "",
  });

  if (hasSc && r.sc) {
    add({
      id: "pos",
      label: "平均掲載順位（10位以内）",
      ok: r.sc.avgPos > 0 && r.sc.avgPos <= 10,
      weight: 10,
      detail: `${r.sc.avgPos.toFixed(1)}位（${r.sc.totalQueries}クエリ）`,
      advice: r.sc.avgPos > 10 ? "2ページ目以降が多いです。上位クエリに合わせてタイトル・見出し・本文を強化。" : "",
    });
    add({
      id: "missed",
      label: "取りこぼしクエリ（3件以下）",
      ok: r.sc.missed.length <= 3,
      weight: 10,
      detail: `${r.sc.missed.length}件`,
      advice: r.sc.missed.length > 3 ? "表示はされるのにクリックされないクエリが多数。該当語を見出し・タイトルに取り込むと伸びしろ大。" : "",
    });
  }

  add({
    id: "ai",
    label: "AI検索からの流入あり",
    ok: r.aiSessions > 0,
    weight: 5,
    detail: `${r.aiSessions}セッション`,
    advice: r.aiSessions > 0 ? "" : "FAQ形式・結論先出し・構造化データでAI検索に引用されやすくなります。",
  });

  return checks;
}

function scoreOf(checks: SeoCheck[]): number {
  const total = checks.reduce((s, c) => s + c.weight, 0);
  if (total === 0) return 0;
  const got = checks.filter((c) => c.ok).reduce((s, c) => s + c.weight, 0);
  return Math.round((got / total) * 100);
}

// ---------- 1ページ解析 ----------

export async function analyzePage(input: SeoInput): Promise<SeoResult> {
  const { status, html, error } = await fetchHtml(input.url);
  const crawlOk = status === 200 && html.length > 0;

  const base = {
    ...input,
    crawlOk,
    crawlStatus: status,
    crawlError: error,
    title: "",
    titleLen: 0,
    titleCore: "",
    titleCoreLen: 0,
    h1: "",
    description: "",
    descLen: 0,
    bodyChars: 0,
    h2Count: 0,
    internalLinks: 0,
    externalLinks: 0,
    publishedAt: null as string | null,
    modifiedAt: null as string | null,
    ageDays: null as number | null,
    updatedDays: null as number | null,
    staleYear: null as number | null,
    keywords: [] as SeoResult["keywords"],
  };

  if (crawlOk) {
    base.title = getTitle(html);
    base.titleLen = base.title.length;
    const h1m = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
    base.h1 = h1m ? stripTags(h1m[1]) : "";
    // 「記事タイトル - サイト名」のサイト名部分を除いて文字数を評価する
    const h1t = base.h1.trim();
    if (h1t && base.title.startsWith(h1t)) base.titleCore = h1t;
    else base.titleCore = base.title.replace(/\s*[-|｜–—]\s*[^-|｜–—]{1,40}\s*$/, "").trim() || base.title;
    base.titleCoreLen = base.titleCore.length;
    base.description = getMeta(html, ["description"]) || getMeta(html, ["og:description"]);
    base.descLen = base.description.length;

    const region = pickRegion(html);
    const bodyText = stripTags(region);
    base.bodyChars = bodyText.length;
    base.h2Count = (region.match(/<h2[\s>]/gi) || []).length;

    let host = "";
    try {
      host = new URL(input.url).host;
    } catch {
      /* ignore */
    }
    const hrefs = [...region.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#][^"']*)["']/gi)].map((m) => m[1]);
    for (const h of hrefs) {
      if (/^(mailto:|tel:|javascript:)/i.test(h)) continue;
      if (h.startsWith("/") || h.startsWith("./") || h.startsWith("../")) base.internalLinks++;
      else if (/^https?:\/\//i.test(h)) {
        try {
          if (new URL(h).host === host) base.internalLinks++;
          else base.externalLinks++;
        } catch {
          /* ignore */
        }
      } else base.internalLinks++;
    }

    const pub = parseDate(getMeta(html, ["article:published_time"]) || getJsonLdDate(html, "datePublished") || getFirstTimeTag(html));
    const mod = parseDate(getMeta(html, ["article:modified_time", "og:updated_time"]) || getJsonLdDate(html, "dateModified"));
    const now = Date.now();
    if (pub) {
      base.publishedAt = pub.toISOString().slice(0, 10);
      base.ageDays = Math.floor((now - pub.getTime()) / 86400000);
    }
    if (mod) {
      base.modifiedAt = mod.toISOString().slice(0, 10);
      base.updatedDays = Math.floor((now - mod.getTime()) / 86400000);
    }

    const ym = /(20\d{2})\s*年/.exec(base.title);
    if (ym) {
      const y = parseInt(ym[1], 10);
      if (y < new Date().getFullYear()) base.staleYear = y;
    }

    // 主要キーワード: Search Consoleの上位クエリ → 無ければタイトル先頭セグメントの語
    let kws: string[] = (input.sc?.queries || []).slice(0, 3).map((q) => q.q);
    if (kws.length === 0 && base.title) {
      const seg = base.title.split(/[｜|\-－–—:：]/)[0].trim();
      kws = seg.split(/[\s　]+/).filter((w) => w.length >= 2).slice(0, 3);
    }
    const titleL = base.title.toLowerCase();
    const descL = base.description.toLowerCase();
    base.keywords = kws.map((q) => ({
      q,
      inTitle: titleL.includes(q.toLowerCase()),
      inDesc: descL.includes(q.toLowerCase()),
      bodyCount: countOccurrences(bodyText, q),
    }));
  }

  const checks = buildChecks(base);
  return { ...base, checks, score: scoreOf(checks), analyzedAt: new Date().toISOString() };
}

// ---------- 複数ページ（同時実行数を制限） ----------

export async function analyzePages(
  inputs: SeoInput[],
  onResult: (r: SeoResult) => void,
  concurrency = 3
): Promise<void> {
  let i = 0;
  const worker = async () => {
    while (i < inputs.length) {
      const idx = i++;
      try {
        const r = await analyzePage(inputs[idx]);
        onResult(r);
      } catch (e) {
        onResult({
          ...inputs[idx],
          crawlOk: false,
          crawlStatus: 0,
          crawlError: e instanceof Error ? e.message : String(e),
          title: "", titleLen: 0, titleCore: "", titleCoreLen: 0, h1: "", description: "", descLen: 0, bodyChars: 0, h2Count: 0,
          internalLinks: 0, externalLinks: 0, publishedAt: null, modifiedAt: null, ageDays: null,
          updatedDays: null, staleYear: null, keywords: [], score: 0, checks: [], analyzedAt: new Date().toISOString(),
        });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, inputs.length) }, worker));
}
