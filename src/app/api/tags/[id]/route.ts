import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { createAuditLog, getClientInfo } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { error, session } = await requireAuth();
    if (error) return error;

    const { id } = await params;

    // Verify tag belongs to this doctor
    const tag = await prisma.tag.findFirst({
      where: { id, doctorId: session!.user.id },
    });
    if (!tag) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.tag.delete({ where: { id } });

    const { ip, userAgent } = getClientInfo(request);
    await createAuditLog({
      action: "tag.delete",
      entity: "Tag",
      entityId: id,
      details: { name: tag.name },
      doctorId: session!.user.id,
      ip,
      userAgent,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/tags/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
