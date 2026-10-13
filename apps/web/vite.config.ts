import { paraglideVitePlugin } from '@inlang/paraglide-js'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    // In development the API runs in `wrangler dev`; in production both share one origin.
    proxy: { '/api': 'http://localhost:8787' },
  },
  plugins: [
    // Compiler options live in project.inlang/paraglide.config.js.
    paraglideVitePlugin({ project: './project.inlang' }),
    tailwindcss(),
    tanstackStart({
      spa: {
        enabled: true,
        prerender: {
          // Emit the shell as index.html so any static host (and later the Capacitor
          // native shell) can serve it without extra configuration.
          outputPath: '/index.html',
        },
      },
    }),
    react(),
  ],
})
