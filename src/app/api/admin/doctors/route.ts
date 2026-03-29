import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";

export async function GET() {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const doctors = await prisma.doctor.findMany({
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        createdAt: true,
        _count: {
          select: { clinics: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(doctors);
  } catch (err) {
    console.error("GET /api/admin/doctors error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
