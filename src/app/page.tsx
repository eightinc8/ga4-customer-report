import { getSession, isStaff } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (isStaff(session.role)) redirect("/admin");
  redirect("/dashboard");
}
