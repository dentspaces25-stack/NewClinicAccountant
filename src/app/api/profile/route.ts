import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { updateProfileSchema } from "@/lib/validators/auth";
import { createAuditLog, getClientInfo } from "@/lib/audit";

export async function GET() {
  try {
    const { error, session } = await requireAuth();
    if (error) return error;

    const doctor = await prisma.doctor.findUnique({
      where: { id: session!.user.id },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
      },
    });

    if (!doctor) {
      return NextResponse.json(
        { error: "Not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(doctor);
  } catch (err) {
    console.error("GET /api/profile error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const { error, session } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, email } = parsed.data;

    // Check email uniqueness if changed
    if (email && email !== "") {
      const existing = await prisma.doctor.findFirst({
        where: {
          email,
          NOT: { id: session!.user.id },
        },
      });
      if (existing) {
        return NextResponse.json(
          { error: "Email already in use" },
          { status: 400 }
        );
      }
    }

    const updateData: { name?: string; email?: string | null } = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email === "" ? null : email;

    const doctor = await prisma.doctor.update({
      where: { id: session!.user.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
      },
    });

    const { ip, userAgent } = getClientInfo(request);
    await createAuditLog({
      action: "profile.update",
      entity: "Doctor",
      entityId: doctor.id,
      details: { name, email },
      doctorId: doctor.id,
      ip,
      userAgent,
    });

    return NextResponse.json(doctor);
  } catch (err) {
    console.error("PUT /api/profile error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
