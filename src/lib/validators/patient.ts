import { z } from "zod";

export const createPatientSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  treatmentPlanLink: z.string().url().max(2000).optional().or(z.literal("")),
  tagIds: z.array(z.string().cuid()).max(20).optional(),
});

export const updatePatientSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  treatmentPlanLink: z.string().url().max(2000).optional().or(z.literal("")),
  tagIds: z.array(z.string().cuid()).max(20).optional(),
});

export const createTagSchema = z.object({
  name: z.string().min(1).max(50).trim(),
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type CreateTagInput = z.infer<typeof createTagSchema>;
