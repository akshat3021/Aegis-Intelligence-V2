/** @type {import('next').NextConfig} */
const nextConfig = {
  // !! IMPORTANT !!
  // Do NOT add output: 'export' here - that breaks all /api routes on Vercel.
  // Only add output: 'export' temporarily when building the Android APK.
  
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;