interface ExtractedRow {
  name: string;
  paid: string;
  notes: string;
  extra: string;
  paidFromExtra: string;
}

interface ExtractionResult {
  rows: ExtractedRow[];
}

export async function extractDataFromImage(
  base64Image: string,
  customColumnNames?: string[]
): Promise<ExtractionResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key not configured");
  }

  let columnPrompt = `الأعمدة هي:
- name (الاسم)
- paid (المدفوع - رقم)
- notes (الملاحظات)
- extra (الاضافي - رقم)
- paidFromExtra (المدفوع من الاضافي - رقم)`;

  if (customColumnNames && customColumnNames.length > 0) {
    columnPrompt += `\n\nأعمدة إضافية:\n${customColumnNames.map((n) => `- ${n}`).join("\n")}`;
  }

  const prompt = `أنت مساعد لاستخراج البيانات من صور جداول مكتوبة بخط اليد.
استخرج البيانات من هذه الصورة وأرجعها بصيغة JSON فقط بدون أي نص إضافي.

${columnPrompt}

أرجع النتيجة بهذا الشكل بالضبط:
{"rows": [{"name": "...", "paid": "...", "notes": "...", "extra": "...", "paidFromExtra": "..."}]}

إذا كانت خانة فارغة اتركها نص فارغ "".
مهم جداً: اكتب الأرقام بالأرقام الإنجليزية (0-9) وليس العربية (٠-٩).
أرجع JSON فقط بدون أي شرح أو نص إضافي.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: base64Image,
                },
              },
            ],
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(
      errData.error?.message || `Gemini API error: HTTP ${response.status}`
    );
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  // Parse JSON from response (handle markdown code blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to extract data from image");
  }

  const parsed = JSON.parse(jsonMatch[0]);
  const rows: ExtractedRow[] = (parsed.rows || []).map(
    (row: Record<string, string>) => ({
      name: sanitizeString(row.name || ""),
      paid: sanitizeNumericString(row.paid || "0"),
      notes: sanitizeString(row.notes || ""),
      extra: sanitizeNumericString(row.extra || "0"),
      paidFromExtra: sanitizeNumericString(row.paidFromExtra || "0"),
    })
  );

  return { rows };
}

function sanitizeString(input: string): string {
  return input.replace(/[<>]/g, "").trim().substring(0, 500);
}

function sanitizeNumericString(input: string): string {
  // Remove everything except digits, dots, and minus
  const cleaned = input.replace(/[^\d.\-]/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return "0";
  return num.toFixed(2);
}
