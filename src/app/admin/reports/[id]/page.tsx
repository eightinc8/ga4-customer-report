import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import ReportDetail from "./ReportDetail";
import TrackedPagesManager from "./TrackedPagesManager";
import FunnelManager from "./FunnelManager";

interface User {
  id: number;
  company_name: string;
  login_id: string;
  ga4_property_id: string;
}

interface Report {
  id: number;
  week_start: string;
  week_end: string;
  sessions: number;
  pageviews: number;
  users_count: number;
  bounce_rate: number;
  avg_session_duration: number;
  prev_sessions: number;
  prev_pageviews: number;
  prev_users_count: number;
  prev_bounce_rate: number;
  prev_avg_session_duration: number;
  new_users: number;
  returning_users: number;
  prev_new_users: number;
  prev_returning_users: number;
  top_pages: string;
  top_keywords: string;
  traffic_sources: string;
  prev_traffic_sources: string;
  tracked_pages: string;
  funnel_data: string;
}

export default async function CustomerReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const { id } = await params;
  const db = getDb();

  const customer = db
    .prepare("SELECT id, company_name, login_id, ga4_property_id FROM users WHERE id = ? AND role = 'customer'")
    .get(parseInt(id)) as User | undefined;

  if (!customer) redirect("/admin");

  const reports = db
    .prepare("SELECT * FROM reports WHERE user_id = ? ORDER BY week_start DESC LIMIT 52")
    .all(customer.id) as Report[];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header companyName={session.companyName} role={session.role} />

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6 print:hidden">
          <a href="/admin/reports" className="text-sm text-blue-600 hover:text-blue-800">
            ← 全顧客レポートに戻る
          </a>
        </div>

        <h2 className="text-xl font-bold text-gray-800 mb-2 print:hidden">
          {customer.company_name}
        </h2>
        <p className="text-sm text-gray-500 mb-6 print:hidden">
          GA4 プロパティID: {customer.ga4_property_id}
        </p>

        <FunnelManager userId={customer.id} />

        <TrackedPagesManager userId={customer.id} />

        <ReportDetail reports={reports} companyName={customer.company_name} />
      </main>
    </div>
  );
}
