const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Strips permissions that library manifest-merging adds but the app never uses.
 *
 * Play asks for written justification for several of these, and unused entries
 * both widen the Data Safety declaration and cost install conversions. They are
 * re-added by `tools:node="remove"` markers rather than simply deleted, because
 * a dependency (expo-media-library, expo-dev-client) merges them back in
 * otherwise — deleting them from this file alone is not enough.
 *
 * ORDER MATTERS. @expo/config-plugins runs manifest mods in REVERSE registration
 * order — each mod runs its own action and then calls the one registered before
 * it — so this plugin must be listed FIRST in app.config.js to run LAST. Listed
 * last it runs first, and expo-media-library re-adds
 * requestLegacyExternalStorage right after it is removed.
 */
const REMOVED_PERMISSIONS = [
  // savePhotosPermission is false; nothing writes to shared storage.
  'android.permission.WRITE_EXTERNAL_STORAGE',
  // Comes from the dev-client overlay. Never used in a release build.
  'android.permission.SYSTEM_ALERT_WINDOW',
  // expo-media-library declares all three granular media types. The gallery
  // strip reads photos only — see loadGallery() in app/(tabs)/index.tsx, which
  // narrows the runtime request to match.
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.READ_MEDIA_AUDIO',
];

module.exports = function withManifestCleanup(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

    const kept = (manifest['uses-permission'] ?? []).filter(
      (p) => !REMOVED_PERMISSIONS.includes(p.$?.['android:name']),
    );

    manifest['uses-permission'] = [
      ...kept,
      ...REMOVED_PERMISSIONS.map((name) => ({
        $: { 'android:name': name, 'tools:node': 'remove' },
      })),
    ];

    // Legacy scoped-storage opt-out. Ignored from Android 11 on and a Play
    // review flag; expo-media-library sets it unconditionally.
    const application = manifest.application?.[0];
    if (application?.$) {
      delete application.$['android:requestLegacyExternalStorage'];
    }

    return cfg;
  });
};
