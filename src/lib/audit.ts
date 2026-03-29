import { prisma } from "./prisma";

interface AuditLogParams {
  action: string;
  entity?: string;
  entityId?: string;
  details?: Record<string, unknown>;
  doctorId?: string;
  ip?: string;
  userAgent?: string;
}

export async function createAuditLog(params: AuditLogParams) {
  try {
    await prisma.auditLog.create({
      data: {
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        details: params.details ? JSON.parse(JSON.stringify(params.details)) : undefined,
        doctorId: params.doctorId,
        ip: params.ip?.substring(0, 45),
        userAgent: params.userAgent?.substring(0, 500),
      },
    });
  } catch {
    // Audit logging should never break the main flow
    console.error("Failed to create audit log");
  }
}

export function getClientInfo(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";
  return { ip, userAgent };
}
