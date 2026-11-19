module.exports = {
  expo: {
    name: '구르미',
    slug: 'trip-native',
    version: '1.0.0',
    orientation: 'portrait',

    // EAS Update (OTA) — JS/에셋만 바뀐 변경은 재빌드 없이 기기로 내려보낸다.
    // `eas update --branch production` 으로 올리면 앱이 다음 실행 때 받는다.
    updates: {
      url: 'https://u.expo.dev/4a815da3-118b-4cb2-ae45-e212c056ea8d',
    },
    // 네이티브 코드가 바뀌면 옛 APK가 새 JS를 못 돌리므로, 서로 맞는 것끼리만
    // 묶여야 한다. fingerprint 정책은 네이티브 의존성·설정을 해시해서 그 판단을
    // 자동으로 한다 — appVersion 정책처럼 version 문자열을 손으로 올리는 걸
    // 깜빡해서 호환 안 되는 업데이트가 깔리는 사고가 없다.
    runtimeVersion: {
      policy: 'fingerprint',
    },
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
        'expo-notifications',
        {
          // 안드로이드 알림 강조색 — 시안 메인 포인트(Soft Coral Pink)
          color: '#FF708D',
        },
      ],
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
