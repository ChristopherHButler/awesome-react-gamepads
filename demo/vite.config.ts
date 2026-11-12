import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: process.env.LOCAL_LIB ? {
      'awesome-react-gamepads': path.resolve(__dirname, '../src/index.ts'),
    } : {},
  },
});
