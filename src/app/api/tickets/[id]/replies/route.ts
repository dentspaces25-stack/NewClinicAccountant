import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { createReplySchema } from "@/lib/validators/ticket";
import { createAuditLog, getClientInfo } from "@/lib/audit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, session } = await requireAuth();
    if (error) return error;

    const { id } = await params;

    // Verify doctor owns the ticket
    const ticket = await prisma.ticket.findFirst({
      where: {
        id,
        doctorId: session!.user.id,
      },
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
        isAdmin: false,
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
      action: "ticket.reply",
      entity: "TicketReply",
      entityId: reply.id,
      details: { ticketId: ticket.id },
      doctorId: session!.user.id,
      ip,
      userAgent,
    });

    return NextResponse.json(reply, { status: 201 });
  } catch (err) {
    console.error("POST /api/tickets/[id]/replies error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
