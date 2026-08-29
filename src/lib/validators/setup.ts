import { z } from "zod";

export type TranslateFn = (key: string, values?: Record<string, string | number>) => string;

// Relative paths only; absolute paths and `..` traversal rejected
const DATA_DIR_REGEX = /^[a-zA-Z0-9_\-\/.]+$/;

export function dbConfigFormSchema(t?: TranslateFn) {
  return z.object({
    dataDir: z
      .string()
      .min(1, t?.("validation.required"))
      .max(200)
      .regex(DATA_DIR_REGEX, t?.("validation.required"))
      .refine(
        (value) => !value.includes("..") && !value.startsWith("/") && !value.startsWith("~"),
        t?.("validation.required")
      )
      .default("./data"),
  });
}
export type DbConfigFormInput = z.infer<ReturnType<typeof dbConfigFormSchema>>;

export const dbConfigSchema = dbConfigFormSchema();
export type DbConfigInput = z.infer<typeof dbConfigSchema>;

export function adminFormSchemaBase(t?: TranslateFn) {
  return z
    .object({
      username: z.string().regex(/^[a-zA-Z0-9_-]{3,32}$/, t?.("validation.username")),
      email: z.string().email(t?.("validation.email")).max(191),
      password: z
        .string()
        .min(10, t?.("validation.passwordLength"))
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, t?.("validation.passwordMix"))
        .max(128),
      confirmPassword: z.string(),
    });
}

export function adminFormSchema(t?: TranslateFn) {
  return adminFormSchemaBase(t).refine((data) => data.password === data.confirmPassword, {
    message: t?.("validation.passwordMismatch") ?? "passwordMismatch",
    path: ["confirmPassword"],
  });
}

export type AdminFormInput = z.infer<ReturnType<typeof adminFormSchemaBase>>;

export const finishSchema = z.object({
  seed: z.boolean(),
});
