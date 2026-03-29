import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validators/auth";
import { registerRateLimit, checkRateLimit } from "@/lib/rate-limit";
import { createAuditLog, getClientInfo } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const { ip, userAgent } = getClientInfo(request);

    // Rate limit by IP
    const rateLimitResult = await checkRateLimit(registerRateLimit, `register:${ip}`);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Too many registration attempts. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, phone, email, password } = parsed.data;

    // Check if phone already exists
    const existing = await prisma.doctor.findFirst({
      where: {
        OR: [
          { phone },
          ...(email ? [{ email }] : []),
        ],
      },
    });

    if (existing) {
      // Generic message to prevent user enumeration
      return NextResponse.json(
        { error: "Unable to create account. Please try different credentials." },
        { status: 409 }
      );
    }

    // Hash password with bcrypt cost factor 12
    const passwordHash = await bcrypt.hash(password, 12);

    const doctor = await prisma.doctor.create({
      data: {
        name,
        phone,
        email: email || null,
        passwordHash,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    await createAuditLog({
      action: "REGISTER",
      entity: "doctor",
      entityId: doctor.id,
      ip,
      userAgent,
    });

    return NextResponse.json(doctor, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
