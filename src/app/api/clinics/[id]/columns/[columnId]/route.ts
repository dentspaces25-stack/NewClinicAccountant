import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, verifyClinicOwnership } from "@/lib/auth-guard";
import { createCustomColumnSchema } from "@/lib/validators/transaction";
import { createAuditLog, getClientInfo } from "@/lib/audit";

type Params = { params: Promise<{ id: string; columnId: string }> };

export async function PUT(request: Request, { params }: Params) {
  try {
    const { error, session } = await requireAuth();
    if (error) return error;

    const { id: clinicId, columnId } = await params;
    const clinic = await verifyClinicOwnership(clinicId, session!.user.id);
    if (!clinic) {
      return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
    }

    const existing = await prisma.customColumn.findFirst({
      where: { id: columnId, clinicId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Column not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = createCustomColumnSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const column = await prisma.customColumn.update({
      where: { id: columnId },
      data: {
        name: parsed.data.name,
        type: parsed.data.type,
      },
    });

    const { ip, userAgent } = getClientInfo(request);
    await createAuditLog({
      action: "customColumn.update",
      entity: "CustomColumn",
      entityId: columnId,
      details: { clinicId, name: column.name, type: column.type },
      doctorId: session!.user.id,
      ip,
      userAgent,
    });

    return NextResponse.json(column);
  } catch (err) {
    console.error("PUT /api/clinics/[id]/columns/[columnId] error:", err);

    if (
      err instanceof Error &&
      err.message.includes("Unique constraint")
    ) {
      return NextResponse.json(
        { error: "A column with this name already exists for this clinic" },
        { status: 409 }
      );
    }

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

    const { id: clinicId, columnId } = await params;
    const clinic = await verifyClinicOwnership(clinicId, session!.user.id);
    if (!clinic) {
      return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
    }

    const existing = await prisma.customColumn.findFirst({
      where: { id: columnId, clinicId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Column not found" },
        { status: 404 }
      );
    }

    await prisma.customColumn.delete({ where: { id: columnId } });

    const { ip, userAgent } = getClientInfo(request);
    await createAuditLog({
      action: "customColumn.delete",
      entity: "CustomColumn",
      entityId: columnId,
      details: { clinicId, name: existing.name },
      doctorId: session!.user.id,
      ip,
      userAgent,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/clinics/[id]/columns/[columnId] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
