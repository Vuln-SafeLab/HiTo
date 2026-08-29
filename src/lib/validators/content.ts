import { z } from "zod";
import type { TranslateFn } from "@/lib/validators/setup";

export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HTTP_URL_REGEX = /^https?:\/\/.+/;
const IMAGE_PATH_REGEX = /^(https?:\/\/.+|\/uploads\/[A-Za-z0-9._-]+)$/;

export function categoryFormSchema(t?: TranslateFn) {
  return z.object({
    name: z.string().min(1, t?.("validation.required")).max(191),
    slug: z.string().min(1, t?.("validation.required")).regex(SLUG_REGEX, t?.("validation.slug")).max(100),
    icon: z.string().min(1, t?.("validation.required")).max(64),
    description: z.string().max(512),
  });
}
export type CategoryFormInput = z.infer<ReturnType<typeof categoryFormSchema>>;

export function cardFormSchema(t?: TranslateFn) {
  return z.object({
    title: z.string().min(1, t?.("validation.required")).max(191),
    url: z.string().regex(HTTP_URL_REGEX, t?.("validation.url")).max(2048),
    description: z.string().max(5000),
    categoryId: z.string().min(1, t?.("validation.required")).max(191),
    tags: z.string().max(500),
    image: z.union([z.literal(""), z.string().regex(IMAGE_PATH_REGEX, t?.("validation.url")).max(2048)]),
    favicon: z.union([z.literal(""), z.string().regex(IMAGE_PATH_REGEX, t?.("validation.url")).max(2048)]),
    featured: z.boolean(),
    status: z.enum(["DRAFT", "PUBLISHED"]),
  });
}
export type CardFormInput = z.infer<ReturnType<typeof cardFormSchema>>;

export const idListSchema = z.array(z.string().cuid()).min(1).max(500);

export function passwordSchema(t?: TranslateFn) {
  return z
    .string()
    .min(10, t?.("validation.passwordLength"))
    .max(128)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, t?.("validation.passwordMix"))
    .refine((value) => Buffer.byteLength(value, "utf8") <= 72, {
      message: t?.("validation.max", { max: 72 }),
    });
}

export function userFormSchema(t?: TranslateFn) {
  return z.object({
    username: z.string().regex(/^[a-zA-Z0-9_-]{3,32}$/, t?.("validation.username")),
    email: z.string().email(t?.("validation.email")).max(191),
    role: z.enum(["ADMIN", "EDITOR"]),
    isActive: z.boolean(),
    password: z.union([z.literal(""), passwordSchema(t)]),
  });
}
export type UserFormInput = z.infer<ReturnType<typeof userFormSchema>>;

export function settingsFormSchema(t?: TranslateFn) {
  return z.object({
    siteName: z.string().min(1, t?.("validation.required")).max(100),
    logo: z.union([z.literal(""), z.string().regex(IMAGE_PATH_REGEX, t?.("validation.url")).max(2048)]),
    maintenance: z.boolean(),
  });
}
export type SettingsFormInput = z.infer<ReturnType<typeof settingsFormSchema>>;

export function seoSettingsFormSchema(t?: TranslateFn) {
  return z.object({
    seoTitle: z.string().max(140, t?.("validation.max", { max: 140 })),
    titleTemplate: z
      .string()
      .max(140, t?.("validation.max", { max: 140 }))
      .refine((value) => value === "" || value.includes("%s"), {
        message: t?.("validation.titleTemplate") ?? "titleTemplate",
      }),
    seoDescription: z.string().max(300, t?.("validation.max", { max: 300 })),
    keywords: z.string().max(300, t?.("validation.max", { max: 300 })),
    ogImage: z.union([
      z.literal(""),
      z.string().regex(IMAGE_PATH_REGEX, t?.("validation.url")).max(2048),
    ]),
    twitterCard: z.enum(["summary", "summary_large_image"]),
    robotsTxt: z.string().max(5000, t?.("validation.max", { max: 5000 })),
    noindex: z.boolean(),
    verifyGoogle: z.string().max(200, t?.("validation.max", { max: 200 })),
    verifyBing: z.string().max(200, t?.("validation.max", { max: 200 })),
    verifyBaidu: z.string().max(200, t?.("validation.max", { max: 200 })),
  });
}
export type SeoSettingsFormInput = z.infer<ReturnType<typeof seoSettingsFormSchema>>;

export function announcementFormSchema(t?: TranslateFn) {
  return z
    .object({
      content: z
        .string()
        .min(1, t?.("validation.required"))
        .max(500, t?.("validation.max", { max: 500 })),
      linkUrl: z.union([
        z.literal(""),
        z.string().regex(HTTP_URL_REGEX, t?.("validation.url")).max(2048),
      ]),
      linkText: z.string().max(100, t?.("validation.max", { max: 100 })),
      type: z.enum(["INFO", "SUCCESS", "WARNING", "ERROR"]),
      /** ISO string or empty (client converts datetime-local to ISO) */
      startAt: z.union([z.literal(""), z.string().datetime()]),
      endAt: z.union([z.literal(""), z.string().datetime()]),
      isActive: z.boolean(),
      isDismissible: z.boolean(),
      /** Form keeps string; server converts via Number() */
      priority: z.string().regex(/^\d{1,4}$/, t?.("validation.integer")),
    })
    .refine(
      (data) =>
        data.startAt === "" ||
        data.endAt === "" ||
        new Date(data.endAt).getTime() > new Date(data.startAt).getTime(),
      { message: t?.("validation.endAfterStart") ?? "endAfterStart", path: ["endAt"] }
    );
}
export type AnnouncementFormInput = z.infer<ReturnType<typeof announcementFormSchema>>;

export function banIpFormSchema(t?: TranslateFn) {
  return z.object({
    ip: z.string().ip({ message: t?.("validation.required") }),
    reason: z.string().max(255),
    /** empty = permanent ban */
    expiresDays: z.union([z.literal(""), z.string().regex(/^\d{1,4}$/, t?.("validation.required"))]),
  });
}
export type BanIpFormInput = z.infer<ReturnType<typeof banIpFormSchema>>;

export const importCategorySchema = z.object({
  slug: z.string().regex(SLUG_REGEX).max(100),
  name: z.string().min(1).max(191),
  icon: z.string().max(64).default("folder"),
  description: z.string().max(512).nullable().default(null),
  order: z.number().int().min(0).default(0),
});

export const importCardSchema = z.object({
  title: z.string().min(1).max(191),
  url: z.string().regex(HTTP_URL_REGEX).max(2048),
  description: z.string().max(5000).nullable().default(null),
  // image whitelist matches form schema: http(s) URL or /uploads/ path; blocks javascript: pseudo-protocol
  image: z
    .union([z.literal(""), z.string().regex(/^https?:\/\/.+/).max(2048)])
    .nullable()
    .default(null),
  favicon: z
    .union([z.literal(""), z.string().regex(/^https?:\/\/.+/).max(2048)])
    .nullable()
    .default(null),
  categorySlug: z.string().regex(SLUG_REGEX).max(100),
  order: z.number().int().min(0).default(0),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("PUBLISHED"),
  featured: z.boolean().default(false),
  // Dedupe and normalize: drop empty, cap at 10, prevent P2002
  tags: z
    .array(z.string().min(1).max(50))
    .max(50)
    .default([])
    .transform((tags) =>
      [...new Set(tags.map((tag) => tag.trim()).filter((tag) => tag !== ""))].slice(0, 10)
    ),
});

export const importPayloadSchema = z.object({
  version: z.literal(1),
  categories: z.array(importCategorySchema).max(200),
  cards: z.array(importCardSchema).max(5000),
});
export type ImportPayload = z.infer<typeof importPayloadSchema>;

export function appearanceFormSchema(t?: TranslateFn) {
  return z.object({
    accentFrom: z.string().regex(/^#[0-9a-fA-F]{6}$/, t?.("validation.required")),
    accentTo: z.string().regex(/^#[0-9a-fA-F]{6}$/, t?.("validation.required")),
    radius: z.enum(["sm", "md", "lg", "xl"]),
    defaultTheme: z.enum(["dark", "light"]),
    heroStyle: z.enum(["aurora", "grid", "minimal"]),
  });
}
export type AppearanceFormInput = z.infer<ReturnType<typeof appearanceFormSchema>>;
