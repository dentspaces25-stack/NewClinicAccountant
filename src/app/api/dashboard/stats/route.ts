import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";

export async function GET() {
  try {
    const { error, session } = await requireAuth();
    if (error) return error;

    const doctorId = session!.user.id;

    // Get all clinic IDs for this doctor
    const clinics = await prisma.clinic.findMany({
      where: { doctorId },
      select: { id: true, name: true },
    });
    const clinicIds = clinics.map((c) => c.id);

    const totalClinics = clinics.length;

    if (totalClinics === 0) {
      return NextResponse.json({
        totalClinics: 0,
        totalPatients: 0,
        totalEarnings: 0,
        heldAmount: 0,
        topClinic: null,
      });
    }

    // Run aggregates in parallel
    const [totalPatients, earningsAgg, topClinicAgg] = await Promise.all([
      prisma.patient.count({
        where: { clinicId: { in: clinicIds } },
      }),
      prisma.transaction.aggregate({
        where: { clinicId: { in: clinicIds } },
        _sum: {
          paid: true,
          extra: true,
          paidFromExtra: true,
        },
      }),
      prisma.transaction.groupBy({
        by: ["clinicId"],
        where: { clinicId: { in: clinicIds } },
        _sum: { paid: true },
        orderBy: { _sum: { paid: "desc" } },
        take: 1,
      }),
    ]);

    const totalEarnings = Number(earningsAgg._sum.paid ?? 0);
    const totalExtra = Number(earningsAgg._sum.extra ?? 0);
    const totalPaidFromExtra = Number(earningsAgg._sum.paidFromExtra ?? 0);
    const heldAmount = totalExtra - totalPaidFromExtra;

    let topClinic: { id: string; name: string; totalPaid: number } | null = null;
    if (topClinicAgg.length > 0) {
      const topClinicData = clinics.find((c) => c.id === topClinicAgg[0].clinicId);
      if (topClinicData) {
        topClinic = {
          id: topClinicData.id,
          name: topClinicData.name,
          totalPaid: Number(topClinicAgg[0]._sum.paid ?? 0),
        };
      }
    }

    return NextResponse.json({
      totalClinics,
      totalPatients,
      totalEarnings,
      heldAmount,
      topClinic,
    });
  } catch (err) {
    console.error("GET /api/dashboard/stats error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
