import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import dotenv from 'dotenv';
import environment from 'vite-plugin-environment';

dotenv.config({ path: '../../.env' });

export default defineConfig({
  build: { emptyOutDir: true },
  plugins: [
    react(),
    environment("all", { prefix: "CANISTER_" }),
    environment("all", { prefix: "DFX_" }),
  ],
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
