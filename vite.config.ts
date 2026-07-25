import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// vendor チャンクの割り当て。パッケージ名 -> チャンク名。
const VENDOR_CHUNKS: Record<string, string> = {
  react: 'react-vendor',
  'react-dom': 'react-vendor',
  scheduler: 'react-vendor', // react-dom の実行時依存。react-vendor から切り離さない
  comlink: 'worker-vendor',
  idb: 'storage-vendor',
  jszip: 'zip-vendor',
  'file-saver': 'zip-vendor'
};

// manualChunks はオブジェクト形式もサポートされていたが、vite 8 が採用する rolldown は
// 関数形式のみを受け付ける（オブジェクトを渡すと "manualChunks is not a function" で失敗）。
// 関数形式は Rollup でも有効なので、vite 7 / 8 のどちらでも同じ結果になる。
const manualChunks = (id: string): string | undefined => {
  const match = /node_modules\/(?:(@[^/]+)\/)?([^/]+)/.exec(id);
  if (!match) return undefined;
  const pkg = match[1] ? `${match[1]}/${match[2]}` : match[2];
  return pkg ? VENDOR_CHUNKS[pkg] : undefined;
};

// https://vitejs.dev/config/
export default defineConfig({
  // GitHub Pages 用のベースパス設定
  base: process.env.VITE_BASE_URL || '/',

  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'demo-images/*.jpg'],
      manifest: {
        name: 'SnapResize AI',
        short_name: 'SnapResize',
        description: 'AI-Powered Image Resizing & Background Removal Tool',
        theme_color: '#3b82f6',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: process.env.VITE_BASE_URL || '/',
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        // WASMファイルが大きいためキャッシュ上限を拡大
        maximumFileSizeToCacheInBytes: 25 * 1024 * 1024, // 25MB
        // Cache AI model
        runtimeCaching: [
          {
            // self-host フォント(woff2)はオンデマンドでキャッシュ。
            // Noto Sans JP は unicode-range で124サブセットに分割されるため、
            // 全てを precache せず実際に使われたサブセットだけ保存する。
            urlPattern: /\.woff2$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'snapresize-ai-fonts',
              expiration: {
                maxEntries: 140,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/@huggingface\/transformers/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'snapresize-ai-models',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/cdn\.huggingface\.co/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'snapresize-ai-models',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],

  // Web Worker support
  worker: {
    format: 'es',
    plugins: () => [react()]
  },

  // Build optimization
  build: {
    target: 'esnext',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    rollupOptions: {
      output: {
        manualChunks
      }
    },
    // Enable source maps for debugging
    sourcemap: false
  },

  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'zustand', 'comlink', 'idb', 'jszip', 'file-saver']
  },

  // Server configuration
  server: {
    port: 3000,
    open: true
    // CSP is disabled in dev mode for HMR to work
    // Production CSP should be configured in the hosting platform
  },

  // Preview configuration
  preview: {
    port: 4173,
    open: true
  }
});
