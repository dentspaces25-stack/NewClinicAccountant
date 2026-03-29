export type { RegisterInput, LoginInput, ChangePasswordInput, UpdateProfileInput } from "@/lib/validators/auth";
export type { CreateClinicInput, UpdateClinicInput } from "@/lib/validators/clinic";
export type { CreatePatientInput, UpdatePatientInput, CreateTagInput } from "@/lib/validators/patient";
export type { CreateTransactionInput, UpdateTransactionInput, BulkCreateTransactionInput, CreateCustomColumnInput } from "@/lib/validators/transaction";
export type { CreateTicketInput, CreateReplyInput, UpdateTicketStatusInput } from "@/lib/validators/ticket";

export interface ApiError {
  error: string;
  details?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DashboardStats {
  totalClinics: number;
  totalPatients: number;
  totalEarnings: number;
  heldAmount: number;
  topClinic: { name: string; earnings: number } | null;
}

export interface MonthlyEarning {
  month: string;
  earnings: number;
}
