"use client";

import { useState } from "react";
import { TitleAdvice, TITLE_STATUS_META } from "@/lib/seo-title";

/** 変更例の横に付くコピー用ボタン */
export function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* クリップボード非対応環境では何もしない */
        }
      }}
      className="shrink-0 text-[10px] px-1.5 py-0.5 rounded border border-gray-300 text-gray-500 hover:bg-gray-100 print:hidden"
      title="クリップボードにコピー"
    >
      {done ? "コピー済み" : "コピー"}
    </button>
  );
}

/** 現在のタイトル全文（本来の部分を濃く、サイト共通の末尾を薄く） */
export function CurrentTitle({ a, className = "" }: { a: TitleAdvice; className?: string }) {
  if (!a.title) return <span className={`text-gray-400 ${className}`}>（取得できません）</span>;
  return (
    <span className={`break-words ${className}`}>
      <span className="text-gray-900 font-medium">{a.core}</span>
      {a.suffix && <span className="text-gray-400">{a.suffix}</span>}
    </span>
  );
}

export function TitleStatusBadge({ status }: { status: TitleAdvice["status"] }) {
  const m = TITLE_STATUS_META[status];
  return <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded border ${m.badge}`}>{m.label}</span>;
}

/** 詳細パネル用: タイトルの現状・主要クエリ・課題・変更例 */
export default function TitleAdviceBlock({ a }: { a: TitleAdvice }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <h4 className="text-xs font-bold text-gray-700">タイトル</h4>
        <TitleStatusBadge status={a.status} />
      </div>

      <div className="text-sm leading-relaxed">
        <CurrentTitle a={a} />
        {a.title && <CopyButton text={a.title} />}
      </div>
      <p className="text-[11px] text-gray-500 mt-1">
        本来のタイトル {a.coreLen}字
        {a.suffix ? <>（＋サイト共通の末尾 {a.suffixLen}字 ＝ 全体 {a.title.length}字）</> : <>（全体 {a.title.length}字）</>}
        {a.h1 && (
          <>
            {" ・ "}h1: <span className="text-gray-700">{a.h1}</span>
          </>
        )}
      </p>

      {a.queries.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] text-gray-500 mb-1">主要クエリ（表示回数順）と、タイトルに含まれていない語</p>
          <div className="flex flex-wrap gap-1.5">
            {a.queries.map((q) => (
              <span key={q.q} className="text-[11px] px-2 py-0.5 rounded bg-gray-50 border border-gray-200 text-gray-700">
                {q.q} <span className="text-gray-400">表示{q.imp}・{q.pos.toFixed(1)}位</span>
              </span>
            ))}
            {a.missing.map((t) => (
              <span key={t} className="text-[11px] px-2 py-0.5 rounded bg-red-50 border border-red-200 text-red-700">
                未使用: {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {a.issues.length > 0 && (
        <ul className="mt-3 space-y-0.5 text-xs text-gray-700 list-disc pl-4">
          {a.issues.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      )}

      {a.examples.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] text-gray-500 mb-1">変更例（主要クエリ・h1・店名から機械的に組んだ案。文言は整えてから使ってください）</p>
          <ul className="space-y-1">
            {a.examples.map((e) => (
              <li key={e.title} className="text-sm leading-relaxed">
                <span className="inline-block align-middle text-[10px] px-1.5 py-0.5 mr-2 rounded bg-blue-50 text-blue-700 border border-blue-100 whitespace-nowrap">{e.label}</span>
                <span className="text-gray-900 break-words">{e.title}</span>
                <span className="ml-2 text-[11px] text-gray-400 whitespace-nowrap">{e.len}字</span>
                <span className="ml-2 inline-block align-middle"><CopyButton text={e.title} /></span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {a.title && a.examples.length === 0 && a.status === "ok" && <p className="mt-3 text-xs text-green-700">タイトルは現状のままで問題ありません。</p>}
    </div>
  );
}
