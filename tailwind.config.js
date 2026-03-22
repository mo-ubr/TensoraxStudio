/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{ts,tsx,js,jsx}",
    "./services/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./types/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        accent: "#91569c",
      },
      fontFamily: {
        heading: ["Poppins", "sans-serif"],
        body:    ["Sora",    "sans-serif"],
      },
    },
  },
  plugins: [],
};
