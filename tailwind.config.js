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
        accent: "#E6C01F",
      },
      fontFamily: {
        heading: ["Poppins", "sans-serif"],
        body:    ["Sora",    "sans-serif"],
      },
    },
  },
  plugins: [],
};
