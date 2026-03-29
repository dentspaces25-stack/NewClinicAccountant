import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";

export async function GET() {
  try {
    const { error, session } = await requireAuth();
    if (error) return error;

    const doctorId = session!.user.id;

    const clinics = await prisma.clinic.findMany({
      where: { doctorId },
      select: { id: true },
    });
    const clinicIds = clinics.map((c) => c.id);

    if (clinicIds.length === 0) {
      return NextResponse.json({ earnings: [] });
    }

    // Get transactions from the last 12 months
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    const transactions = await prisma.transaction.findMany({
      where: {
        clinicId: { in: clinicIds },
        date: { gte: twelveMonthsAgo },
      },
      select: {
        date: true,
        paid: true,
      },
    });

    // Group by month
    const monthlyMap = new Map<string, number>();

    // Pre-fill with last 12 months so we always have all months
    for (let i = 0; i < 12; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthlyMap.set(key, 0);
    }

    for (const tx of transactions) {
      const date = new Date(tx.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + Number(tx.paid));
    }

    // Sort chronologically
    const earnings = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, amount]) => ({
        month,
        earnings: Math.round(amount * 100) / 100,
      }));

    return NextResponse.json({ earnings });
  } catch (err) {
    console.error("GET /api/dashboard/earnings error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
