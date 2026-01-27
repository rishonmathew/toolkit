import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['react', 'react-dom', 'lucide-react']
  },
  build: {
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  }
})
