import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

// 颜色一律指向 globals.css 里的 CSS 变量：主题切换只翻转变量，不产生双份类名
const config: Config = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--bg)",
        foreground: "var(--text-1)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        "surface-3": "var(--surface-3)",
        card: { DEFAULT: "var(--surface)", foreground: "var(--text-1)" },
        popover: { DEFAULT: "var(--surface-2)", foreground: "var(--text-1)" },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
          hover: "var(--primary-hover)",
        },
        secondary: { DEFAULT: "var(--surface-2)", foreground: "var(--text-1)" },
        muted: { DEFAULT: "var(--surface-2)", foreground: "var(--text-2)" },
        faint: "var(--text-3)",
        accent: { DEFAULT: "var(--surface-2)", foreground: "var(--text-1)" },
        destructive: { DEFAULT: "var(--danger)", foreground: "#ffffff" },
        success: "var(--success)",
        warning: "var(--warning)",
        border: "var(--border)",
        input: "var(--border)",
        ring: "var(--ring)",
        "gradient-from": "var(--accent-from)",
        "gradient-to": "var(--accent-to)",
      },
      backgroundImage: {
        // 渐变唯一来源：CTA / 焦点环 / 悬停微光 / Logo 字标之外禁止使用
        "accent-gradient": "linear-gradient(135deg, var(--accent-from), var(--accent-to))",
      },
      borderRadius: {
        // Values come from CSS vars so admin-defined appearance can override them
        card: "var(--radius-card, 16px)",
        control: "var(--radius-control, 10px)",
      },
      boxShadow: {
        "card-hover": "var(--shadow-hover)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Inter", "system-ui", "sans-serif"],
      },
      transitionDuration: {
        // 设计 token：duration-base
        "250": "250ms",
      },
    },
  },
  plugins: [animate],
};

export default config;
