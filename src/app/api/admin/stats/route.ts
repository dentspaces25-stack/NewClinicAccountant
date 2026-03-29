import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";

export async function GET() {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const [
      totalDoctors,
      totalClinics,
      totalPatients,
      totalTransactions,
      earningsResult,
      openTickets,
    ] = await Promise.all([
      prisma.doctor.count(),
      prisma.clinic.count(),
      prisma.patient.count(),
      prisma.transaction.count(),
      prisma.transaction.aggregate({
        _sum: { paid: true },
      }),
      prisma.ticket.count({
        where: { status: "OPEN" },
      }),
    ]);

    return NextResponse.json({
      totalDoctors,
      totalClinics,
      totalPatients,
      totalTransactions,
      totalEarnings: earningsResult._sum.paid?.toString() ?? "0",
      openTickets,
    });
  } catch (err) {
    console.error("GET /api/admin/stats error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
