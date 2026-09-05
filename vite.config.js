import { defineConfig } from 'vite';
import { workflow } from 'workflow/vite';

export default defineConfig({
  root: '.',
  plugins: [workflow()],
  server: {
    open: true
  }
});
