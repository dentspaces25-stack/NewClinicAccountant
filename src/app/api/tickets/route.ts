import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { createTicketSchema } from "@/lib/validators/ticket";
import { createAuditLog, getClientInfo } from "@/lib/audit";

export async function GET() {
  try {
    const { error, session } = await requireAuth();
    if (error) return error;

    const tickets = await prisma.ticket.findMany({
      where: { doctorId: session!.user.id },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(tickets);
  } catch (err) {
    console.error("GET /api/tickets error:", err);
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

    const body = await request.json();
    const parsed = createTicketSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const ticket = await prisma.ticket.create({
      data: {
        subject: parsed.data.subject,
        message: parsed.data.message,
        doctorId: session!.user.id,
      },
    });

    const { ip, userAgent } = getClientInfo(request);
    await createAuditLog({
      action: "ticket.create",
      entity: "Ticket",
      entityId: ticket.id,
      details: { subject: ticket.subject },
      doctorId: session!.user.id,
      ip,
      userAgent,
    });

    return NextResponse.json(ticket, { status: 201 });
  } catch (err) {
    console.error("POST /api/tickets error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
