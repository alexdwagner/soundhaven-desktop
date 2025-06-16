import type { Config } from "tailwindcss";

export default {
  darkMode: ['class', '[data-mode="light"]'], // Force light mode
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#ffffff",
        foreground: "#171717",
      },
    },
  },
  plugins: [],
} satisfies Config;
