import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import PasswordChangeForm from "./PasswordChangeForm";

export default async function AdminSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  return (
    <div className="min-h-screen bg-gray-50">
      <Header companyName={session.companyName} role={session.role} />

      <main className="max-w-6xl mx-auto px-6 py-8">
        <h2 className="text-xl font-bold text-gray-800 mb-6">設定</h2>
        <PasswordChangeForm />
      </main>
    </div>
  );
}
