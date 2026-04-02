import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        lemcs: {
          "primary": "#3B82F6",
          "secondary": "#8B5CF6",
          "accent": "#10B981",
          "neutral": "#374151",
          "base-100": "#FFFFFF",
          "info": "#06B6D4",
          "success": "#10B981",
          "warning": "#F59E0B",
          "error": "#EF4444",
        },
      },
      "dark",
    ],
    defaultTheme: "lemcs",
  },
};
export default config;
