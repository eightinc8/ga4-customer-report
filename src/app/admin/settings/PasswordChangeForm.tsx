"use client";

import { useState, FormEvent } from "react";

export default function PasswordChangeForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage("");

    if (newPassword !== confirmPassword) {
      setMessage("新しいパスワードが一致しません");
      setIsError(true);
      return;
    }

    if (newPassword.length < 8) {
      setMessage("パスワードは8文字以上にしてください");
      setIsError(true);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error);
        setIsError(true);
      } else {
        setMessage("パスワードを変更しました");
        setIsError(false);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setMessage("エラーが発生しました");
      setIsError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-md">
      <h3 className="text-sm font-medium text-gray-700 mb-4">パスワード変更</h3>

      {message && (
        <div
          className={`mb-4 p-3 rounded text-sm ${
            isError
              ? "bg-red-50 border border-red-200 text-red-700"
              : "bg-green-50 border border-green-200 text-green-700"
          }`}
        >
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">現在のパスワード</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">新しいパスワード</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            minLength={8}
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">新しいパスワード（確認）</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            minLength={8}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm disabled:opacity-50 transition-colors"
        >
          {loading ? "変更中..." : "パスワードを変更"}
        </button>
      </form>
    </div>
  );
}
