"use client";

import { useState } from "react";

interface Customer {
  id: number;
  login_id: string;
  company_name: string;
  ga4_property_id: string | null;
  is_active: number;
  created_at: string;
}

export default function CustomerList({
  initialCustomers,
}: {
  initialCustomers: Customer[];
}) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState({ companyName: "", loginId: "", ga4PropertyId: "" });
  const [formData, setFormData] = useState({
    loginId: "",
    password: "",
    companyName: "",
    ga4PropertyId: "",
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAdd() {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error);
        return;
      }
      setCustomers([...customers, data.customer]);
      setFormData({ loginId: "", password: "", companyName: "", ga4PropertyId: "" });
      setShowForm(false);
      setMessage("顧客を追加しました");
    } catch {
      setMessage("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(id: number, currentState: number) {
    try {
      const res = await fetch(`/api/admin/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: currentState === 1 ? 0 : 1 }),
      });
      if (res.ok) {
        setCustomers(
          customers.map((c) =>
            c.id === id ? { ...c, is_active: currentState === 1 ? 0 : 1 } : c
          )
        );
      }
    } catch {
      setMessage("エラーが発生しました");
    }
  }

  function startEdit(c: Customer) {
    setEditingId(c.id);
    setEditData({
      companyName: c.company_name,
      loginId: c.login_id.startsWith("customer_") ? "" : c.login_id,
      ga4PropertyId: c.ga4_property_id || "",
    });
  }

  async function handleSaveEdit(id: number) {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: editData.companyName,
          loginId: editData.loginId,
          ga4PropertyId: editData.ga4PropertyId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error);
        return;
      }
      setCustomers(
        customers.map((c) =>
          c.id === id
            ? {
                ...c,
                company_name: editData.companyName,
                login_id: editData.loginId || c.login_id,
                ga4_property_id: editData.ga4PropertyId || null,
              }
            : c
        )
      );
      setEditingId(null);
      setMessage("更新しました");
    } catch {
      setMessage("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {message && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-blue-700 text-sm">
          {message}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-5 py-3 text-gray-500 font-medium">会社名</th>
              <th className="text-left px-5 py-3 text-gray-500 font-medium">ログインID</th>
              <th className="text-left px-5 py-3 text-gray-500 font-medium">GA4 プロパティID</th>
              <th className="text-center px-5 py-3 text-gray-500 font-medium">ステータス</th>
              <th className="text-center px-5 py-3 text-gray-500 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                {editingId === c.id ? (
                  <>
                    <td className="px-5 py-2">
                      <input
                        type="text"
                        value={editData.companyName}
                        onChange={(e) => setEditData({ ...editData, companyName: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-5 py-2">
                      <input
                        type="text"
                        value={editData.loginId}
                        onChange={(e) => setEditData({ ...editData, loginId: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="任意"
                      />
                    </td>
                    <td className="px-5 py-2">
                      <input
                        type="text"
                        value={editData.ga4PropertyId}
                        onChange={(e) => setEditData({ ...editData, ga4PropertyId: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-5 py-2 text-center">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${c.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {c.is_active ? "有効" : "無効"}
                      </span>
                    </td>
                    <td className="px-5 py-2 text-center">
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => handleSaveEdit(c.id)}
                          disabled={loading || !editData.companyName}
                          className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          取消
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-5 py-3 text-gray-800 font-medium">{c.company_name}</td>
                    <td className="px-5 py-3 text-gray-600">
                      {c.login_id.startsWith("customer_") ? <span className="text-gray-400">未設定</span> : c.login_id}
                    </td>
                    <td className="px-5 py-3 text-gray-600">{c.ga4_property_id || "-"}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${c.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {c.is_active ? "有効" : "無効"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <div className="flex gap-3 justify-center">
                        <button
                          onClick={() => startEdit(c)}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => toggleActive(c.id, c.is_active)}
                          className="text-xs text-gray-500 hover:text-red-600"
                        >
                          {c.is_active ? "無効化" : "有効化"}
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-gray-400">
                  顧客がまだ登録されていません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm transition-colors"
        >
          + 新規顧客を追加
        </button>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-4">新規顧客追加</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">会社名 <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">GA4 プロパティID</label>
              <input
                type="text"
                value={formData.ga4PropertyId}
                onChange={(e) => setFormData({ ...formData, ga4PropertyId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="例: 123456789"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">ログインID <span className="text-gray-400 text-xs">（任意）</span></label>
              <input
                type="text"
                value={formData.loginId}
                onChange={(e) => setFormData({ ...formData, loginId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="顧客ログイン用（後から設定可）"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">パスワード <span className="text-gray-400 text-xs">（任意）</span></label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="8文字以上（後から設定可）"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={loading || !formData.companyName}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm disabled:opacity-50 transition-colors"
            >
              {loading ? "追加中..." : "追加"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 text-sm transition-colors"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </>
  );
}
