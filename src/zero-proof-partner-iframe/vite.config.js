import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

export default defineConfig({
  define: {
    'import.meta.env.DFX_NETWORK': JSON.stringify(process.env.DFX_NETWORK || ''),
    'import.meta.env.CANISTER_ID_ZERO_PROOF_VAULT_FRONTEND': JSON.stringify(process.env.CANISTER_ID_ZERO_PROOF_VAULT_FRONTEND || ''),
  },
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
