import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
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
