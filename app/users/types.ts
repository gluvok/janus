import { z } from "zod";

export const USER_ROLES = ["admin", "manager", "operator", "base", "customer"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const STAFF_ROLES = ["admin", "manager", "operator", "base"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export interface User {
  id: number;
  username: string | null;
  name: string;
  role: UserRole;
  factory_id: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export const userRoleEnum = z.enum(USER_ROLES);
export const staffRoleEnum = z.enum(STAFF_ROLES);

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

export const createStaffUserSchema = z.object({
  name: nameSchema,
  role: staffRoleEnum,
  username: usernameSchema,
  password: passwordSchema,
});

export const createCustomerUserSchema = z
  .object({
    name: nameSchema,
    role: z.literal("customer"),
    username: usernameSchema.optional().or(z.literal("")),
    password: passwordSchema.optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    const hasUsername = Boolean(data.username && data.username.trim().length > 0);
    const hasPassword = Boolean(data.password && data.password.trim().length > 0);

    if (hasUsername && !hasPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Password is required when a portal username is set.",
        path: ["password"],
      });
    }
    if (hasPassword && !hasUsername) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Username is required when setting a portal password.",
        path: ["username"],
      });
    }
  });

export const createUserSchema = z.discriminatedUnion("role", [
  createStaffUserSchema,
  createCustomerUserSchema,
]);

/* -------------------------------------------------------------------------- */
/* Update Schemas                                                             */
/* -------------------------------------------------------------------------- */

export const updateStaffUserSchema = z.object({
  id: z.number().int().positive("Invalid user ID"),
  name: nameSchema,
  role: staffRoleEnum,
  username: usernameSchema,
  password: passwordSchema.optional().or(z.literal("")),
});

export const updateCustomerUserSchema = z
  .object({
    id: z.number().int().positive("Invalid user ID"),
    name: nameSchema,
    role: z.literal("customer"),
    username: usernameSchema.optional().or(z.literal("")),
    password: passwordSchema.optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    const hasUsername = Boolean(data.username && data.username.trim().length > 0);
    const hasPassword = Boolean(data.password && data.password.trim().length > 0);

    if (hasPassword && !hasUsername) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Username is required when setting a portal password.",
        path: ["username"],
      });
    }
  });

export const updateUserSchema = z.discriminatedUnion("role", [
  updateStaffUserSchema,
  updateCustomerUserSchema,
]);

export const deleteUserSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, "At least one ID required"),
});

/* -------------------------------------------------------------------------- */
/* Dialog Form Schemas (React Hook Form + Zod Resolvers)                      */
/* -------------------------------------------------------------------------- */

function getFormIdSchema(isEdit: boolean) {
  return isEdit
    ? z.number().int().positive("Invalid user ID")
    : z.number().int().positive("Invalid user ID").optional();
}

export function getStaffFormSchema(options: { isEdit: boolean }) {
  return z.object({
    name: nameSchema,
    role: staffRoleEnum,
    username: usernameSchema,
    password: options.isEdit ? passwordSchema.optional().or(z.literal("")) : passwordSchema,
    id: getFormIdSchema(options.isEdit),
  });
}

export type StaffFormInput = z.infer<ReturnType<typeof getStaffFormSchema>>;

export function getCustomerFormSchema(options: {
  isEdit: boolean;
  hasExistingCredentials?: boolean;
}) {
  const isPasswordRequired = !options.isEdit || !options.hasExistingCredentials;
  const id = getFormIdSchema(options.isEdit);

  const disabledBranch = z.object({
    portalAccessEnabled: z.literal(false),
    name: nameSchema,
    username: z.string().optional(),
    password: z.string().optional(),
    id,
  });

  const enabledBranch = z.object({
    portalAccessEnabled: z.literal(true),
    name: nameSchema,
    username: usernameSchema,
    password: isPasswordRequired ? passwordSchema : passwordSchema.optional().or(z.literal("")),
    id,
  });

  return z.discriminatedUnion("portalAccessEnabled", [disabledBranch, enabledBranch]);
}

export type CustomerFormInput = z.infer<ReturnType<typeof getCustomerFormSchema>>;

export type CreateStaffUserInput = z.infer<typeof createStaffUserSchema>;
export type CreateCustomerUserInput = z.infer<typeof createCustomerUserSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;

export type UpdateStaffUserInput = z.infer<typeof updateStaffUserSchema>;
export type UpdateCustomerUserInput = z.infer<typeof updateCustomerUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export type DeleteUserInput = z.infer<typeof deleteUserSchema>;

export interface UsersApiResponse {
  data: User[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
