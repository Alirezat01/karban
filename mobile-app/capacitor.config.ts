/**
 * Capacitor Configuration for Karban Android (APK/AAB) & iOS (IPA) Native Builds
 *
 * How to build native Android & iOS apps from this project:
 * 1. npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios @capacitor/app capacitor-native-biometric
 * 2. npm run build
 * 3. npx cap add android && npx cap add ios
 * 4. npx cap sync
 * 5. npx cap open android   (Builds APK / AAB in Android Studio for CafeBazaar, Myket, Google Play)
 * 6. npx cap open ios       (Builds IPA in Xcode for SibApp, Anardoni, App Store)
 *
 * Native Biometric Permissions:
 * - iOS (Info.plist): NSFaceIDUsageDescription = "ورود امن به خزانه‌داری و اسناد مالی کاربان با تشخیص چهره (FaceID)"
 * - Android (AndroidManifest.xml): <uses-permission android:name="android.permission.USE_BIOMETRIC" />
 */

export interface CapacitorConfig {
  appId: string;
  appName: string;
  webDir: string;
  bundledWebRuntime?: boolean;
  server?: {
    androidScheme?: string;
    iosScheme?: string;
    cleartext?: boolean;
  };
  plugins?: Record<string, unknown>;
}

const config: CapacitorConfig = {
  appId: 'ir.karbanapp.mobile',
  appName: 'کاربان | Karban',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'capacitor',
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1800,
      backgroundColor: '#070B14',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#070B14',
    },
    Keyboard: {
      resize: 'body',
      style: 'DARK',
    },
    NativeBiometric: {
      iosBiometryReason: 'ورود امن به خزانه‌داری و اسناد مالی کاربان با تشخیص چهره (FaceID)',
      androidBiometricTitle: 'احراز هویت بیومتریک کاربان',
      androidBiometricSubtitle: 'اثر انگشت یا تشخیص چهره',
    },
  },
};

export default config;
