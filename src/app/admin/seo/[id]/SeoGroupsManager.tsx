"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GROUP_META, GroupRule, RuleGroup } from "@/lib/seo-groups";

export interface Suggestion {
  pattern: string;
  pages: number;
  organic: number;
}

export default function SeoGroupsManager({
  userId,
  rules,
  suggestions,
  readOnly = false,
}: {
  userId: number;
  rules: GroupRule[];
  suggestions: Suggestion[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(rules.length === 0);
  const [pattern, setPattern] = useState("");
  const [group, setGroup] = useState<RuleGroup>("service");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function add(p: string, g: RuleGroup) {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/seo-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, pattern: p, group: g }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "追加に失敗しました");
        return;
      }
      setPattern("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/seo-groups/${id}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function switchGroup(id: number, g: RuleGroup) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/seo-groups/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group: g }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const service = rules.filter((r) => r.group_key === "service");
  const content = rules.filter((r) => r.group_key === "content");

  function RuleList({ list, g }: { list: GroupRule[]; g: RuleGroup }) {
    const meta = GROUP_META[g];
    return (
      <div className="bg-gray-50 rounded-md p-3">
        <p className="text-xs font-bold text-gray-700 mb-2">
          <span className={`inline-block px-1.5 py-0.5 rounded border mr-1 ${meta.badge}`}>{meta.short}</span>
          {meta.label}
          <span className="ml-2 font-normal text-gray-400">{list.length}件</span>
        </p>
        <p className="text-[11px] text-gray-500 mb-2">{meta.desc}</p>
        {list.length === 0 ? (
          <p className="text-xs text-gray-400">未登録</p>
        ) : (
          <ul className="space-y-1">
            {list.map((r) => (
              <li key={r.id} className="flex items-center justify-between bg-white border border-gray-200 rounded px-2 py-1 text-xs">
                <span className="font-mono text-gray-800">{r.pattern}</span>
                {!readOnly && (
                  <span className="flex items-center gap-2 shrink-0">
                    <button
                      disabled={busy}
                      onClick={() => switchGroup(r.id!, g === "service" ? "content" : "service")}
                      className="text-gray-400 hover:text-blue-600"
                      title={g === "service" ? "集客へ移動" : "サービスへ移動"}
                    >
                      {g === "service" ? "→集客" : "→サービス"}
                    </button>
                    <button disabled={busy} onClick={() => remove(r.id!)} className="text-red-500 hover:text-red-700">
                      削除
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6 print:hidden">
      <button onClick={() => setOpen(!open)} className="flex items-center justify-between w-full text-left">
        <h3 className="text-sm font-bold text-gray-800">
          ページ分類の設定（サービス／集客）
          <span className="ml-2 text-xs font-normal text-gray-500">
            （CV直結のサービスページを最優先で分析・追跡するための分類ルール）
          </span>
        </h3>
        <span className="text-gray-400 text-sm">{open ? "▲ 閉じる" : `▼ 開く（${rules.length}件）`}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          <p className="text-xs text-gray-500">
            パス（ディレクトリ）を登録すると、そのページと配下のページが分類されます。例: <code className="bg-gray-100 px-1 rounded">/coating/</code> を「サービス」にすると
            <code className="bg-gray-100 px-1 rounded">/coating/</code> と <code className="bg-gray-100 px-1 rounded">/coating/system-x/</code> の両方がサービス扱い。
            サービスに分類したページは、流入が少なくても次回の分析から必ず対象に含まれます（登録したパス自体も常に分析されます）。
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <RuleList list={service} g="service" />
            <RuleList list={content} g="content" />
          </div>

          {!readOnly && (
            <>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (pattern.trim()) add(pattern.trim(), group);
                }}
                className="border-t border-gray-100 pt-4"
              >
                <div className="flex flex-wrap gap-2 items-end">
                  <div className="flex-1 min-w-[240px]">
                    <label className="block text-xs text-gray-500 mb-1">URL または パス</label>
                    <input
                      type="text"
                      value={pattern}
                      onChange={(e) => setPattern(e.target.value)}
                      placeholder="/coating/ または https://example.com/coating/system-x/"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">分類</label>
                    <select value={group} onChange={(e) => setGroup(e.target.value as RuleGroup)} className="border border-gray-300 rounded-md px-3 py-2 text-sm">
                      <option value="service">サービス（CV直結）</option>
                      <option value="content">集客（コラム・事例）</option>
                    </select>
                  </div>
                  <button type="submit" disabled={busy || !pattern.trim()} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium disabled:opacity-50">
                    追加
                  </button>
                </div>
                {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
              </form>

              {suggestions.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2">
                    候補（今の分析ページに含まれるディレクトリ・未分類のもの）— クリックで分類:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((s) => (
                      <span key={s.pattern} className="inline-flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-md pl-2 pr-1 py-1 text-xs">
                        <span className="font-mono text-gray-800">{s.pattern}</span>
                        <span className="text-gray-400">{s.pages}頁</span>
                        <button disabled={busy} onClick={() => add(s.pattern, "service")} className="ml-1 px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 hover:bg-orange-200">
                          サービス
                        </button>
                        <button disabled={busy} onClick={() => add(s.pattern, "content")} className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 hover:bg-sky-200">
                          集客
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
