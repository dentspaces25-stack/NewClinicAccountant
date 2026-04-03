import { z } from "zod";

export const createPatientNoteSchema = z.object({
  content: z.string().min(1).max(1000).trim(),
});

export type CreatePatientNoteInput = z.infer<typeof createPatientNoteSchema>;
