import type { ExpoConfig } from 'expo/config';
import version from './app-version.json';
const config: ExpoConfig = {
  name: 'Мій гараж',
  slug: 'my-garage',
  scheme: 'mygarage',
  version: version.versionName,
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  icon: './assets/icon.png',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.mygarage.mobile.garage',
    buildNumber: version.iosBuildNumber,
    config: { usesNonExemptEncryption: false },
    infoPlist: {
      CFBundleLocalizations: ['uk', 'en'],
      CFBundleDevelopmentRegion: 'uk',
      NSBluetoothAlwaysUsageDescription:
        'Мій гараж використовує Bluetooth для підключення до OBD-II адаптера вашого автомобіля.',
    },
  },
  android: {
    package: 'com.mygarage.mobile',
    versionCode: version.androidVersionCode,
    edgeToEdgeEnabled: true,
    adaptiveIcon: { foregroundImage: './assets/icon.png', backgroundColor: '#173E46' },
    blockedPermissions: [
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VIDEO',
      'android.permission.RECORD_AUDIO',
    ],
    permissions: [
      'android.permission.BLUETOOTH',
      'android.permission.BLUETOOTH_ADMIN',
      'android.permission.BLUETOOTH_SCAN',
      'android.permission.BLUETOOTH_CONNECT',
      'android.permission.ACCESS_FINE_LOCATION',
    ],
  },
  locales: { uk: './locales/uk.json', en: './locales/en.json' },
  web: { bundler: 'metro', output: 'single', favicon: './assets/icon.png' },
  plugins: [
    ['expo-router', { root: './app' }],
    ['expo-localization', { supportedLocales: ['uk', 'en'] }],
    'expo-secure-store',
    'expo-notifications',
    [
      'expo-image-picker',
      {
        photosPermission: 'Оберіть фото автомобіля чи чека для приватного гаража.',
        cameraPermission: 'Зробіть фото автомобіля або чека.',
        microphonePermission: false,
      },
    ],
    [
      'expo-splash-screen',
      { backgroundColor: '#173E46', image: './assets/icon.png', imageWidth: 100 },
    ],
    ['expo-build-properties', { ios: { deploymentTarget: '15.1' } }],
    './plugins/with-ios-minimum-pod-target',
    './plugins/with-versioned-android-release',
    './plugins/with-localized-name',
  ],
  experiments: { typedRoutes: true },
  extra: {
    eas: { projectId: '197a6135-fd34-4ba6-b39a-c30e889118cf' },
  },
};
export default config;
