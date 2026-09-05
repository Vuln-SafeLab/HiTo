"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Inbox, SearchX, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { LocaleSwitcher } from "@/components/shared/locale-switcher";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { SocialIcon } from "@/components/shared/social-icons";
import type { ActiveAnnouncement } from "@/lib/announcements-shared";
import { isOptimizableImage } from "@/lib/image";
import type { PublicCard, PublicCategory } from "@/lib/public-types";
import type { SocialLink } from "@/lib/socials";
import type { HeroStyle } from "@/lib/appearance-shared";
import { AnnouncementBanner } from "./announcement-banner";
import { CardItem } from "./card-item";
import { CardModal } from "./card-modal";
import { CategoryTabs } from "./category-tabs";
import { SearchBar } from "./search-bar";
import { SortSwitch, type SortMode } from "./sort-switch";

const DEBOUNCE_MS = 300;

interface HomeViewProps {
  siteName: string;
  logo: string | null;
  announcement: ActiveAnnouncement | null;
  socials: SocialLink[];
  categories: PublicCategory[];
  cards: PublicCard[];
  /** Initial search term from SearchAction (/?q=) */
  initialQuery?: string;
  /** Admin-defined hero background style */
  heroStyle: HeroStyle;
  /** Ad slot (server AdSlot node; null when no ad, no DOM footprint) */
  headerAd?: React.ReactNode;
  inlineAd?: React.ReactNode;
  footerAd?: React.ReactNode;
  /** Content-area top/bottom slots and the right-hand sidebar (xl screens only) */
  articleTopAd?: React.ReactNode;
  articleBottomAd?: React.ReactNode;
  sidebarAd?: React.ReactNode;
}

export function HomeView({
  siteName,
  logo,
  announcement,
  socials,
  categories,
  cards,
  initialQuery = "",
  heroStyle,
  headerAd = null,
  inlineAd = null,
  footerAd = null,
  articleTopAd = null,
  articleBottomAd = null,
  sidebarAd = null,
}: HomeViewProps) {
  const t = useTranslations();
  const locale = useLocale();
  const reduceMotion = useReducedMotion();

  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>("latest");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Input echoes immediately; filtering runs after 300ms debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  // First mount keeps base stagger delay; subsequent filter/sort reshuffles skip it
  const isFirstMount = useRef(true);
  useEffect(() => {
    isFirstMount.current = false;
  }, []);

  const filtered = useMemo(() => {
    const keyword = debouncedQuery.trim().toLowerCase();
    return cards.filter((card) => {
      if (activeCategory !== null && card.categoryId !== activeCategory) return false;
      if (keyword === "") return true;
      return (
        card.title.toLowerCase().includes(keyword) ||
        (card.description ?? "").toLowerCase().includes(keyword) ||
        card.tags.some((tag) => tag.toLowerCase().includes(keyword))
      );
    });
  }, [cards, activeCategory, debouncedQuery]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    switch (sort) {
      case "latest":
        list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        break;
      case "featured":
        list.sort((a, b) => Number(b.featured) - Number(a.featured));
        break;
      case "alpha":
        list.sort((a, b) => a.title.localeCompare(b.title, locale));
        break;
    }
    return list;
  }, [filtered, sort, locale]);

  const selectedCard = useMemo(
    () => cards.find((card) => card.id === selectedId) ?? null,
    [cards, selectedId]
  );
  const selectedCategoryName = useMemo(() => {
    if (selectedCard === null) return null;
    return categories.find((category) => category.id === selectedCard.categoryId)?.name ?? null;
  }, [categories, selectedCard]);

  const stats = useMemo(
    () => [
      { value: cards.length, label: t("home.statsTools") },
      { value: categories.length, label: t("home.statsCategories") },
      {
        value: cards.reduce((sum, card) => sum + card.clickCount, 0),
        label: t("home.statsVisits"),
      },
    ],
    [cards, categories, t]
  );

  // Key change triggers full grid exit + staggered re-entrance on sort/filter
  const gridKey = `${activeCategory ?? "all"}|${sort}|${debouncedQuery.trim().toLowerCase()}`;
  const baseDelay = isFirstMount.current ? 0.35 : 0;

  const heroChild = {
    hidden: reduceMotion === true ? { opacity: 0 } : { opacity: 0, y: 16 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: [0.2, 0.8, 0.2, 1] as const },
    },
  };

  return (
    <div className="flex min-h-screen flex-col">
      <AnnouncementBanner announcement={announcement} />

      <header className="sticky top-0 z-40 border-b border-border bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            {logo !== null && (
              <Image
                src={logo}
                alt=""
                width={28}
                height={28}
                unoptimized={!isOptimizableImage(logo)}
                className="size-7 rounded"
              />
            )}
            <span className="bg-accent-gradient bg-clip-text text-lg font-semibold tracking-tight text-transparent">
              {siteName}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6">
        {/* ── Hero ── */}
        <motion.section
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
          initial="hidden"
          animate="show"
          data-hero={heroStyle}
          className="relative flex flex-col items-center gap-6 pb-14 pt-20 text-center sm:pt-28"
        >
          <div className="hero-bg" aria-hidden="true">
            {heroStyle === "aurora" && (
              <>
                <div className="hero-aurora-blob" />
                <div className="hero-aurora-blob" />
                <div className="hero-aurora-blob" />
              </>
            )}
            {heroStyle === "grid" && (
              <>
                <div className="hero-grid-lines" />
                <div className="hero-grid-glow" />
              </>
            )}
            {heroStyle !== "minimal" && <div className="hero-noise" />}
          </div>

          <motion.span
            variants={heroChild}
            className="relative z-[1] inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur"
          >
            <Sparkles className="size-3.5 text-accent-from" aria-hidden="true" />
            {t("common.tagline")}
          </motion.span>

          <motion.h1
            variants={heroChild}
            className="relative z-[1] max-w-3xl text-balance text-[clamp(44px,6.5vw,76px)] font-semibold leading-[1.06] tracking-[-0.035em]"
          >
            {t("home.heroTitle")}{" "}
            <span className="bg-accent-gradient bg-clip-text text-transparent">
              {t("home.heroAccent")}
            </span>
          </motion.h1>
          <motion.p
            variants={heroChild}
            className="relative z-[1] max-w-xl text-pretty text-base text-muted-foreground sm:text-lg"
          >
            {t("home.heroSubtitle")}
          </motion.p>
          <motion.div variants={heroChild} className="relative z-[1] w-full max-w-xl">
            <SearchBar value={query} onChange={setQuery} />
          </motion.div>

          <motion.dl
            variants={heroChild}
            className="relative z-[1] mt-2 flex flex-wrap items-center justify-center gap-x-8 gap-y-3"
          >
            {stats.map((stat) => (
              <div key={stat.label} className="flex flex-col items-center gap-0.5">
                <dd className="bg-accent-gradient bg-clip-text text-2xl font-semibold tabular-nums text-transparent">
                  {stat.value.toLocaleString(locale)}
                </dd>
                <dt className="text-xs text-faint">{stat.label}</dt>
              </div>
            ))}
          </motion.dl>
        </motion.section>

        {headerAd}

        <div className="flex flex-col gap-4 pb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <CategoryTabs
                categories={categories}
                active={activeCategory}
                onChange={setActiveCategory}
              />
            </div>
            <SortSwitch value={sort} onChange={setSort} />
          </div>
          {inlineAd}
        </div>

        {articleTopAd}

        <div className="flex flex-col gap-6 xl:flex-row">
          <section className="min-w-0 flex-1 pb-20" aria-live="polite">
          {cards.length === 0 ? (
            <EmptyState icon={Inbox} title={t("home.emptyTitle")} body={t("home.emptyBody")} />
          ) : sorted.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title={t("home.noResultsTitle", { query: debouncedQuery.trim() })}
              body={t("home.noResultsBody")}
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setQuery("");
                    setActiveCategory(null);
                  }}
                >
                  {t("home.clearFilters")}
                </Button>
              }
            />
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={gridKey}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
              >
                {sorted.map((card, index) => (
                  <CardItem
                    key={card.id}
                    card={card}
                    query={debouncedQuery}
                    delay={baseDelay + Math.min(index * 0.04, 0.4)}
                    onOpen={(opened) => setSelectedId(opened.id)}
                  />
                ))}
              </motion.div>
            </AnimatePresence>
          )}
          </section>
          {sidebarAd != null && (
            <aside className="w-full shrink-0 xl:w-64">{sidebarAd}</aside>
          )}
        </div>

        {articleBottomAd}
      </main>

      <footer className="mt-auto">
        <div className="footer-hairline" aria-hidden="true" />
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-5 px-4 py-10 sm:px-6">
          {footerAd}
          {socials.length > 0 && (
            <nav aria-label={t("home.followUs")} className="flex flex-wrap items-center justify-center gap-2.5">
              {socials.map((link) => (
                <a
                  key={`${link.platform}-${link.url}`}
                  href={link.url}
                  target={link.url.startsWith("mailto:") ? undefined : "_blank"}
                  rel="noopener noreferrer nofollow"
                  aria-label={link.platform}
                  title={link.platform}
                  className="flex size-10 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground transition-all duration-150 hover:-translate-y-0.5 hover:border-ring hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <SocialIcon platform={link.platform} className="size-4" />
                </a>
              ))}
            </nav>
          )}
          <div className="flex w-full flex-col items-center gap-1.5 text-xs text-faint">
            <span className="bg-accent-gradient bg-clip-text font-semibold text-transparent">
              {siteName}
            </span>
            <span>{t("common.tagline")}</span>
          </div>
        </div>
      </footer>

      <CardModal
        card={selectedCard}
        categoryName={selectedCategoryName}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
