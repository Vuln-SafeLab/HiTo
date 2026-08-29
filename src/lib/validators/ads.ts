import { z } from "zod";
import type { TranslateFn } from "@/lib/validators/setup";

// Ad module shared constants (safe to import on client and server, zero node deps)

export const AD_POSITIONS = [
  "HEADER",
  "FOOTER",
  "ARTICLE_TOP",
  "ARTICLE_BOTTOM",
  "SIDEBAR",
  "POPUP",
  "INLINE",
] as const;
export type AdPositionValue = (typeof AD_POSITIONS)[number];

export const AD_TYPES = ["SCRIPT", "HTML", "IMAGE", "IFRAME"] as const;
export type AdTypeValue = (typeof AD_TYPES)[number];

export const AD_DEVICES = ["ALL", "DESKTOP", "MOBILE"] as const;
export type AdDeviceValue = (typeof AD_DEVICES)[number];

export const PRESET_AD_PROVIDERS = [
  "百度广告",
  "搜狗广告",
  "腾讯广告",
  "字节穿山甲",
  "360广告",
  "Google Adsense",
  "Ezoic",
  "Mediavine",
  "PropellerAds",
  "Adsterra",
] as const;

export const CUSTOM_PROVIDER_SENTINEL = "__custom__";

export const MAX_AD_CODE_CHARS = 60_000;

const POSITION_LOCAL_KEYS: Record<AdPositionValue, string> = {
  HEADER: "ads.posHeader",
  FOOTER: "ads.posFooter",
  ARTICLE_TOP: "ads.posArticleTop",
  ARTICLE_BOTTOM: "ads.posArticleBottom",
  SIDEBAR: "ads.posSidebar",
  POPUP: "ads.posPopup",
  INLINE: "ads.posInline",
};

export function positionLabelKey(position: AdPositionValue): string {
  return POSITION_LOCAL_KEYS[position];
}

const TYPE_LOCAL_KEYS: Record<AdTypeValue, string> = {
  SCRIPT: "ads.typeScript",
  HTML: "ads.typeHtml",
  IMAGE: "ads.typeImage",
  IFRAME: "ads.typeIframe",
};

export function typeLabelKey(type: AdTypeValue): string {
  return TYPE_LOCAL_KEYS[type];
}

const DEVICE_LOCAL_KEYS: Record<AdDeviceValue, string> = {
  ALL: "ads.devAll",
  DESKTOP: "ads.devDesktop",
  MOBILE: "ads.devMobile",
};

export function deviceLabelKey(device: AdDeviceValue): string {
  return DEVICE_LOCAL_KEYS[device];
}

const ISO_OR_EMPTY = z.union([z.literal(""), z.string().datetime()]);

export function adFormSchema(t?: TranslateFn) {
  return z
    .object({
      provider: z.string().trim().min(1, t?.("validation.required")).max(100),
      alias: z.string().trim().min(1, t?.("validation.required")).max(191),
      position: z.enum(AD_POSITIONS),
      type: z.enum(AD_TYPES),
      code: z
        .string()
        .min(1, t?.("validation.required"))
        .max(MAX_AD_CODE_CHARS, t?.("validation.max", { max: MAX_AD_CODE_CHARS })),
      isActive: z.boolean(),
      /** Form keeps string; server converts via Number() */
      weight: z.string().regex(/^\d{1,4}$/, t?.("validation.integer")),
      device: z.enum(AD_DEVICES),
      startAt: ISO_OR_EMPTY,
      endAt: ISO_OR_EMPTY,
    })
    .refine(
      (data) =>
        data.startAt === "" ||
        data.endAt === "" ||
        new Date(data.endAt).getTime() > new Date(data.startAt).getTime(),
      { message: t?.("validation.endAfterStart") ?? "endAfterStart", path: ["endAt"] }
    );
}
export type AdFormInput = z.infer<ReturnType<typeof adFormSchema>>;

export function adVerificationFormSchema(t?: TranslateFn) {
  return z
    .object({
      provider: z.string().trim().min(1, t?.("validation.required")).max(100),
      // meta name: safe chars only (embedded in HTML attribute, no quotes/angle brackets)
      metaName: z
        .union([z.literal(""), z.string().regex(/^[A-Za-z0-9:._-]{2,100}$/)])
        .default(""),
      metaContent: z.string().max(1024).default(""),
      // file name: goes into URL path, whitelist chars + required extension
      fileName: z
        .union([
          z.literal(""),
          z
            .string()
            .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{2,99}$/, t?.("validation.required"))
            .refine((value) => /\.[A-Za-z0-9]+$/.test(value), {
              message: t?.("validation.required") ?? "fileName",
            }),
        ])
        .default(""),
      fileContent: z.string().max(10_000).default(""),
      dnsType: z.union([z.literal(""), z.enum(["TXT", "CNAME", "MX"])]).default(""),
      dnsHost: z.string().max(255).default(""),
      dnsValue: z.string().max(2048).default(""),
      dnsNote: z.string().max(512).default(""),
      isActive: z.boolean().default(true),
    })
    .refine((data) => (data.metaName === "") === (data.metaContent.trim() === ""), {
      message: t?.("validation.required") ?? "meta",
      path: ["metaName"],
    })
    .refine((data) => (data.fileName === "") === (data.fileContent === ""), {
      message: t?.("validation.required") ?? "file",
      path: ["fileName"],
    });
}
export type AdVerificationFormInput = z.infer<ReturnType<typeof adVerificationFormSchema>>;
