/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        pageBg: "#ECEBF3",
        dark: "#14121F",
        muted: "#6B6880",
        violetPrimary: "#5B3DF5",
        limePrimary: "#D7F25C",
        orangePrimary: "#FF7A45",
        salmonLight: "#FFB59B",
        salmon: "#FF9F7A",
        softGrey: "#F6F6FA",
        dividerColor: "#EEF0F5",
        liveGreen: "#22C55E",
        darkGreen: "#2F6B0F",
        badgeGreenBg: "#E5F8D0",
        darkCardInner: "#2A2740",
      },
      borderRadius: {
        'card': '28px',
        'pill': '9999px',
      },
      fontFamily: {
        cairo: ['Cairo', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
