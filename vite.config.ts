import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// App de Mozos (mobile-first). host: true para poder abrirla desde el celular en la misma red Wi-Fi o VPS.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const port = Number(env.VITE_PORT) || 3001
  const proxyTarget = env.VITE_API_PROXY_TARGET || env.VITE_API_URL || 'http://localhost:5000'

  const proxyConfig = {
    '/api': { target: proxyTarget, changeOrigin: true },
    '/hubs': { target: proxyTarget, ws: true, changeOrigin: true }
  }

  return {
    plugins: [react()],
    server: {
      port,
      host: true,
      proxy: proxyConfig
    },
    preview: {
      port,
      host: true,
      proxy: proxyConfig
    }
  }
})
