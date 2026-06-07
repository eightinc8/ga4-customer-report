import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getDb } from "./db";
import bcryptjs from "bcryptjs";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "change-this-secret-in-production-immediately"
);
const COOKIE_NAME = "ga4_session";
const MAX_AGE = 60 * 60 * 8; // 8 hours

export interface SessionUser {
  id: number;
  loginId: string;
  companyName: string;
  role: "admin" | "customer";
}

export async function createSession(user: SessionUser): Promise<string> {
  const token = await new SignJWT({
    id: user.id,
    loginId: user.loginId,
    companyName: user.companyName,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${MAX_AGE}s`)
    .setIssuedAt()
    .sign(SECRET);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  });

  return token;
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function authenticate(
  loginId: string,
  password: string,
  ip: string,
  userAgent: string
): Promise<SessionUser | null> {
  const db = getDb();

  const user = db
    .prepare(
      "SELECT id, login_id, password_hash, company_name, role, is_active FROM users WHERE login_id = ?"
    )
    .get(loginId) as {
    id: number;
    login_id: string;
    password_hash: string;
    company_name: string;
    role: "admin" | "customer";
    is_active: number;
  } | undefined;

  const success = user?.is_active === 1 && bcryptjs.compareSync(password, user.password_hash);

  db.prepare(
    "INSERT INTO login_logs (user_id, login_id, ip_address, user_agent, success) VALUES (?, ?, ?, ?, ?)"
  ).run(user?.id ?? null, loginId, ip, userAgent, success ? 1 : 0);

  if (!success) return null;

  return {
    id: user!.id,
    loginId: user!.login_id,
    companyName: user!.company_name,
    role: user!.role,
  };
}
