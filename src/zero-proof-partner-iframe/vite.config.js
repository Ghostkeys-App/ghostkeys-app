// Use vite.config.js from main UI APP if needed more configuration
// Simple version

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

export default defineConfig({
  build: { emptyOutDir: true },
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4943",
        changeOrigin: true,
      },
    },
  },
  resolve: {
    dedupe: ['@dfinity/agent', '@dfinity/candid', '@dfinity/principal', '@dfinity/identity', '@dfinity/vetkeys'],
  },
});
