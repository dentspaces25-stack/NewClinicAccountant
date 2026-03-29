import { auth } from "./auth";
import { NextResponse } from "next/server";
import { prisma } from "./prisma";

export async function getAuthSession() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }
  return session;
}

export async function requireAuth() {
  const session = await getAuthSession();
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), session: null };
  }
  return { error: null, session };
}

export async function requireAdmin() {
  const { error, session } = await requireAuth();
  if (error) return { error, session: null };
  if (session!.user.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }), session: null };
  }
  return { error: null, session: session! };
}

/**
 * Verify that a clinic belongs to the authenticated doctor.
 * Returns 404 for non-existent OR non-owned clinics (prevents enumeration).
 */
export async function verifyClinicOwnership(clinicId: string, doctorId: string) {
  const clinic = await prisma.clinic.findFirst({
    where: { id: clinicId, doctorId },
  });
  return clinic;
}
