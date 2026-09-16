import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // JSX'i otomatik runtime ile derle (React'i her dosyada import etmeye gerek yok).
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    globals: false,
    // .tsx de dahil: bileşen "ekranda ne yazıyor" testleri JSX kullanıyor
    // (tests/sifremi-unuttum-ekran.test.tsx).
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
