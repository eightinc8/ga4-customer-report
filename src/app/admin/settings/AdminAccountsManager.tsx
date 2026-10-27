"use client";

import { useState, FormEvent } from "react";

export interface StaffAccount {
  id: number;
  login_id: string;
  company_name: string;
  role: "admin" | "viewer";
  is_active: number;
  created_at: string;
  last_login: string | null;
}

const ROLE_LABEL: Record<StaffAccount["role"], string> = {
  admin: "管理者（全操作）",
  viewer: "閲覧のみ",
};

export default function AdminAccountsManager({
  initialAccounts,
  currentUserId,
}: {
  initialAccounts: StaffAccount[];
  currentUserId: number;
}) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ loginId: "", displayName: "", role: "viewer" as StaffAccount["role"], password: "", confirm: "" });
  const [resetId, setResetId] = useState<number | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  function notify(text: string, error = false) {
    setMessage(text);
    setIsError(error);
  }

  async function reload() {
    const res = await fetch("/api/admin/accounts");
    if (res.ok) {
      const data = await res.json();
      setAccounts(data.accounts || []);
    }
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    if (form.password !== form.confirm) return notify("パスワード（確認）が一致しません", true);
    if (form.password.length < 8) return notify("パスワードは8文字以上にしてください", true);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId: form.loginId.trim(), displayName: form.displayName.trim(), role: form.role, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) return notify(data.error || "追加に失敗しました", true);
      await reload();
      setForm({ loginId: "", displayName: "", role: "viewer", password: "", confirm: "" });
      setShowForm(false);
      notify(`アカウント「${data.account.login_id}」を追加しました。ログインIDと初期パスワードを本人に伝えてください。`);
    } catch {
      notify("エラーが発生しました", true);
    } finally {
      setLoading(false);
    }
  }

  async function patch(id: number, body: Record<string, unknown>, okText: string) {
    setMessage("");
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) return notify(data.error || "更新に失敗しました", true);
      await reload();
      notify(okText);
      return true;
    } catch {
      notify("エラーが発生しました", true);
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: FormEvent) {
    e.preventDefault();
    if (resetId == null) return;
    if (resetPw.length < 8) return notify("パスワードは8文字以上にしてください", true);
    const ok = await patch(resetId, { newPassword: resetPw }, "パスワードを再設定しました。新しいパスワードを本人に伝えてください。");
    if (ok) {
      setResetId(null);
      setResetPw("");
    }
  }

  const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-start justify-between flex-wrap gap-2 mb-4">
        <div>
          <h3 className="text-sm font-medium text-gray-700">管理画面のアカウント</h3>
          <p className="text-xs text-gray-500 mt-1">
            この管理サイト（全顧客のレポート・SEO分析）にログインできる人を管理します。
            「閲覧のみ」は全ページを見られますが、顧客・登録ページ・ファネル・アカウントの追加や変更はできません。
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => { setShowForm(true); setMessage(""); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm transition-colors shrink-0"
          >
            + アカウントを追加
          </button>
        )}
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded text-sm ${isError ? "bg-red-50 border border-red-200 text-red-700" : "bg-green-50 border border-green-200 text-green-700"}`}>
          {message}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleAdd} className="border border-blue-100 bg-blue-50/40 rounded-lg p-4 mb-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">ログインID <span className="text-red-500">*</span></label>
              <input type="text" value={form.loginId} onChange={(e) => setForm({ ...form, loginId: e.target.value })} className={inputCls} placeholder="例: kyuyaku@nl-japan.com（メールアドレスでOK）" required autoComplete="off" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">表示名 <span className="text-red-500">*</span></label>
              <input type="text" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} className={inputCls} placeholder="例: 山田（NLジャパン）" required />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">権限</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as StaffAccount["role"] })} className={inputCls}>
                <option value="viewer">閲覧のみ（推奨）</option>
                <option value="admin">管理者（全操作）</option>
              </select>
            </div>
            <div />
            <div>
              <label className="block text-sm text-gray-600 mb-1">初期パスワード <span className="text-red-500">*</span></label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputCls} minLength={8} required autoComplete="new-password" placeholder="8文字以上" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">初期パスワード（確認）</label>
              <input type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} className={inputCls} minLength={8} required autoComplete="new-password" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm disabled:opacity-50">
              {loading ? "追加中..." : "追加"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 text-sm">
              キャンセル
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2 text-gray-500 font-medium">ログインID</th>
              <th className="text-left px-4 py-2 text-gray-500 font-medium">表示名</th>
              <th className="text-left px-4 py-2 text-gray-500 font-medium">権限</th>
              <th className="text-center px-4 py-2 text-gray-500 font-medium">状態</th>
              <th className="text-left px-4 py-2 text-gray-500 font-medium">最終ログイン</th>
              <th className="text-center px-4 py-2 text-gray-500 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => {
              const isSelf = a.id === currentUserId;
              return (
                <tr key={a.id} className="border-t border-gray-100">
                  <td className="px-4 py-2 text-gray-800">
                    {a.login_id}
                    {isSelf && <span className="ml-2 text-xs text-gray-400">（自分）</span>}
                  </td>
                  <td className="px-4 py-2 text-gray-600">{a.company_name}</td>
                  <td className="px-4 py-2">
                    {isSelf ? (
                      <span className="text-gray-600">{ROLE_LABEL[a.role]}</span>
                    ) : (
                      <select
                        value={a.role}
                        disabled={loading}
                        onChange={(e) => patch(a.id, { role: e.target.value }, "権限を変更しました")}
                        className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-700 bg-white"
                      >
                        <option value="viewer">閲覧のみ</option>
                        <option value="admin">管理者（全操作）</option>
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${a.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {a.is_active ? "有効" : "無効"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{a.last_login || "-"}</td>
                  <td className="px-4 py-2 text-center">
                    {isSelf ? (
                      <span className="text-xs text-gray-400">上のフォームで変更</span>
                    ) : resetId === a.id ? (
                      <form onSubmit={handleReset} className="flex items-center gap-2 justify-center">
                        <input
                          type="password"
                          value={resetPw}
                          onChange={(e) => setResetPw(e.target.value)}
                          className="w-40 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900"
                          placeholder="新しいパスワード"
                          minLength={8}
                          autoComplete="new-password"
                          autoFocus
                        />
                        <button type="submit" disabled={loading} className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50">設定</button>
                        <button type="button" onClick={() => { setResetId(null); setResetPw(""); }} className="text-xs text-gray-500 hover:text-gray-700">取消</button>
                      </form>
                    ) : (
                      <div className="flex gap-3 justify-center">
                        <button onClick={() => { setResetId(a.id); setResetPw(""); setMessage(""); }} className="text-xs text-blue-600 hover:text-blue-800">
                          パスワード再設定
                        </button>
                        <button
                          disabled={loading}
                          onClick={() => patch(a.id, { isActive: a.is_active ? 0 : 1 }, a.is_active ? "無効化しました（ログインできなくなります）" : "有効化しました")}
                          className="text-xs text-gray-500 hover:text-red-600 disabled:opacity-50"
                        >
                          {a.is_active ? "無効化" : "有効化"}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
