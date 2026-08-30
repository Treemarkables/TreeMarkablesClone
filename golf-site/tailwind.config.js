/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Deep parkland greens. 900 is the workhorse dark surface,
        // 950 the near-black for footer / high-contrast text on cream.
        fairway: {
          DEFAULT: "#1B4D35",
          950: "#0B2117",
          900: "#123527",
          800: "#17402F",
          700: "#28654A",
          600: "#3D7D5F",
          500: "#5E967B",
          400: "#8AB39E",
          300: "#B4CEC1",
          200: "#D6E5DC",
          100: "#E9F1EC",
          50: "#F3F7F4",
        },
        // Aged-scorecard card stock, warm variant for alternating bands.
        cream: {
          DEFAULT: "#FAF6EB",
          warm: "#F4EDDC",
        },
        // Trophy brass. Engraving accent, never a background wash.
        gold: {
          DEFAULT: "#C9A227",
          bright: "#DDBA45",
          deep: "#A8861D",
        },
        // Warm near-black for body text on cream.
        bark: "#2A241C",
      },
      fontFamily: {
        display: ["Young Serif", "Georgia", "Times New Roman", "serif"],
        sans: [
          "Archivo",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      letterSpacing: {
        tightish: "-0.015em",
        snug: "-0.02em",
        crunch: "-0.03em",
      },
      maxWidth: {
        prose: "68ch",
        site: "1200px",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(11,33,23,0.05), 0 8px 24px rgba(11,33,23,0.07)",
        lift: "0 2px 4px rgba(11,33,23,0.06), 0 16px 48px rgba(11,33,23,0.12)",
      },
    },
  },
  plugins: [],
};
