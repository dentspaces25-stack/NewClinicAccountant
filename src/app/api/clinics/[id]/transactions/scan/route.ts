import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, verifyClinicOwnership } from "@/lib/auth-guard";
import { validateAndProcessImage } from "@/lib/image-validation";
import { extractDataFromImage } from "@/lib/gemini";
import { scanRateLimit, checkRateLimit } from "@/lib/rate-limit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, session } = await requireAuth();
    if (error) return error;

    const { success } = await checkRateLimit(scanRateLimit, session!.user.id);
    if (!success) {
      return NextResponse.json(
        { error: "Scan rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    const { id: clinicId } = await params;
    const clinic = await verifyClinicOwnership(clinicId, session!.user.id);
    if (!clinic) {
      return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("image") as File;

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No image file provided" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const validatedImage = await validateAndProcessImage(buffer, file.type);

    // Load custom column names for the clinic to pass to Gemini
    const customColumns = await prisma.customColumn.findMany({
      where: { clinicId },
      orderBy: { order: "asc" },
      select: { name: true },
    });
    const customColumnNames = customColumns.map((col) => col.name);

    const result = await extractDataFromImage(
      validatedImage.base64,
      customColumnNames.length > 0 ? customColumnNames : undefined
    );

    return NextResponse.json({
      rows: result.rows,
      customColumnNames,
    });
  } catch (err) {
    console.error("POST /api/clinics/[id]/transactions/scan error:", err);

    const message =
      err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("limit") || message.includes("size")
      ? 400
      : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
