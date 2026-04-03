import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, verifyClinicOwnership } from "@/lib/auth-guard";

interface RouteParams {
  params: Promise<{ id: string; patientId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { error, session } = await requireAuth();
    if (error) return error;

    const { id: clinicId, patientId } = await params;
    const clinic = await verifyClinicOwnership(clinicId, session!.user.id);
    if (!clinic) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const [patient, financials] = await Promise.all([
      prisma.patient.findFirst({
        where: { id: patientId, clinicId },
        include: {
          tags: { include: { tag: true } },
        },
      }),
      prisma.transaction.aggregate({
        where: { clinicId, patientId },
        _sum: { paid: true, extra: true, paidFromExtra: true },
        _count: { id: true },
      }),
    ]);

    if (!patient) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const totalPaid = Number(financials._sum.paid ?? 0);
    const totalExtra = Number(financials._sum.extra ?? 0);
    const totalPaidFromExtra = Number(financials._sum.paidFromExtra ?? 0);
    const heldAmount = totalExtra - totalPaidFromExtra;

    return NextResponse.json({
      patient,
      financials: {
        totalTransactions: financials._count.id,
        totalPaid,
        heldAmount: Math.max(0, heldAmount),
      },
    });
  } catch (err) {
    console.error("GET /api/clinics/[id]/patients/[patientId]/profile error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
