import { z } from "zod";

export const USER_ROLES = ["admin", "manager", "operator", "base"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const userRoleEnum = z.enum(USER_ROLES);

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, { error: "Username must be at least 3 characters" })
  .max(50, { error: "Username must not exceed 50 characters" })
  .regex(/^[a-z0-9_.-]+$/, {
    error: "Username must contain only lowercase letters, numbers, hyphens, or underscores",
  });

export const nameSchema = z
  .string()
  .trim()
  .min(1, { error: "Name is required" })
  .max(100, { error: "Name must not exceed 100 characters" });

export const passwordSchema = z
  .string()
  .min(6, { error: "Password must be at least 6 characters" });

export const userSchema = z
  .object({
    id: z.int().positive({ error: "User ID must be a positive integer" }),
    username: usernameSchema,
    name: nameSchema,
    role: userRoleEnum,
    factory_id: z.int().positive({ error: "Factory ID must be a positive integer" }),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .strict();

export type User = z.infer<typeof userSchema>;

export const createUserSchema = z
  .object({
    name: nameSchema,
    role: userRoleEnum,
    username: usernameSchema,
    password: passwordSchema,
  })
  .strict();
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z
  .object({
    id: z.int().positive({ error: "Invalid user ID" }),
    name: nameSchema,
    role: userRoleEnum,
    username: usernameSchema,
    password: passwordSchema.optional().or(z.literal("")),
  })
  .strict();
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const deleteUserSchema = z
  .object({
    ids: z.array(z.int().positive()).min(1, { error: "At least one user ID is required" }),
  })
  .strict();
