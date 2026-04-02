import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aegis.intelligence',
  appName: 'Aegis Intelligence',
  webDir: 'out', // Next.js static export output folder
  server: {
    // For development: point to your local Next.js server
    // Comment this out for production builds
    url: 'http://192.168.1.X:3000', // ← Replace X with your local IP
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#050508',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'dark',           // dark text on status bar
      backgroundColor: '#050508',
    },
    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true,
    },
  },
  android: {
    allowMixedContent: true,  // needed for local dev server
    captureInput: true,
    webContentsDebuggingEnabled: true, // disable in production
  },
  ios: {
    contentInset: 'automatic',
    scrollEnabled: true,
  },
};

export default config;