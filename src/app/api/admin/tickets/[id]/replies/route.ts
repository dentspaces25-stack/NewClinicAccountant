import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { createReplySchema } from "@/lib/validators/ticket";
import { createAuditLog, getClientInfo } from "@/lib/audit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, session } = await requireAdmin();
    if (error) return error;

    const { id } = await params;

    const ticket = await prisma.ticket.findUnique({
      where: { id },
    });

    if (!ticket) {
      return NextResponse.json(
        { error: "Not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = createReplySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const reply = await prisma.ticketReply.create({
      data: {
        message: parsed.data.message,
        isAdmin: true,
        ticketId: ticket.id,
      },
    });

    // Update ticket updatedAt
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { updatedAt: new Date() },
    });

    const { ip, userAgent } = getClientInfo(request);
    await createAuditLog({
      action: "ticket.admin_reply",
      entity: "TicketReply",
      entityId: reply.id,
      details: { ticketId: ticket.id },
      doctorId: session!.user.id,
      ip,
      userAgent,
    });

    return NextResponse.json(reply, { status: 201 });
  } catch (err) {
    console.error("POST /api/admin/tickets/[id]/replies error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
