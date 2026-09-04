import { z } from "zod";

const email = z.string().trim().toLowerCase().email("Enter a valid email address");
const password = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(200, "That password is too long");
const name = z.string().trim().min(2, "Enter a name").max(120);

export const signupSchema = z
  .object({
    name,
    email,
    password,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password"),
});

export const credentialsSchema = z.object({
  email,
  password: z.string().min(1),
});

export const createOrgSchema = z.object({
  name: z.string().trim().min(2, "Enter your business name").max(120),
});

export const renameOrgSchema = z.object({
  name: z.string().trim().min(2, "Enter your business name").max(120),
});

// Assignable roles only — OWNER is never assigned through the invite / role UI.
const assignableRole = z.enum(["ADMIN", "MANAGER", "SALES", "VIEWER"]);

export const inviteSchema = z.object({
  email,
  role: assignableRole,
});

export const changeRoleSchema = z.object({
  membershipId: z.string().min(1),
  role: assignableRole,
});

export const membershipIdSchema = z.object({
  membershipId: z.string().min(1),
});

export const inviteIdSchema = z.object({
  inviteId: z.string().min(1),
});

export const updateProfileSchema = z.object({
  name,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
