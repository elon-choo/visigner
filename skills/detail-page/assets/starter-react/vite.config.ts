import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Tailwind v4 is wired as a Vite plugin — no tailwind.config.js, no PostCSS. The single token source is
// src/index.css (@import 'tailwindcss' + the generated :root/@theme blocks). @vitejs/plugin-react enables
// the automatic JSX runtime + Fast Refresh so the .tsx components transpile and hot-reload.
export default defineConfig({
  plugins: [react(), tailwindcss()],
});
