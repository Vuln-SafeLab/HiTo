"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Copy, ExternalLink, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { isOptimizableImage, shimmerDataUrl } from "@/lib/image";
import type { PublicCard } from "@/lib/public-types";
import { Highlight } from "./highlight";
import { copyCardLink, trackCardClick } from "./track";

const SPRING = { type: "spring", stiffness: 300, damping: 30 } as const;

interface CardItemProps {
  card: PublicCard;
  query: string;
  /** Entry delay (seconds): parent computes from index and clamps; avoids long-list lag */
  delay: number;
  onOpen: (card: PublicCard) => void;
}

export function CardItem({ card, query, delay, onOpen }: CardItemProps) {
  const t = useTranslations();
  const reduceMotion = useReducedMotion();
  const [faviconError, setFaviconError] = useState(false);

  const showFavicon = card.favicon !== null && !faviconError;

  return (
    <motion.article
      initial={reduceMotion === true ? { opacity: 0 } : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0, transition: { ...SPRING, delay } }}
      whileHover={reduceMotion === true ? undefined : { y: -6 }}
      transition={SPRING}
      className="card-glow group relative flex flex-col overflow-hidden rounded-card border border-border bg-card transition-shadow duration-250 hover:shadow-card-hover"
    >
      <button
        type="button"
        onClick={() => onOpen(card)}
        aria-label={card.title}
        className="absolute inset-0 z-[1] rounded-card focus-visible:outline-none"
      />

      <div className="relative aspect-[16/10] overflow-hidden bg-surface-2">
        {card.image !== null ? (
          <Image
            src={card.image}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 20vw"
            placeholder="blur"
            blurDataURL={shimmerDataUrl(800, 500)}
            unoptimized={!isOptimizableImage(card.image)}
            className="object-cover transition-transform duration-250 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
            <div
              className="absolute inset-0 opacity-[0.12]"
              style={{ backgroundImage: "linear-gradient(135deg, var(--accent-from), var(--accent-to))" }}
              aria-hidden="true"
            />
            <div
              className="absolute inset-0 opacity-[0.07]"
              aria-hidden="true"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 1px 1px, var(--text-1) 1px, transparent 0)",
                backgroundSize: "14px 14px",
              }}
            />
            <span className="relative bg-accent-gradient bg-clip-text text-4xl font-semibold tracking-tight text-transparent">
              {card.title.slice(0, 2)}
            </span>
          </div>
        )}

        {card.featured && (
          <Badge className="absolute left-3 top-3 z-[2] gap-1 bg-black/50 text-white backdrop-blur-sm">
            <Star className="size-3 fill-current" aria-hidden="true" />
            {t("home.featured")}
          </Badge>
        )}

        <div className="absolute right-3 top-3 z-[2] flex gap-1.5 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100">
          <a
            href={card.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            onClick={(event) => {
              event.stopPropagation();
              trackCardClick(card.id);
            }}
            aria-label={t("home.visit")}
            title={t("home.visit")}
            className="flex size-8 items-center justify-center rounded-control bg-black/50 text-white backdrop-blur-sm transition-colors duration-150 hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
          <button
            type="button"
            onClick={() =>
              void copyCardLink(card.url, t("home.linkCopied"), t("errors.generic"))
            }
            aria-label={t("home.copyLink")}
            title={t("home.copyLink")}
            className="flex size-8 items-center justify-center rounded-control bg-black/50 text-white backdrop-blur-sm transition-colors duration-150 hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Copy className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-2.5">
          {showFavicon ? (
            <Image
              src={card.favicon ?? ""}
              alt=""
              width={20}
              height={20}
              unoptimized
              onError={() => setFaviconError(true)}
              className="size-5 shrink-0 rounded"
            />
          ) : (
            <span className="flex size-5 shrink-0 items-center justify-center rounded bg-surface-2 text-[10px] font-semibold text-muted-foreground">
              {card.title.charAt(0).toUpperCase()}
            </span>
          )}
          <h3 className="truncate text-[15px] font-medium leading-snug">
            <Highlight text={card.title} query={query} />
          </h3>
        </div>

        {card.description !== null && (
          <p className="line-clamp-2 text-[13.5px] leading-relaxed text-muted-foreground">
            <Highlight text={card.description} query={query} />
          </p>
        )}

        {card.tags.length > 0 && (
          <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
            {card.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-faint"
              >
                <Highlight text={tag} query={query} />
              </span>
            ))}
            {card.clickCount > 0 && (
              <span className="ms-auto flex items-center gap-1 text-[11px] tabular-nums text-faint">
                {card.clickCount.toLocaleString()}
              </span>
            )}
          </div>
        )}
      </div>
    </motion.article>
  );
}
