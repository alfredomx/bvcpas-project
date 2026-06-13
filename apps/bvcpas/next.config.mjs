/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Permitir tunnels temporales de cloudflared y la red local
  // durante desarrollo. Sin esto Next 15 bloquea hosts no listados.
  allowedDevOrigins: ['*.trycloudflare.com', '192.168.1.*', '192.168.0.*', '10.0.0.*'],
}

export default nextConfig
