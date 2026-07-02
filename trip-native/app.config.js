module.exports = {
  expo: {
    name: '구르미',
    slug: 'trip-native',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    ios: {
      supportsTablet: true,
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      },
      bundleIdentifier: 'com.gurmi.app',
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: 'com.gurmi.app',
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
        },
      },
      adaptiveIcon: {
        backgroundColor: '#E8F4FF',
        foregroundImage: './assets/android-icon-foreground.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      permissions: [
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_FINE_LOCATION',
      ],
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      '@react-native-community/datetimepicker',
      'expo-asset',
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission:
            '앱이 지도에서 현재 위치를 표시하기 위해 위치 정보를 사용합니다.',
        },
      ],
    ],
    extra: {
      eas: {
        projectId: '4a815da3-118b-4cb2-ae45-e212c056ea8d',
      },
    },
    owner: 'peachapeach',
  },
}
