import { defineConfig } from 'vite'
import { workflow } from 'workflow/vite'

function firebaseEnvironmentPlugin() {
  const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || '',
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN || '',
    databaseURL: process.env.VITE_FIREBASE_DATABASE_URL || process.env.FIREBASE_DATABASE_URL || '',
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID || '',
    measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID || process.env.FIREBASE_MEASUREMENT_ID || '',
  };

  const hasConfig = Object.values(firebaseConfig).some(Boolean);

  return {
    name: 'firebase-runtime-config',
    transformIndexHtml(html) {
      const tag = {
        tag: 'script',
        attrs: { id: 'firebase-runtime-config' },
        children: `window.__FIREBASE_CONFIG__ = ${JSON.stringify(firebaseConfig)};`,
        injectTo: 'head-prepend',
      };
      const meta = hasConfig
        ? {
            tag: 'meta',
            attrs: { name: 'firebase-config-source', content: 'environment' },
            injectTo: 'head-prepend',
          }
        : {
            tag: 'meta',
            attrs: { name: 'firebase-config-source', content: 'fallback' },
            injectTo: 'head-prepend',
          };
      return { html, tags: [tag, meta] };
    },
  };
}

export default defineConfig({
  plugins: [workflow(), firebaseEnvironmentPlugin()],
})
