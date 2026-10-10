/**
 * Single source of truth for the privacy policy and the account-deletion notice.
 *
 * Play requires both to exist at a public URL *and* to be reachable inside the
 * app. `npm run legal:html` regenerates docs/ from this file so the hosted copy
 * cannot drift from the one users read on their phone.
 */

export const LEGAL_CONTACT_EMAIL = 'eajacobson67@gmail.com';
export const LEGAL_EFFECTIVE_DATE = 'September 8, 2026';
export const APP_NAME = 'Bird League';

export interface LegalSection {
  heading: string;
  body: string[];
  bullets?: string[];
}

export const PRIVACY_POLICY: LegalSection[] = [
  {
    heading: 'What this policy covers',
    body: [
      `${APP_NAME} is a social app for logging bird sightings. This policy explains what the app collects, why, where it goes, and how to get rid of it. It applies to the Android app and the backend services it talks to.`,
    ],
  },
  {
    heading: 'Information you give us',
    body: ['Creating an account and using the app stores the following:'],
    bullets: [
      'Account details — your email address, username, display name, and optional bio. Passwords are handled by Firebase Authentication and are never visible to us.',
      'Sightings — the species you log, the precise GPS coordinates of the sighting, a place name, state and country, the time, and any notes you add.',
      'Photos and audio — pictures you attach to a sighting and recordings you make for identification.',
      'Social activity — friend connections, league memberships, and league scores.',
    ],
  },
  {
    heading: 'Device permissions',
    body: ['The app asks for these permissions, and only uses them for the stated purpose:'],
    bullets: [
      'Location — to place a sighting on the map and to narrow identification to species plausible for that place and date. Collected only at the moment you log a sighting.',
      'Camera — to photograph a bird for a sighting.',
      'Microphone — to record a call for identification.',
      'Photos — to let you pick an existing picture. The app reads your gallery to show recent thumbnails; nothing is uploaded until you attach it to a sighting.',
      'Notifications — to tell you about friend requests and league activity. Optional.',
    ],
  },
  {
    heading: 'What is public',
    body: [
      'Sightings are public by default. A public sighting — including its species, coordinates, photo, and time — is visible on the map, in the feed, and on leaderboards to anyone signed in to the app. Your username, display name, bio, avatar, and totals are also visible to other signed-in users.',
      'If a sighting is somewhere you would rather not disclose, such as your home, do not log it as public.',
    ],
  },
  {
    heading: 'Where your data goes',
    body: ['The app uses Google Firebase (Authentication, Cloud Firestore, Cloud Storage) to store data, and Google Cloud Run to host the two identification services we operate.'],
    bullets: [
      'Audio you record is uploaded to our storage and sent to our identification service, which runs the BirdNET model, along with the coordinates and date so it can weight the result by region and season.',
      'Photos you submit for identification are sent to our image identification service with the same coordinates and date.',
      'Google Maps renders the map screen. Map interactions are subject to Google\u2019s own privacy policy.',
      'We do not sell your data, and we do not share it with advertisers or data brokers.',
    ],
  },
  {
    heading: 'How long we keep it',
    body: [
      'Sightings, photos, and audio are kept until you delete them or delete your account. Account records are kept for as long as the account exists.',
    ],
  },
  {
    heading: 'Deleting your account',
    body: [
      'You can delete your account from inside the app: Profile, then Delete account. You will be asked for your password to confirm.',
      'Deleting removes your profile, every sighting you logged, the photos and recordings attached to them, your friend connections, your league memberships and scores, and your notification tokens. It cannot be undone.',
      `You can also request deletion by emailing ${LEGAL_CONTACT_EMAIL} from the address on the account. Requests are handled within 30 days.`,
      'Leagues you created are not deleted, because they hold other players\u2019 scores. Your membership and your own scoring rows are removed from them.',
    ],
  },
  {
    heading: 'Children',
    body: [
      `${APP_NAME} is not directed at children under 13, and we do not knowingly collect information from them. If you believe a child has created an account, email ${LEGAL_CONTACT_EMAIL} and we will remove it.`,
    ],
  },
  {
    heading: 'Security',
    body: [
      'Data is transmitted over HTTPS and stored in Firebase with server-side security rules that restrict each record to the accounts allowed to read or write it. No system is perfectly secure, and we cannot guarantee absolute security.',
    ],
  },
  {
    heading: 'Changes',
    body: [
      'If this policy changes materially we will update the effective date above and note the change in the app.',
    ],
  },
  {
    heading: 'Contact',
    body: [`Questions about this policy: ${LEGAL_CONTACT_EMAIL}.`],
  },
];

export const DELETION_NOTICE: LegalSection[] = [
  {
    heading: 'Deleting your Bird League account',
    body: ['There are two ways to delete your account and its data.'],
  },
  {
    heading: 'In the app',
    body: ['Open Bird League, go to the Profile tab, scroll to the bottom, and tap Delete account. Confirm with your password. Deletion is immediate and cannot be undone.'],
  },
  {
    heading: 'By email',
    body: [
      `Email ${LEGAL_CONTACT_EMAIL} from the address on your account with the subject "Delete my account". We will confirm and complete the deletion within 30 days.`,
    ],
  },
  {
    heading: 'What is deleted',
    body: ['Deleting an account permanently removes:'],
    bullets: [
      'Your profile — email, username, display name, bio, avatar, life list, and totals.',
      'Every sighting you logged, including its location, notes, and timestamp.',
      'Every photo and audio recording you uploaded.',
      'Your friend connections, in both directions.',
      'Your league memberships and your scoring rows in those leagues.',
      'Your push notification tokens.',
    ],
  },
  {
    heading: 'What is kept',
    body: [
      'Leagues you created remain, because they contain other players\u2019 scores and history. Your membership and your own scores are removed from them. Nothing that identifies you is retained after deletion.',
    ],
  },
];
