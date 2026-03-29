import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { createClinicSchema } from "@/lib/validators/clinic";
import { createAuditLog, getClientInfo } from "@/lib/audit";
import { generalRateLimit, checkRateLimit } from "@/lib/rate-limit";

export async function GET() {
  try {
    const { error, session } = await requireAuth();
    if (error) return error;

    const clinics = await prisma.clinic.findMany({
      where: { doctorId: session!.user.id },
      include: {
        _count: {
          select: {
            patients: true,
            transactions: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(clinics);
  } catch (err) {
    console.error("GET /api/clinics error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

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
    const parsed = createClinicSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const clinic = await prisma.clinic.create({
      data: {
        name: parsed.data.name,
        location: parsed.data.location,
        doctorId: session!.user.id,
      },
      include: {
        _count: {
          select: {
            patients: true,
            transactions: true,
          },
        },
      },
    });

    const { ip, userAgent } = getClientInfo(request);
    await createAuditLog({
      action: "clinic.create",
      entity: "Clinic",
      entityId: clinic.id,
      details: { name: clinic.name, location: clinic.location },
      doctorId: session!.user.id,
      ip,
      userAgent,
    });

    return NextResponse.json(clinic, { status: 201 });
  } catch (err) {
    console.error("POST /api/clinics error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
