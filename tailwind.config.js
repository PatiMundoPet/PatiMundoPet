/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './assets/js/main.js'],
  theme: {
    extend: {
      colors: {
        moss: {
          50: '#eef1ec', 100: '#dbe3d6', 300: '#8fa583', 600: '#3c5443',
          700: '#2a3d31', 800: '#1e2b22', 900: '#161f1a', 950: '#10160f',
        },
        stone: { 50: '#f8f4ea', 100: '#efe6d2', 200: '#e4d7bb' },
        brass: { 300: '#dcc48f', 400: '#c7a565', 500: '#ad8a4e', 600: '#8f7040', 700: '#6b5530' },
        cognac: { 500: '#8a5535', 600: '#6b4028' },
        ink: { 700: '#4a4033', 900: '#1d1912' },
      },
      fontFamily: {
        display: ['Fraunces', 'serif'],
        body: ['Karla', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 20px 60px -15px rgba(16,22,15,0.25)',
      },
    },
  },
};
