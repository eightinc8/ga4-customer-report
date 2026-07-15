"use client";

import { useEffect, useState } from "react";

interface FunnelStep {
  id: number;
  step_order: number;
  label: string;
  step_type: string;
  step_value: string;
}

export default function FunnelManager({ userId }: { userId: number }) {
  const [steps, setSteps] = useState<FunnelStep[]>([]);
  const [label, setLabel] = useState("");
  const [type, setType] = useState<"page" | "event">("page");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/funnel?userId=${userId}`);
      const data = await res.json();
      setSteps(data.steps || []);
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
    if (!label.trim() || !value.trim()) return;
    const res = await fetch("/api/admin/funnel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, label: label.trim(), type, value: value.trim() }),
    });
    if (res.ok) {
      setLabel("");
      setValue("");
      load();
    } else {
      const data = await res.json();
      setError(data.error || "追加に失敗しました");
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("この段階を削除しますか？")) return;
    const res = await fetch(`/api/admin/funnel/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  async function move(id: number, direction: "up" | "down") {
    const res = await fetch(`/api/admin/funnel/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction }),
    });
    if (res.ok) load();
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6 print:hidden">
      <button onClick={() => setOpen(!open)} className="flex items-center justify-between w-full text-left">
        <h3 className="text-sm font-bold text-gray-800">
          ゴールデン経路（ファネル）設定
          <span className="ml-2 text-xs font-normal text-gray-500">
            （入口→検討→成約の各段階を登録し、毎週の通過率・離脱率を計測）
          </span>
        </h3>
        <span className="text-gray-400 text-sm">{open ? "▲ 閉じる" : `▼ 開く（${steps.length}段階）`}</span>
      </button>

      {open && (
        <div className="mt-4">
          {loading ? (
            <p className="text-sm text-gray-400">読み込み中...</p>
          ) : steps.length === 0 ? (
            <p className="text-sm text-gray-400 mb-4">まだ段階が登録されていません。入口→成約の順に下から追加してください。</p>
          ) : (
            <div className="space-y-2 mb-4">
              {steps.map((s, i) => (
                <div key={s.id} className="flex items-center gap-2 bg-gray-50 rounded-md px-3 py-2">
                  <span className="w-6 h-6 shrink-0 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-800 truncate">
                      {s.label}
                      <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${s.step_type === "event" ? "bg-purple-100 text-purple-700" : "bg-gray-200 text-gray-600"}`}>
                        {s.step_type === "event" ? "イベント" : "ページ"}
                      </span>
                    </p>
                    <p className="text-xs text-gray-400 truncate">{s.step_value}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => move(s.id, "up")} disabled={i === 0} className="text-gray-400 hover:text-gray-700 disabled:opacity-30 px-1">↑</button>
                    <button onClick={() => move(s.id, "down")} disabled={i === steps.length - 1} className="text-gray-400 hover:text-gray-700 disabled:opacity-30 px-1">↓</button>
                    <button onClick={() => handleDelete(s.id)} className="text-xs text-red-600 hover:text-red-800 ml-1">削除</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleAdd} className="border-t border-gray-100 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">段階名（必須）</label>
                <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="例: 料金確認" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">種類</label>
                <select value={type} onChange={(e) => setType(e.target.value as "page" | "event")} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                  <option value="page">ページ到達</option>
                  <option value="event">イベント（CV）</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{type === "page" ? "URL / パス" : "イベント名"}（必須）</label>
                <input type="text" value={value} onChange={(e) => setValue(e.target.value)} placeholder={type === "page" ? "/price/ など" : "generate_lead / contact など"} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
              </div>
            </div>
            {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium">段階を追加</button>
            <p className="text-xs text-gray-400 mt-2">
              ※ 入口（例:トップ/記事）から成約（例:予約完了ページ or CVイベント）へ、上から順になるよう並べてください。次回レポート更新時から計測されます。
            </p>
          </form>
        </div>
      )}
    </div>
  );
}
