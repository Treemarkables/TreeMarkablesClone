/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Club royal blue, sampled from the Gisborne Park crest. 700 is the
        // crest colour itself; 900/950 are the dark surfaces, light steps the
        // tints for borders, chips and washes.
        club: {
          DEFAULT: "#2B3990",
          950: "#0E1233",
          900: "#1B2460",
          800: "#232E77",
          700: "#2B3990",
          600: "#3D4899",
          500: "#5560AD",
          400: "#7F87C6",
          300: "#A9AFDB",
          200: "#CDD1EB",
          100: "#E7E9F6",
          50: "#F3F4FB",
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
        // Blue-black for body text on cream.
        ink: "#1C2033",
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
        soft: "0 1px 2px rgba(14,18,51,0.05), 0 8px 24px rgba(14,18,51,0.07)",
        lift: "0 2px 4px rgba(14,18,51,0.06), 0 16px 48px rgba(14,18,51,0.12)",
      },
    },
  },
  plugins: [],
};
