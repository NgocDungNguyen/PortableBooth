import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/** One self-contained HTML file (fonts inlined) for quick previews. No CSP meta: hosts differ. */
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  build: {
    target: 'es2022',
    outDir: 'dist-preview',
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
  },
});
