export default {
  expo: {
    name: 'Bird League',
    slug: 'birdapp',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    scheme: 'birdapp',
    userInterfaceStyle: 'light',
    newArchEnabled: false,
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#F5EFE0',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.birdapp.app',
      infoPlist: {
        NSLocationWhenInUseUsageDescription: 'BirdApp uses your location to show nearby sightings and identify local species.',
        NSLocationAlwaysUsageDescription: 'BirdApp uses your location to show nearby sightings.',
        NSMicrophoneUsageDescription: 'BirdApp uses your microphone to record bird calls for identification.',
        NSCameraUsageDescription: 'BirdApp uses your camera to photograph birds for logging.',
        NSPhotoLibraryUsageDescription: 'BirdApp accesses your photo library to attach images to sightings.',
      },
    },
    android: {
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY,
        },
      },
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#F5EFE0',
      },
      package: 'com.birdapp.app',
      // Play rejects an upload that reuses a versionCode. Bump this on every
      // release; leaving it implicit makes prebuild regenerate 1 each time.
      versionCode: 1,
      permissions: [
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.RECORD_AUDIO',
        'android.permission.MODIFY_AUDIO_SETTINGS',
        'android.permission.CAMERA',
        'android.permission.READ_MEDIA_IMAGES',
        'android.permission.READ_EXTERNAL_STORAGE',
      ],
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
    },
    web: {
      bundler: 'metro',
      favicon: './assets/favicon.png',
    },
    plugins: [
      // Listed first deliberately: config-plugin manifest mods run in reverse
      // registration order, and this one has to run last to survive
      // expo-media-library. See plugins/withManifestCleanup.js.
      './plugins/withManifestCleanup',
      './plugins/withReleaseSigning',
      'expo-router',
      'expo-location',
      [
        'expo-notifications',
        {
          icon: './assets/icon.png',
          color: '#F5EFE0',
          androidMode: 'default',
        },
      ],
      [
        'expo-camera',
        {
          cameraPermission: 'BirdApp uses your camera to photograph birds.',
        },
      ],
      [
        'expo-av',
        {
          microphonePermission: 'BirdApp uses your microphone to record bird calls.',
        },
      ],
      [
        'expo-media-library',
        {
          photosPermission: 'BirdApp accesses your photos to select images for bird sightings.',
          savePhotosPermission: false,
          isAccessMediaLocationEnabled: false,
        },
      ],
      'expo-font',
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: '5d5c3329-7e8d-492f-8642-61914a65ba06',
      },
    },
    owner: 'eajacobson67',
  },
};
