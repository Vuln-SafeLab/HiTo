"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Copy, ExternalLink, MousePointerClick, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { isOptimizableImage, shimmerDataUrl } from "@/lib/image";
import { cn } from "@/lib/utils";
import type { PublicCard } from "@/lib/public-types";
import { copyCardLink, trackCardClick } from "./track";

const SPRING = { type: "spring", stiffness: 300, damping: 30 } as const;

interface CardModalProps {
  card: PublicCard | null;
  categoryName: string | null;
  onClose: () => void;
}

export function CardModal({ card, categoryName, onClose }: CardModalProps) {
  const t = useTranslations();
  const reduceMotion = useReducedMotion();

  return (
    <DialogPrimitive.Root
      open={card !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AnimatePresence>
        {card !== null && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                style={{ x: "-50%", y: "-50%" }}
                initial={reduceMotion === true ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduceMotion === true ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                transition={SPRING}
                className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-lg flex-col overflow-hidden rounded-card border border-border bg-card shadow-lg focus-visible:outline-none"
              >
                {card.image !== null && (
                  <div className="relative aspect-[16/9] shrink-0 overflow-hidden bg-surface-2">
                    <Image
                      src={card.image}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 100vw, 512px"
                      placeholder="blur"
                      blurDataURL={shimmerDataUrl(800, 450)}
                      unoptimized={!isOptimizableImage(card.image)}
                      className="object-cover"
                    />
                  </div>
                )}

                <div className="flex flex-col gap-4 overflow-y-auto p-6">
                  <div className="flex items-start justify-between gap-4">
                    <DialogPrimitive.Title className="text-xl font-semibold leading-tight tracking-tight">
                      {card.title}
                    </DialogPrimitive.Title>
                    <DialogPrimitive.Close
                      aria-label={t("common.close")}
                      className="shrink-0 rounded-control p-1.5 text-faint transition-colors duration-150 hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <X className="size-4" aria-hidden="true" />
                    </DialogPrimitive.Close>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {categoryName !== null && <Badge variant="outline">{categoryName}</Badge>}
                    <span className="inline-flex items-center gap-1">
                      <MousePointerClick className="size-3.5" aria-hidden="true" />
                      {t("home.clicks", { count: card.clickCount })}
                    </span>
                  </div>

                  {card.description !== null && (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {card.description}
                    </p>
                  )}

                  {card.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {card.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-1 flex flex-wrap gap-3">
                    <a
                      href={card.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      onClick={() => trackCardClick(card.id)}
                      className={cn(buttonVariants({ variant: "gradient" }))}
                    >
                      <ExternalLink className="size-4" aria-hidden="true" />
                      {t("home.visit")}
                    </a>
                    <button
                      type="button"
                      onClick={() =>
                        void copyCardLink(card.url, t("home.linkCopied"), t("errors.generic"))
                      }
                      className={cn(buttonVariants({ variant: "outline" }))}
                    >
                      <Copy className="size-4" aria-hidden="true" />
                      {t("home.copyLink")}
                    </button>
                  </div>
                </div>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
