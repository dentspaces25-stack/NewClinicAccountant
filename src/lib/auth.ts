import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { prisma } from "./prisma";
import { loginSchema } from "./validators/auth";
import { createAuditLog } from "./audit";
import { authConfig } from "./auth.config";

declare module "next-auth" {
  interface User {
    id: string;
    name: string;
    phone: string;
    email?: string | null;
    role: "DOCTOR" | "ADMIN";
  }

  interface Session {
    user: {
      id: string;
      name: string;
      phone: string;
      email?: string | null;
      role: "DOCTOR" | "ADMIN";
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    phone: string;
    role: "DOCTOR" | "ADMIN";
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        phone: { label: "Phone", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { phone, password } = parsed.data;

        const doctor = await prisma.doctor.findUnique({
          where: { phone },
        });

        if (!doctor) return null;

        // Check account lockout
        if (doctor.lockedUntil && doctor.lockedUntil > new Date()) {
          throw new Error("ACCOUNT_LOCKED");
        }

        const passwordValid = await bcrypt.compare(password, doctor.passwordHash);

        if (!passwordValid) {
          const newAttempts = doctor.failedAttempts + 1;
          const updateData: { failedAttempts: number; lockedUntil?: Date } = {
            failedAttempts: newAttempts,
          };

          if (newAttempts >= 5) {
            updateData.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
          }

          await prisma.doctor.update({
            where: { id: doctor.id },
            data: updateData,
          });

          await createAuditLog({
            action: "LOGIN_FAILED",
            entity: "doctor",
            entityId: doctor.id,
            details: { phone, attempts: newAttempts },
          });

          if (newAttempts >= 5) {
            throw new Error("ACCOUNT_LOCKED");
          }

          return null;
        }

        // Reset failed attempts on successful login
        await prisma.doctor.update({
          where: { id: doctor.id },
          data: { failedAttempts: 0, lockedUntil: null },
        });

        await createAuditLog({
          action: "LOGIN_SUCCESS",
          entity: "doctor",
          entityId: doctor.id,
        });

        return {
          id: doctor.id,
          name: doctor.name,
          phone: doctor.phone,
          email: doctor.email,
          role: doctor.role,
        };
      },
    }),
  ],
  trustHost: true,
});
