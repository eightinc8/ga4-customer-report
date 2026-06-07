import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  if (apiKey !== process.env.GAS_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await request.json();
    const db = getDb();

    const user = db
      .prepare("SELECT id FROM users WHERE ga4_property_id = ? AND is_active = 1")
      .get(data.propertyId) as { id: number } | undefined;

    if (!user) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    db.prepare(
      `INSERT OR REPLACE INTO reports
       (user_id, week_start, week_end, sessions, pageviews, users_count, bounce_rate, avg_session_duration,
        prev_sessions, prev_pageviews, prev_users_count, prev_bounce_rate, prev_avg_session_duration)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      user.id,
      data.weekStart,
      data.weekEnd,
      data.sessions,
      data.pageviews,
      data.usersCount,
      data.bounceRate,
      data.avgSessionDuration,
      data.prevSessions,
      data.prevPageviews,
      data.prevUsersCount,
      data.prevBounceRate,
      data.prevAvgSessionDuration
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
