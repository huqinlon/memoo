import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          editor: ['@tiptap/react', '@tiptap/starter-kit', '@tiptap/extension-image', '@tiptap/extension-link', '@tiptap/extension-placeholder', '@tiptap/extension-table', '@tiptap/extension-table-row', '@tiptap/extension-table-cell', '@tiptap/extension-table-header'],
          markdown: ['react-markdown', 'remark-gfm', 'rehype-highlight'],
          pdf: ['html2pdf.js', 'pdfjs-dist'],
        }
      }
    }
  }
})