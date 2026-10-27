import { getSession, isStaff, canEdit } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import PasswordChangeForm from "./PasswordChangeForm";
import AdminAccountsManager, { StaffAccount } from "./AdminAccountsManager";

export default async function AdminSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isStaff(session.role)) redirect("/dashboard");

  const editable = canEdit(session.role);
  const accounts = editable
    ? (getDb()
        .prepare(
          `SELECT u.id, u.login_id, u.company_name, u.role, u.is_active, u.created_at,
                  (SELECT MAX(created_at) FROM login_logs l WHERE l.user_id = u.id AND l.success = 1) AS last_login
           FROM users u
           WHERE u.role IN ('admin', 'viewer')
           ORDER BY u.id`
        )
        .all() as StaffAccount[])
    : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header companyName={session.companyName} role={session.role} />

      <main className="max-w-6xl mx-auto px-6 py-8">
        <h2 className="text-xl font-bold text-gray-800 mb-6">設定</h2>
        <div className="space-y-8">
          <PasswordChangeForm />
          {editable && <AdminAccountsManager initialAccounts={accounts} currentUserId={session.id} />}
        </div>
      </main>
    </div>
  );
}
