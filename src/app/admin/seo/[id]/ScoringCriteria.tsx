const CRITERIA: { label: string; rule: string; weight: number; note?: string }[] = [
  { label: "タイトル文字数", rule: "サイト共通の末尾（「 - 香川で…専門店｜四国の施工実績多数」のように他ページと共通の部分）を除いて 28〜40字", weight: 10 },
  { label: "タイトルに主要キーワード", rule: "主要キーワードの語がすべてタイトルに含まれる（「新車 コーティング 香川」なら3語とも。語順・スペースは問わない）", weight: 10 },
  { label: "ディスクリプション", rule: "meta description が 70〜130字", weight: 10 },
  { label: "説明文に主要キーワード", rule: "主要キーワードが meta description に含まれる", weight: 5 },
  { label: "本文ボリューム", rule: "本文（article → main → body の順で判定）が 2,000字以上", weight: 10 },
  { label: "本文に主要キーワード", rule: "本文中に主要キーワードが 3回以上", weight: 10 },
  { label: "見出し構造", rule: "h2 見出しが 3つ以上", weight: 5 },
  { label: "内部リンク", rule: "本文範囲内に自サイトへのリンクが 3本以上", weight: 10 },
  { label: "外部リンク", rule: "他サイトへのリンクが 1本以上", weight: 5 },
  { label: "公開日・更新日の取得", rule: "article:published_time / modified_time、JSON-LD、time タグのいずれかから日付が取れる", weight: 5 },
  { label: "鮮度", rule: "最終更新（無ければ公開日）が 1年以内、かつタイトルに今年より古い「20xx年」が無い", weight: 10 },
  { label: "平均掲載順位", rule: "Search Console の表示回数加重の平均順位が 10位以内", weight: 10, note: "SC連携時のみ" },
  { label: "取りこぼしクエリ", rule: "「順位4〜20位・表示10回以上・CTR 2%未満」のクエリが 3件以下", weight: 10, note: "SC連携時のみ" },
  { label: "AI検索からの流入", rule: "ChatGPT / Perplexity / Gemini / Copilot 等からのセッションが 1以上", weight: 5 },
];

// 採点基準の説明（アコーディオン）。クライアントJS不要の <details> で実装
export default function ScoringCriteria() {
  const total = CRITERIA.reduce((s, c) => s + c.weight, 0);
  return (
    <details className="group mt-2 print:hidden">
      <summary className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 cursor-pointer select-none list-none">
        <span className="group-open:hidden">詳しく見る →</span>
        <span className="hidden group-open:inline">採点基準を閉じる ▲</span>
      </summary>

      <div className="mt-3 bg-white border border-gray-200 rounded-lg p-5 text-sm text-gray-700 max-w-4xl">
        <h3 className="text-sm font-bold text-gray-800 mb-2">採点のしくみ</h3>
        <ul className="list-disc pl-5 space-y-1 text-xs text-gray-600 mb-4">
          <li>
            分析対象は「自然検索の流入が多い上位50ページ」＋「サービス（CV直結）に分類したページ」。サービスページは流入が少なくても、GA4またはSearch Consoleに記録があれば必ず含めます。
          </li>
          <li>
            各ページのHTMLを毎週取得し、下の項目を「できている／できていない」で判定。<br />
            <span className="font-medium">スコア ＝ できている項目の配点合計 ÷ 判定した項目の配点合計 × 100</span>（100点満点に換算）。
          </li>
          <li>
            「主要キーワード」は、Search Console でそのページが最も表示された検索クエリ（上位3つ）。SC未連携のページはタイトル先頭の語で代用します。
          </li>
          <li>Search Console が連携できていないページは、順位・取りこぼしの2項目を判定対象から外します（分母にも入りません）。</li>
          <li>ページが取得できない（404・アクセス制限など）場合は 0点です。</li>
          <li>
            毎週の結果は週ごとに保存され、前の週と比べてタイトル・説明文・h1 が変わっていれば「変更履歴」に自動で記録されます。各ページの詳細では順位・表示回数・自然検索の週別推移も見られます（変更した週は縦線で表示）。
          </li>
          <li>目安: <span className="text-green-700 font-medium">80点以上 良好</span> / <span className="text-yellow-700 font-medium">60〜79 改善余地あり</span> / <span className="text-red-700 font-medium">60点未満 要改善</span></li>
        </ul>

        <table className="w-full text-xs border border-gray-200 rounded overflow-hidden">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-left px-3 py-2 font-medium w-44">項目</th>
              <th className="text-left px-3 py-2 font-medium">合格の基準</th>
              <th className="text-right px-3 py-2 font-medium w-16">配点</th>
            </tr>
          </thead>
          <tbody>
            {CRITERIA.map((c) => (
              <tr key={c.label} className="border-t border-gray-100">
                <td className="px-3 py-1.5 text-gray-800 font-medium">
                  {c.label}
                  {c.note && <span className="ml-1 text-[10px] text-gray-400 font-normal">（{c.note}）</span>}
                </td>
                <td className="px-3 py-1.5 text-gray-600">{c.rule}</td>
                <td className="px-3 py-1.5 text-right text-gray-800">{c.weight}</td>
              </tr>
            ))}
            <tr className="border-t border-gray-200 bg-gray-50">
              <td className="px-3 py-1.5 text-gray-800 font-medium">合計</td>
              <td className="px-3 py-1.5 text-gray-500">SC連携時 {total}点 / 未連携時 {total - 20}点 を100点に換算</td>
              <td className="px-3 py-1.5 text-right text-gray-800 font-medium">{total}</td>
            </tr>
          </tbody>
        </table>

        <h3 className="text-sm font-bold text-gray-800 mt-5 mb-2">ページ分類の考え方</h3>
        <ul className="list-disc pl-5 space-y-1 text-xs text-gray-600">
          <li><span className="font-medium text-orange-700">サービス（CV直結）</span>: トップページ（常にこの扱い）、サービスのカテゴリトップ（例 /coating/）、各サービスページ（例 /coating/system-x/）。お問い合わせに直結するため、タイトル・内容の調整で上位表示と検索流入を増やすことが目的。</li>
          <li><span className="font-medium text-sky-700">集客（コラム・事例）</span>: コラム（例 /columnpost/）や施工事例（例 /g-gallery/）。見込み客の入口で、サービスページへ内部リンクで送ることが役割。</li>
          <li><span className="font-medium text-gray-600">その他</span>: 上記以外。</li>
        </ul>
      </div>
    </details>
  );
}
