/** @type {import('next').NextConfig} */
const nextConfig = {
  // images: {
  //   domains: [
  //     'pbxt.replicate.delivery',
  //     'g4yqcv8qdhf169fk.public.blob.vercel-storage.com',
  //   ],
  // },
  webpack: (config, { isServer }) => {
    // Fix for pdf-parse fs issues in browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
