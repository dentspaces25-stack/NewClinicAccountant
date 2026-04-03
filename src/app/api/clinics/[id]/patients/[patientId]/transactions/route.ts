import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, verifyClinicOwnership } from "@/lib/auth-guard";

interface RouteParams {
  params: Promise<{ id: string; patientId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { error, session } = await requireAuth();
    if (error) return error;

    const { id: clinicId, patientId } = await params;
    const clinic = await verifyClinicOwnership(clinicId, session!.user.id);
    if (!clinic) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, clinicId },
      select: { id: true },
    });
    if (!patient) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));

    const where = { clinicId, patientId };

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { date: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.transaction.count({ where }),
    ]);

    return NextResponse.json({
      transactions,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err) {
    console.error("GET /api/clinics/[id]/patients/[patientId]/transactions error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
