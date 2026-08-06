/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        terracotta: {
          DEFAULT: '#C46A3D',
          50: '#FCF5F1',
          100: '#F7E7DE',
          200: '#EFCFBD',
          300: '#E4B297',
          400: '#D99671',
          500: '#C46A3D',
          600: '#A95830',
          700: '#8A4523',
          800: '#6C3318',
          900: '#4D210C',
        },
        warmbeige: {
          50: '#FDFBF7',
          100: '#F9F6F0',
          200: '#F3EDE2',
          300: '#E8DEC9',
          400: '#DCBFAF',
          500: '#C29F8A',
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'premium': '0 10px 40px -10px rgba(0, 0, 0, 0.04)',
        'premium-hover': '0 20px 50px -10px rgba(196, 106, 61, 0.08)',
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.04)',
      }
    },
  },
  plugins: [],
}
