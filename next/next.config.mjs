/** @type {import('next').NextConfig} */
const config = {
  agentRules: false,
  outputFileTracingIncludes: { '/*': ['./app/preview-frame.css', './community/**/*', './public/downloads/*.json'] },
  devIndicators: false,
  async redirects() {
    return [
      { source: '/blockworks', destination: '/minecraft-retro', permanent: true },
      { source: '/margin-notes', destination: '/', permanent: false },
      { source: '/index.html', destination: '/', permanent: true },
      { source: '/koi-pond.html', destination: '/koi-pond', permanent: true },
      { source: '/dark-texture.html', destination: '/dark-texture', permanent: true },
      { source: '/downloads/dark-texture.zip', destination: '/downloads/dark-texture.json', permanent: true },
    ];
  },
};

export default config;
