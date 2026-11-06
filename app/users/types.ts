import { z } from "zod";

export const USER_ROLES = ["admin", "manager", "operator", "base"] as const;
export type UserRole = (typeof USER_ROLES)[number];

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

export const userSchema = z
  .object({
    id: z.number().int().positive(),
    username: usernameSchema,
    name: nameSchema,
    role: userRoleEnum,
    factory_id: z.number().int().positive(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .strict();

export type User = z.infer<typeof userSchema>;

/* -------------------------------------------------------------------------- */
/* Creation Schemas                                                           */
/* -------------------------------------------------------------------------- */

export const createUserSchema = z
  .object({
    name: nameSchema,
    role: userRoleEnum,
    username: usernameSchema,
    password: passwordSchema,
  })
  .strict();
export type CreateUserInput = z.infer<typeof createUserSchema>;

/* -------------------------------------------------------------------------- */
/* Update Schemas                                                             */
/* -------------------------------------------------------------------------- */

export const updateUserSchema = z
  .object({
    id: z.number().int().positive("Invalid user ID"),
    name: nameSchema,
    role: userRoleEnum,
    username: usernameSchema,
    password: passwordSchema.optional().or(z.literal("")),
  })
  .strict();
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

/* -------------------------------------------------------------------------- */
/* Form Schemas                                                               */
/* -------------------------------------------------------------------------- */

const baseUserFormFields = {
  id: z.number().int().positive().optional(),
  name: nameSchema,
  role: userRoleEnum,
  username: usernameSchema,
};

export const createUserFormSchema = z
  .object({
    ...baseUserFormFields,
    password: passwordSchema,
  })
  .strict();

export const editUserFormSchema = z
  .object({
    ...baseUserFormFields,
    password: passwordSchema.optional().or(z.literal("")),
  })
  .strict();

export const USER_FORM_SCHEMAS = {
  create: createUserFormSchema,
  edit: editUserFormSchema,
} as const;

export type UserFormInput = z.infer<typeof editUserFormSchema>;

/* -------------------------------------------------------------------------- */
/* Deletion Schemas                                                           */
/* -------------------------------------------------------------------------- */

export const deleteUserSchema = z
  .object({
    ids: z.array(z.number().int().positive()).min(1, "At least one user ID is required"),
  })
  .strict();
export type DeleteUserInput = z.infer<typeof deleteUserSchema>;
