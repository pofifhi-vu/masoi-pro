/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: "#0f0c1b",
        cardBg: "#181329",
        cardBorder: "#2d2447",
        accentPurple: "#635bff",
        accentPink: "#d946ef",
        villagerBlue: "#3b82f6",
        werewolfRed: "#ef4444",
        neutralYellow: "#f59e0b"
      }
    },
  },
  plugins: [],
}
