import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { createTagSchema } from "@/lib/validators/patient";
import { createAuditLog, getClientInfo } from "@/lib/audit";
import { generalRateLimit, checkRateLimit } from "@/lib/rate-limit";

export async function GET() {
  try {
    const { error, session } = await requireAuth();
    if (error) return error;

    const tags = await prisma.tag.findMany({
      where: { doctorId: session!.user.id },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(tags);
  } catch (err) {
    console.error("GET /api/tags error:", err);
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
    const parsed = createTagSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Check for duplicate tag name for this doctor
    const existing = await prisma.tag.findFirst({
      where: { name: parsed.data.name, doctorId: session!.user.id },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A tag with this name already exists" },
        { status: 409 }
      );
    }

    const tag = await prisma.tag.create({
      data: {
        name: parsed.data.name,
        doctorId: session!.user.id,
      },
    });

    const { ip, userAgent } = getClientInfo(request);
    await createAuditLog({
      action: "tag.create",
      entity: "Tag",
      entityId: tag.id,
      details: { name: tag.name },
      doctorId: session!.user.id,
      ip,
      userAgent,
    });

    return NextResponse.json(tag, { status: 201 });
  } catch (err) {
    console.error("POST /api/tags error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
