import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import CustomerList from "./CustomerList";

interface User {
  id: number;
  login_id: string;
  company_name: string;
  ga4_property_id: string | null;
  is_active: number;
  created_at: string;
}

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const db = getDb();
  const customers = db
    .prepare(
      "SELECT id, login_id, company_name, ga4_property_id, is_active, created_at FROM users WHERE role = 'customer' ORDER BY company_name"
    )
    .all() as User[];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header companyName={session.companyName} role={session.role} />

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800">顧客管理</h2>
        </div>

        <CustomerList initialCustomers={customers} />
      </main>
    </div>
  );
}
