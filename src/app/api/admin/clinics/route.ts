import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";

export async function GET() {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const clinics = await prisma.clinic.findMany({
      select: {
        id: true,
        name: true,
        location: true,
        createdAt: true,
        doctor: {
          select: { id: true, name: true },
        },
        _count: {
          select: { patients: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(clinics);
  } catch (err) {
    console.error("GET /api/admin/clinics error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
