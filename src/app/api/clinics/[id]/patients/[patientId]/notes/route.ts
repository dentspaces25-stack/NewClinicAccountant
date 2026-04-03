import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, verifyClinicOwnership } from "@/lib/auth-guard";
import { createPatientNoteSchema } from "@/lib/validators/patient-note";
import { createAuditLog, getClientInfo } from "@/lib/audit";
import { generalRateLimit, checkRateLimit } from "@/lib/rate-limit";

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

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, clinicId },
      select: { id: true },
    });
    if (!patient) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const notes = await prisma.patientNote.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(notes);
  } catch (err) {
    console.error("GET /api/clinics/[id]/patients/[patientId]/notes error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { error, session } = await requireAuth();
    if (error) return error;

    const { success } = await checkRateLimit(generalRateLimit, session!.user.id);
    if (!success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

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

    const body = await request.json();
    const parsed = createPatientNoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const note = await prisma.patientNote.create({
      data: { content: parsed.data.content, patientId },
    });

    const { ip, userAgent } = getClientInfo(request);
    await createAuditLog({
      action: "patient_note.create",
      entity: "PatientNote",
      entityId: note.id,
      details: { patientId, clinicId },
      doctorId: session!.user.id,
      ip,
      userAgent,
    });

    return NextResponse.json(note, { status: 201 });
  } catch (err) {
    console.error("POST /api/clinics/[id]/patients/[patientId]/notes error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
