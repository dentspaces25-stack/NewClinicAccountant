import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, verifyClinicOwnership } from "@/lib/auth-guard";
import { updatePatientSchema } from "@/lib/validators/patient";
import { createAuditLog, getClientInfo } from "@/lib/audit";
import { generalRateLimit, checkRateLimit } from "@/lib/rate-limit";

interface RouteParams {
  params: Promise<{ id: string; patientId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { error, session } = await requireAuth();
    if (error) return error;

    const { id, patientId } = await params;
    const clinic = await verifyClinicOwnership(id, session!.user.id);
    if (!clinic) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, clinicId: id },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    if (!patient) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(patient);
  } catch (err) {
    console.error("GET /api/clinics/[id]/patients/[patientId] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { error, session } = await requireAuth();
    if (error) return error;

    const { success } = await checkRateLimit(
      generalRateLimit,
      session!.user.id
    );
    if (!success) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      );
    }

    const { id, patientId } = await params;
    const clinic = await verifyClinicOwnership(id, session!.user.id);
    if (!clinic) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const existing = await prisma.patient.findFirst({
      where: { id: patientId, clinicId: id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updatePatientSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { tagIds, ...patientData } = parsed.data;

    const patient = await prisma.patient.update({
      where: { id: patientId },
      data: {
        ...patientData,
        treatmentPlanLink: patientData.treatmentPlanLink || null,
        tags:
          tagIds !== undefined
            ? {
                deleteMany: {},
                create: tagIds.map((tagId) => ({ tagId })),
              }
            : undefined,
      },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    const { ip, userAgent } = getClientInfo(request);
    await createAuditLog({
      action: "patient.update",
      entity: "Patient",
      entityId: patientId,
      details: { ...parsed.data, clinicId: id },
      doctorId: session!.user.id,
      ip,
      userAgent,
    });

    return NextResponse.json(patient);
  } catch (err) {
    console.error("PUT /api/clinics/[id]/patients/[patientId] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { error, session } = await requireAuth();
    if (error) return error;

    const { id, patientId } = await params;
    const clinic = await verifyClinicOwnership(id, session!.user.id);
    if (!clinic) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const existing = await prisma.patient.findFirst({
      where: { id: patientId, clinicId: id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.patient.delete({ where: { id: patientId } });

    const { ip, userAgent } = getClientInfo(request);
    await createAuditLog({
      action: "patient.delete",
      entity: "Patient",
      entityId: patientId,
      details: { name: existing.name, clinicId: id },
      doctorId: session!.user.id,
      ip,
      userAgent,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(
      "DELETE /api/clinics/[id]/patients/[patientId] error:",
      err
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
