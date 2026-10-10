/**
 * Feature flags for things that are built but not shippable yet.
 *
 * Deliberately plain constants, not remote config: these gate UI that is
 * compiled into a release, and flipping one is a deploy either way.
 */

/**
 * Photo identification (the camera sub-button on the home screen).
 *
 * OFF for the v1 Play release. The backend proxies to iNaturalist's computer
 * vision API, which requires an authenticated token. The old setup used a
 * hand-pasted JWT that expires every 24h — it lapsed on 2026-08-31 and every
 * photo identification returned a 502 for 40 days without anyone noticing.
 *
 * scripts/birdvision_server.py now refreshes its own token via OAuth2, but
 * registering the iNaturalist OAuth application requires 10 "improving"
 * identifications on that account, which depends on other users agreeing with
 * them and so cannot be scheduled. Rather than ship a core button that fails
 * for every user, the entry point is hidden until the credentials are live.
 *
 * To re-enable: set this true, confirm GET /health on birdvision reports
 * "inat_auth": "oauth", rebuild, bump versionCode. Audio identification is
 * unaffected — BirdNET runs a local model with no external dependency.
 */
export const PHOTO_ID_ENABLED = false;
