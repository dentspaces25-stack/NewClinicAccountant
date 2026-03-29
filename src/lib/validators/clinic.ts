import { z } from "zod";

export const createClinicSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  location: z.string().min(1).max(500).trim(),
});

export const updateClinicSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  location: z.string().min(1).max(500).trim().optional(),
});

export type CreateClinicInput = z.infer<typeof createClinicSchema>;
export type UpdateClinicInput = z.infer<typeof updateClinicSchema>;
