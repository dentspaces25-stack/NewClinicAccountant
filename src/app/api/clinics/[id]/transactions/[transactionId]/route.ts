import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, verifyClinicOwnership } from "@/lib/auth-guard";
import { updateTransactionSchema } from "@/lib/validators/transaction";
import { createAuditLog, getClientInfo } from "@/lib/audit";

type Params = { params: Promise<{ id: string; transactionId: string }> };

export async function PUT(request: Request, { params }: Params) {
  try {
    const { error, session } = await requireAuth();
    if (error) return error;

    const { id: clinicId, transactionId } = await params;
    const clinic = await verifyClinicOwnership(clinicId, session!.user.id);
    if (!clinic) {
      return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
    }

    const existing = await prisma.transaction.findFirst({
      where: { id: transactionId, clinicId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = updateTransactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.date !== undefined) updateData.date = new Date(parsed.data.date);
    if (parsed.data.patientName !== undefined) updateData.patientName = parsed.data.patientName;
    if (parsed.data.paid !== undefined) updateData.paid = parseFloat(parsed.data.paid);
    if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;
    if (parsed.data.extra !== undefined) updateData.extra = parseFloat(parsed.data.extra);
    if (parsed.data.paidFromExtra !== undefined) updateData.paidFromExtra = parseFloat(parsed.data.paidFromExtra);
    if (parsed.data.customColumns !== undefined) updateData.customColumns = parsed.data.customColumns;
    if (parsed.data.patientId !== undefined) updateData.patientId = parsed.data.patientId;

    const transaction = await prisma.transaction.update({
      where: { id: transactionId },
      data: updateData,
      include: { patient: { select: { id: true, name: true } } },
    });

    const { ip, userAgent } = getClientInfo(request);
    await createAuditLog({
      action: "transaction.update",
      entity: "Transaction",
      entityId: transactionId,
      details: { clinicId, fields: Object.keys(updateData) },
      doctorId: session!.user.id,
      ip,
      userAgent,
    });

    return NextResponse.json(transaction);
  } catch (err) {
    console.error("PUT /api/clinics/[id]/transactions/[transactionId] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { error, session } = await requireAuth();
    if (error) return error;

    const { id: clinicId, transactionId } = await params;
    const clinic = await verifyClinicOwnership(clinicId, session!.user.id);
    if (!clinic) {
      return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
    }

    const existing = await prisma.transaction.findFirst({
      where: { id: transactionId, clinicId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    await prisma.transaction.delete({ where: { id: transactionId } });

    const { ip, userAgent } = getClientInfo(request);
    await createAuditLog({
      action: "transaction.delete",
      entity: "Transaction",
      entityId: transactionId,
      details: { clinicId, patientName: existing.patientName },
      doctorId: session!.user.id,
      ip,
      userAgent,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/clinics/[id]/transactions/[transactionId] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
