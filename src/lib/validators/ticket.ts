import { z } from "zod";

export const createTicketSchema = z.object({
  subject: z.string().min(3).max(200).trim(),
  message: z.string().min(10).max(2000).trim(),
});

export const createReplySchema = z.object({
  message: z.string().min(1).max(2000).trim(),
});

export const updateTicketStatusSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type CreateReplyInput = z.infer<typeof createReplySchema>;
export type UpdateTicketStatusInput = z.infer<typeof updateTicketStatusSchema>;
