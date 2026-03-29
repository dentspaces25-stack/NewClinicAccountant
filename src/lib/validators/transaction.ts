import { z } from "zod";

const decimalString = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Invalid decimal format")
  .or(z.number().transform(String));

export const createTransactionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  patientName: z.string().min(1).max(200).trim(),
  paid: decimalString.optional().default("0"),
  notes: z.string().max(500).optional().default(""),
  extra: decimalString.optional().default("0"),
  paidFromExtra: decimalString.optional().default("0"),
  customColumns: z.record(z.string(), z.string().max(500)).optional(),
  source: z.enum(["manual", "scan"]).default("manual"),
  patientId: z.string().cuid().optional(),
});

export const updateTransactionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  patientName: z.string().min(1).max(200).trim().optional(),
  paid: decimalString.optional(),
  notes: z.string().max(500).optional(),
  extra: decimalString.optional(),
  paidFromExtra: decimalString.optional(),
  customColumns: z.record(z.string(), z.string().max(500)).optional(),
  patientId: z.string().cuid().optional().nullable(),
});

export const bulkCreateTransactionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rows: z
    .array(
      z.object({
        patientName: z.string().min(1).max(200).trim(),
        paid: decimalString.optional().default("0"),
        notes: z.string().max(500).optional().default(""),
        extra: decimalString.optional().default("0"),
        paidFromExtra: decimalString.optional().default("0"),
        customColumns: z.record(z.string(), z.string().max(500)).optional(),
      })
    )
    .min(1)
    .max(100),
});

export const createCustomColumnSchema = z.object({
  name: z.string().min(1).max(50).trim(),
  type: z.enum(["text", "number", "date"]).default("text"),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type BulkCreateTransactionInput = z.infer<typeof bulkCreateTransactionSchema>;
export type CreateCustomColumnInput = z.infer<typeof createCustomColumnSchema>;
