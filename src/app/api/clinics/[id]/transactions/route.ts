import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, verifyClinicOwnership } from "@/lib/auth-guard";
import { createTransactionSchema } from "@/lib/validators/transaction";
import { createAuditLog, getClientInfo } from "@/lib/audit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, session } = await requireAuth();
    if (error) return error;

    const { id: clinicId } = await params;
    const clinic = await verifyClinicOwnership(clinicId, session!.user.id);
    if (!clinic) {
      return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "50", 10)));
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const where: Record<string, unknown> = { clinicId };

    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }
      where.date = dateFilter;
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: { patient: { select: { id: true, name: true } } },
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
    console.error("GET /api/clinics/[id]/transactions error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, session } = await requireAuth();
    if (error) return error;

    const { id: clinicId } = await params;
    const clinic = await verifyClinicOwnership(clinicId, session!.user.id);
    if (!clinic) {
      return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = createTransactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const transaction = await prisma.transaction.create({
      data: {
        date: new Date(parsed.data.date),
        patientName: parsed.data.patientName,
        paid: parseFloat(parsed.data.paid),
        notes: parsed.data.notes || null,
        extra: parseFloat(parsed.data.extra),
        paidFromExtra: parseFloat(parsed.data.paidFromExtra),
        customColumns: parsed.data.customColumns ? JSON.parse(JSON.stringify(parsed.data.customColumns)) : undefined,
        source: parsed.data.source,
        clinicId,
        patientId: parsed.data.patientId ?? null,
      },
      include: { patient: { select: { id: true, name: true } } },
    });

    const { ip, userAgent } = getClientInfo(request);
    await createAuditLog({
      action: "transaction.create",
      entity: "Transaction",
      entityId: transaction.id,
      details: { clinicId, patientName: parsed.data.patientName, source: parsed.data.source },
      doctorId: session!.user.id,
      ip,
      userAgent,
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (err) {
    console.error("POST /api/clinics/[id]/transactions error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
