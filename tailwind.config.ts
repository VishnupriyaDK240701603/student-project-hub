import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        indigo: {
          50: "#eff8f2",
          100: "#dcefe2",
          200: "#bee0ca",
          300: "#94caaa",
          400: "#66ad82",
          500: "#42915f",
          600: "#31754b",
          700: "#285d3d",
          800: "#234b34",
          900: "#1d3d2b",
          950: "#0e2418",
        },
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        primary: {
          DEFAULT: "var(--primary)",
          hover: "var(--primary-hover)",
          foreground: "var(--primary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        brand: {
          dark: "#0a2215",
          darker: "#06180e",
          forest: "#0d2b1b",
          sidebar: "#0b2417",
          active: "#1b4332",
          surface: "#f4f7f5",
          border: "#e3eae5",
          primary: "#143d28",
          hover: "#1e5338",
          accent: "#2d6a4f",
          mint: "#d8f3dc",
          sage: "#e8f1ec",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
          50: "#eff8f2",
          100: "#dcefe2",
          200: "#bee0ca",
          300: "#94caaa",
          400: "#66ad82",
          500: "#42915f",
          600: "#31754b",
          700: "#285d3d",
          800: "#234b34",
          900: "#1d3d2b",
          950: "#0e2418",
        },
      },
      borderRadius: {
        sm: "0.375rem",
        md: "0.625rem",
        lg: "1rem",
        xl: "1.25rem",
        "2xl": "1.5rem",
        "3xl": "1.75rem",
      },
    },
  },
  plugins: [],
};
export default config;
