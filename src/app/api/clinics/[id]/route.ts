import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, verifyClinicOwnership } from "@/lib/auth-guard";
import { updateClinicSchema } from "@/lib/validators/clinic";
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

    const fullClinic = await prisma.clinic.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            patients: true,
            transactions: true,
          },
        },
      },
    });

    return NextResponse.json(fullClinic);
  } catch (err) {
    console.error("GET /api/clinics/[id] error:", err);
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

    const { id } = await params;
    const clinic = await verifyClinicOwnership(id, session!.user.id);
    if (!clinic) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateClinicSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updated = await prisma.clinic.update({
      where: { id },
      data: parsed.data,
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
      action: "clinic.update",
      entity: "Clinic",
      entityId: id,
      details: parsed.data,
      doctorId: session!.user.id,
      ip,
      userAgent,
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PUT /api/clinics/[id] error:", err);
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

    const { id } = await params;
    const clinic = await verifyClinicOwnership(id, session!.user.id);
    if (!clinic) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.clinic.delete({ where: { id } });

    const { ip, userAgent } = getClientInfo(request);
    await createAuditLog({
      action: "clinic.delete",
      entity: "Clinic",
      entityId: id,
      details: { name: clinic.name },
      doctorId: session!.user.id,
      ip,
      userAgent,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/clinics/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
