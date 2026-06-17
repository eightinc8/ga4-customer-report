"use client";

import { useEffect, useState } from "react";

interface TrackedPage {
  id: number;
  path: string;
  label: string | null;
}

export default function TrackedPagesManager({ userId }: { userId: number }) {
  const [pages, setPages] = useState<TrackedPage[]>([]);
  const [path, setPath] = useState("");
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/tracked-pages?userId=${userId}`);
      const data = await res.json();
      setPages(data.pages || []);
    } catch {
      setError("読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!path.trim()) return;
    const res = await fetch("/api/admin/tracked-pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, path: path.trim(), label: label.trim() }),
    });
    if (res.ok) {
      setPath("");
      setLabel("");
      load();
    } else {
      const data = await res.json();
      setError(data.error || "追加に失敗しました");
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("この登録ページを削除しますか？")) return;
    const res = await fetch(`/api/admin/tracked-pages/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6 print:hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-left"
      >
        <h3 className="text-sm font-bold text-gray-800">
          登録ページの計測設定
          <span className="ml-2 text-xs font-normal text-gray-500">
            （指定したページのPV・直帰率・滞在時間・スクロール率を毎週計測）
          </span>
        </h3>
        <span className="text-gray-400 text-sm">{open ? "▲ 閉じる" : `▼ 開く（${pages.length}件）`}</span>
      </button>

      {open && (
        <div className="mt-4">
          {/* 一覧 */}
          {loading ? (
            <p className="text-sm text-gray-400">読み込み中...</p>
          ) : pages.length === 0 ? (
            <p className="text-sm text-gray-400 mb-4">まだ登録ページがありません。下のフォームから追加してください。</p>
          ) : (
            <div className="space-y-2 mb-4">
              {pages.map((p) => (
                <div key={p.id} className="flex items-center justify-between bg-gray-50 rounded-md px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800 truncate">{p.label || p.path}</p>
                    <p className="text-xs text-gray-400 truncate">{p.path}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="text-xs text-red-600 hover:text-red-800 ml-3 shrink-0"
                  >
                    削除
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 追加フォーム */}
          <form onSubmit={handleAdd} className="border-t border-gray-100 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">ページURL または パス（必須）</label>
                <input
                  type="text"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder="/column/sample.php または https://example.com/column/sample.php"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">表示名（任意）</label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="例: 料金ページ"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
            </div>
            {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
            >
              追加
            </button>
            <p className="text-xs text-gray-400 mt-2">
              ※ URLを貼り付けてもOK（自動でパスに変換されます）。次回のレポート更新時から計測されます。
            </p>
          </form>
        </div>
      )}
    </div>
  );
}
