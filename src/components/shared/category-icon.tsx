import {
  BookOpen,
  Code,
  Folder,
  GraduationCap,
  Images,
  Layers,
  Lightbulb,
  Music,
  Palette,
  Rocket,
  Sparkles,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

// icon is a user-editable DB string; never use for dynamic imports — unknown values fall back to Folder
const ICON_MAP: Record<string, LucideIcon> = {
  palette: Palette,
  code: Code,
  sparkles: Sparkles,
  "graduation-cap": GraduationCap,
  images: Images,
  zap: Zap,
  "book-open": BookOpen,
  lightbulb: Lightbulb,
  rocket: Rocket,
  wrench: Wrench,
  layers: Layers,
  music: Music,
  folder: Folder,
};

export const CATEGORY_ICON_NAMES = Object.keys(ICON_MAP);

export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name] ?? Folder;
  return <Icon className={className} aria-hidden="true" />;
}
