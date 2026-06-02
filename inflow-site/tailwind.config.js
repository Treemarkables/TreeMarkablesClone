/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0A0A0B",
          900: "#0A0A0B",
          800: "#16181C",
          700: "#23272F",
          600: "#3A3F47",
          500: "#5B6470",
          400: "#8B939F",
          300: "#B8BEC7",
          200: "#DDE1E7",
          100: "#EEF0F3",
          50: "#F7F8FA",
        },
        lime: {
          DEFAULT: "#C8FF3D",
          bright: "#D6FF55",
          deep: "#A8E230",
        },
        paper: "#FBFBF7",
      },
      fontFamily: {
        sans: [
          "Inter Tight",
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      letterSpacing: {
        tightish: "-0.015em",
        snug: "-0.02em",
        crunch: "-0.035em",
      },
      maxWidth: {
        prose: "62ch",
        site: "1200px",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(10,10,11,0.04), 0 8px 24px rgba(10,10,11,0.06)",
        lift: "0 2px 4px rgba(10,10,11,0.05), 0 16px 48px rgba(10,10,11,0.10)",
      },
    },
  },
  plugins: [],
};
