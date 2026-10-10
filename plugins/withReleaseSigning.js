const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Points release builds at a real upload keystore instead of the debug one.
 *
 * The generated `android/` folder is disposable — prebuild rewrites
 * app/build.gradle — so editing it by hand loses the signing config on the next
 * `expo run:android`. This re-applies it every prebuild.
 *
 * Credentials come from Gradle properties, which live in ~/.gradle/gradle.properties
 * (outside the repo), so the keystore password is never committed:
 *
 *   BIRDAPP_UPLOAD_STORE_FILE=C:/Users/you/keystores/birdapp-upload.keystore
 *   BIRDAPP_UPLOAD_STORE_PASSWORD=...
 *   BIRDAPP_UPLOAD_KEY_ALIAS=birdapp
 *   BIRDAPP_UPLOAD_KEY_PASSWORD=...
 */

const SIGNING_CONFIG = `        release {
            if (project.hasProperty('BIRDAPP_UPLOAD_STORE_FILE')) {
                storeFile file(BIRDAPP_UPLOAD_STORE_FILE)
                storePassword BIRDAPP_UPLOAD_STORE_PASSWORD
                keyAlias BIRDAPP_UPLOAD_KEY_ALIAS
                keyPassword BIRDAPP_UPLOAD_KEY_PASSWORD
            }
        }
`;

// A debug-signed AAB is rejected by Play, but only after upload — and the
// build itself succeeds silently. Fail at build time instead.
const UPLOAD_GUARD = `
// Play rejects an upload signed with the debug key. Rather than let a release
// build succeed with the wrong signature, fail loudly when credentials are absent.
tasks.configureEach { task ->
    if (task.name in ['bundleRelease', 'assembleRelease']) {
        task.doFirst {
            if (!project.hasProperty('BIRDAPP_UPLOAD_STORE_FILE')) {
                throw new GradleException("""
Release signing is not configured.
Add BIRDAPP_UPLOAD_STORE_FILE / _STORE_PASSWORD / _KEY_ALIAS / _KEY_PASSWORD
to ~/.gradle/gradle.properties. See docs/RELEASE.md.
""")
            }
        }
    }
}
`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;

    if (!gradle.includes('BIRDAPP_UPLOAD_STORE_FILE')) {
      gradle = gradle.replace(
        /(signingConfigs \{\n)/,
        `$1${SIGNING_CONFIG}`,
      );

      gradle = gradle.replace(
        /(\brelease \{\n)(\s*)\/\/ Caution![\s\S]*?signingConfig signingConfigs\.debug/,
        `$1$2signingConfig project.hasProperty('BIRDAPP_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug`,
      );

      gradle += UPLOAD_GUARD;
    }

    cfg.modResults.contents = gradle;
    return cfg;
  });
};
