import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, verifyClinicOwnership } from "@/lib/auth-guard";
import { createCustomColumnSchema } from "@/lib/validators/transaction";
import { createAuditLog, getClientInfo } from "@/lib/audit";

export async function GET(
  _request: Request,
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

    const columns = await prisma.customColumn.findMany({
      where: { clinicId },
      orderBy: { order: "asc" },
    });

    return NextResponse.json(columns);
  } catch (err) {
    console.error("GET /api/clinics/[id]/columns error:", err);
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
    const parsed = createCustomColumnSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Get the next order value
    const maxOrder = await prisma.customColumn.findFirst({
      where: { clinicId },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const column = await prisma.customColumn.create({
      data: {
        name: parsed.data.name,
        type: parsed.data.type,
        order: (maxOrder?.order ?? -1) + 1,
        clinicId,
      },
    });

    const { ip, userAgent } = getClientInfo(request);
    await createAuditLog({
      action: "customColumn.create",
      entity: "CustomColumn",
      entityId: column.id,
      details: { clinicId, name: column.name, type: column.type },
      doctorId: session!.user.id,
      ip,
      userAgent,
    });

    return NextResponse.json(column, { status: 201 });
  } catch (err) {
    console.error("POST /api/clinics/[id]/columns error:", err);

    // Handle unique constraint violation (duplicate column name per clinic)
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
