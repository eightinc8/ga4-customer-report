import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { redirect } from "next/navigation";
import Header from "@/components/Header";

interface LoginLog {
  id: number;
  login_id: string;
  company_name: string | null;
  ip_address: string;
  user_agent: string;
  success: number;
  created_at: string;
}

export default async function LoginLogsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const db = getDb();
  const logs = db
    .prepare(
      `SELECT l.*, u.company_name
       FROM login_logs l
       LEFT JOIN users u ON l.user_id = u.id
       ORDER BY l.created_at DESC
       LIMIT 100`
    )
    .all() as LoginLog[];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header companyName={session.companyName} role={session.role} />

      <main className="max-w-6xl mx-auto px-6 py-8">
        <h2 className="text-xl font-bold text-gray-800 mb-6">ログイン履歴</h2>

        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">日時</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">ログインID</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">会社名</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">IPアドレス</th>
                <th className="text-center px-5 py-3 text-gray-500 font-medium">結果</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-5 py-2 text-gray-600">{log.created_at}</td>
                  <td className="px-5 py-2 text-gray-700">{log.login_id}</td>
                  <td className="px-5 py-2 text-gray-600">{log.company_name || "-"}</td>
                  <td className="px-5 py-2 text-gray-600 font-mono text-xs">{log.ip_address}</td>
                  <td className="px-5 py-2 text-center">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        log.success
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {log.success ? "成功" : "失敗"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
