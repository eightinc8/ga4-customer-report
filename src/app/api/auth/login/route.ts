import { NextRequest, NextResponse } from "next/server";
import { authenticate, createSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export async function POST(request: NextRequest) {
  try {
    const { loginId, password } = await request.json();

    if (!loginId || !password) {
      return NextResponse.json({ error: "ログインIDとパスワードを入力してください" }, { status: 400 });
    }

    const db = getDb();
    const recentFailures = db
      .prepare(
        `SELECT COUNT(*) as cnt FROM login_logs
         WHERE login_id = ? AND success = 0
         AND created_at > datetime('now', ?)`,
      )
      .get(loginId, `-${LOCKOUT_MINUTES} minutes`) as { cnt: number };

    if (recentFailures.cnt >= MAX_ATTEMPTS) {
      return NextResponse.json(
        { error: `ログイン試行回数が上限を超えました。${LOCKOUT_MINUTES}分後に再度お試しください` },
        { status: 429 },
      );
    }

    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    const user = await authenticate(loginId, password, ip, userAgent);
    if (!user) {
      return NextResponse.json({ error: "ログインIDまたはパスワードが正しくありません" }, { status: 401 });
    }

    await createSession(user);
    return NextResponse.json({ success: true, role: user.role });
  } catch {
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
