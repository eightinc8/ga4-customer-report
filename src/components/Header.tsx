"use client";

import { useRouter } from "next/navigation";

interface HeaderProps {
  companyName: string;
  role: "admin" | "customer";
}

export default function Header({ companyName, role }: HeaderProps) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-gray-800">GA4 レポート</h1>
          {role === "admin" && (
            <nav className="flex gap-2 ml-4">
              <a href="/admin/reports" className="text-sm text-gray-600 hover:text-blue-600 px-3 py-1 rounded hover:bg-gray-50">
                レポート一覧
              </a>
              <a href="/admin" className="text-sm text-gray-600 hover:text-blue-600 px-3 py-1 rounded hover:bg-gray-50">
                顧客管理
              </a>
              <a href="/admin/logs" className="text-sm text-gray-600 hover:text-blue-600 px-3 py-1 rounded hover:bg-gray-50">
                ログイン履歴
              </a>
              <a href="/admin/settings" className="text-sm text-gray-600 hover:text-blue-600 px-3 py-1 rounded hover:bg-gray-50">
                設定
              </a>
            </nav>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{companyName}</span>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-red-600 transition-colors"
          >
            ログアウト
          </button>
        </div>
      </div>
    </header>
  );
}
