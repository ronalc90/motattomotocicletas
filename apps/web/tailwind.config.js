/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "media",
  theme: {
    extend: {
      fontFamily: {
        display: ["Sora", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        ink: { DEFAULT: "#0F172A", 2: "#1E293B", 3: "#334155" },
        motor: { DEFAULT: "#F0611A", dark: "#C94C0E", soft: "#FDE9DD" },
        amber: { DEFAULT: "#F5A524", soft: "#FEF3DD" },
        surface: { DEFAULT: "#F4F5F7", card: "#FFFFFF", line: "#E4E6EB", mute: "#6B7280" },
        ok: { DEFAULT: "#15803D", soft: "#DCFCE7" },
        bad: { DEFAULT: "#B91C1C", soft: "#FEE2E2" },
      },
      borderRadius: { card: "16px", btn: "12px" },
      boxShadow: { card: "0 1px 2px rgba(15,23,42,.06), 0 0 0 1px rgba(15,23,42,.04)", float: "0 10px 30px -10px rgba(15,23,42,.35)" },
    },
  },
  plugins: [],
};
