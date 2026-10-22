import { z } from "zod";

export const USER_ROLES = ["admin", "manager", "operator", "base"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface User {
  id: number;
  username: string;
  name: string;
  role: UserRole;
  factory_id: number;
  created_at: string;
  updated_at: string;
}

export const userRoleEnum = z.enum(USER_ROLES);

// Reusable single-source field validation schemas
export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(50, "Username must not exceed 50 characters")
  .regex(
    /^[a-z0-9_.-]+$/,
    "Username must contain only lowercase letters, numbers, hyphens, or underscores",
  );

export const nameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(100, "Name must not exceed 100 characters");

export const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

/* -------------------------------------------------------------------------- */
/* Creation Schemas                                                           */
/* -------------------------------------------------------------------------- */

export const createUserSchema = z.object({
  name: nameSchema,
  role: userRoleEnum,
  username: usernameSchema,
  password: passwordSchema,
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

/* -------------------------------------------------------------------------- */
/* Update Schemas                                                             */
/* -------------------------------------------------------------------------- */

export const updateUserSchema = z.object({
  id: z.number().int().positive("Invalid user ID"),
  name: nameSchema,
  role: userRoleEnum,
  username: usernameSchema,
  password: passwordSchema.optional().or(z.literal("")),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

/* -------------------------------------------------------------------------- */
/* Form Schemas                                                               */
/* -------------------------------------------------------------------------- */

export function getUserFormSchema({ isEdit }: { isEdit: boolean }) {
  if (isEdit) {
    return z.object({
      id: z.number().optional(),
      name: nameSchema,
      role: userRoleEnum,
      username: usernameSchema,
      password: passwordSchema.optional().or(z.literal("")),
    });
  }
  return z.object({
    id: z.number().optional(),
    name: nameSchema,
    role: userRoleEnum,
    username: usernameSchema,
    password: passwordSchema,
  });
}
export type UserFormInput = z.infer<ReturnType<typeof getUserFormSchema>>;

/* -------------------------------------------------------------------------- */
/* Deletion Schemas                                                           */
/* -------------------------------------------------------------------------- */

export const deleteUserSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, "At least one user ID is required"),
});
export type DeleteUserInput = z.infer<typeof deleteUserSchema>;
