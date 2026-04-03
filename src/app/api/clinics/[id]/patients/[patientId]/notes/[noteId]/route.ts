import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, verifyClinicOwnership } from "@/lib/auth-guard";
import { createAuditLog, getClientInfo } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ id: string; patientId: string; noteId: string }>;
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { error, session } = await requireAuth();
    if (error) return error;

    const { id: clinicId, patientId, noteId } = await params;
    const clinic = await verifyClinicOwnership(clinicId, session!.user.id);
    if (!clinic) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const note = await prisma.patientNote.findFirst({
      where: { id: noteId, patientId, patient: { clinicId } },
    });
    if (!note) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.patientNote.delete({ where: { id: noteId } });

    const { ip, userAgent } = getClientInfo(request);
    await createAuditLog({
      action: "patient_note.delete",
      entity: "PatientNote",
      entityId: noteId,
      details: { patientId, clinicId },
      doctorId: session!.user.id,
      ip,
      userAgent,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/clinics/[id]/patients/[patientId]/notes/[noteId] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
