import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, verifyClinicOwnership } from "@/lib/auth-guard";
import { createPatientSchema } from "@/lib/validators/patient";
import { createAuditLog, getClientInfo } from "@/lib/audit";
import { generalRateLimit, checkRateLimit } from "@/lib/rate-limit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { error, session } = await requireAuth();
    if (error) return error;

    const { id } = await params;
    const clinic = await verifyClinicOwnership(id, session!.user.id);
    if (!clinic) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const patients = await prisma.patient.findMany({
      where: { clinicId: id },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(patients);
  } catch (err) {
    console.error("GET /api/clinics/[id]/patients error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: RouteParams) {
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

    const { id } = await params;
    const clinic = await verifyClinicOwnership(id, session!.user.id);
    if (!clinic) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = createPatientSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const patient = await prisma.patient.create({
      data: {
        name: parsed.data.name,
        treatmentPlanLink: parsed.data.treatmentPlanLink || null,
        clinicId: id,
        tags: parsed.data.tagIds?.length
          ? {
              create: parsed.data.tagIds.map((tagId) => ({
                tagId,
              })),
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
      action: "patient.create",
      entity: "Patient",
      entityId: patient.id,
      details: { name: patient.name, clinicId: id },
      doctorId: session!.user.id,
      ip,
      userAgent,
    });

    return NextResponse.json(patient, { status: 201 });
  } catch (err) {
    console.error("POST /api/clinics/[id]/patients error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
