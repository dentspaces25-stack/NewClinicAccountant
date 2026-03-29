import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { changePasswordSchema } from "@/lib/validators/auth";
import { createAuditLog, getClientInfo } from "@/lib/audit";
import { generalRateLimit, checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
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

    const body = await request.json();
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = parsed.data;

    const doctor = await prisma.doctor.findUnique({
      where: { id: session!.user.id },
      select: { id: true, passwordHash: true },
    });

    if (!doctor) {
      return NextResponse.json(
        { error: "Not found" },
        { status: 404 }
      );
    }

    const isValid = await bcrypt.compare(currentPassword, doctor.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 }
      );
    }

    const newHash = await bcrypt.hash(newPassword, 12);

    await prisma.doctor.update({
      where: { id: doctor.id },
      data: { passwordHash: newHash },
    });

    const { ip, userAgent } = getClientInfo(request);
    await createAuditLog({
      action: "password.change",
      entity: "Doctor",
      entityId: doctor.id,
      doctorId: doctor.id,
      ip,
      userAgent,
    });

    return NextResponse.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error("POST /api/auth/change-password error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
