import { getAuthErrorMessage } from '../../lib/authErrors';
import { getBirdIdForSpecies, BIRD_STYLES } from '../../lib/birdStyles';
import { extractCoords } from '../../lib/firestore/sightings';
import { calculatePoints } from '../../lib/firestore/leagues';

// These modules pull in the Firebase SDK at import time. The functions under
// test are pure, so the SDK is stubbed rather than transformed.
jest.mock('../../lib/firebase', () => ({ db: {}, auth: {}, storage: {} }));
jest.mock('firebase/firestore', () => ({}));

describe('getAuthErrorMessage', () => {
  test('maps known firebase auth codes to friendly copy', () => {
    expect(getAuthErrorMessage({ code: 'auth/wrong-password' })).toMatch(/Incorrect password/);
    expect(getAuthErrorMessage({ code: 'auth/email-already-in-use' })).toMatch(/already exists/);
    expect(getAuthErrorMessage({ code: 'auth/network-request-failed' })).toMatch(/Network error/);
  });

  test('never leaks a raw firebase code to the user', () => {
    const codes = [
      'auth/email-already-in-use',
      'auth/weak-password',
      'auth/user-not-found',
      'auth/wrong-password',
      'auth/invalid-credential',
      'auth/user-disabled',
      'auth/invalid-email',
      'auth/too-many-requests',
      'auth/network-request-failed',
      'auth/operation-not-allowed',
    ];
    for (const code of codes) expect(getAuthErrorMessage({ code })).not.toContain('auth/');
  });

  test('falls back to the error message for unknown codes', () => {
    expect(getAuthErrorMessage(new Error('boom'))).toBe('boom');
  });

  test('handles null, undefined and non-error values', () => {
    expect(typeof getAuthErrorMessage(null)).toBe('string');
    expect(typeof getAuthErrorMessage(undefined)).toBe('string');
    expect(typeof getAuthErrorMessage('a string')).toBe('string');
    expect(getAuthErrorMessage(null)).toBeTruthy();
  });
});

describe('getBirdIdForSpecies', () => {
  test('resolves a species to its bird style id', () => {
    expect(getBirdIdForSpecies('Cedar Waxwing')).toBe('waxwing');
  });

  test('is case-insensitive', () => {
    expect(getBirdIdForSpecies('cedar waxwing')).toBe('waxwing');
    expect(getBirdIdForSpecies('CEDAR WAXWING')).toBe('waxwing');
  });

  test('resolves alias spellings', () => {
    expect(getBirdIdForSpecies('Ruby-throated Hummingbird')).toBe('hummingbird');
    expect(getBirdIdForSpecies('Ruby throated Hummingbird')).toBe('hummingbird');
  });

  test('returns null for an unknown species rather than throwing', () => {
    expect(getBirdIdForSpecies('Not A Bird')).toBeNull();
    expect(getBirdIdForSpecies('')).toBeNull();
  });

  test('every bird style label resolves back to its own id', () => {
    for (const b of BIRD_STYLES) expect(getBirdIdForSpecies(b.label)).toBe(b.id);
  });
});

describe('BIRD_STYLES integrity', () => {
  test('ids are unique', () => {
    const ids = BIRD_STYLES.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('labels are unique', () => {
    const labels = BIRD_STYLES.map((b) => b.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  test('every bird carries a complete theme palette', () => {
    for (const b of BIRD_STYLES) {
      expect(b.theme).toBeDefined();
      for (const key of ['primary', 'accent', 'background', 'surface'] as const) {
        expect(b.theme[key]).toMatch(/^#[0-9A-Fa-f]{3,8}$/);
      }
    }
  });
});

describe('extractCoords', () => {
  test('reads Firestore GeoPoint shape (latitude/longitude)', () => {
    expect(extractCoords({ latitude: 40.7, longitude: -74 })).toEqual({ lat: 40.7, lng: -74 });
  });

  test('reads flat lat/lng shape', () => {
    expect(extractCoords({ lat: 40.7, lng: -74 })).toEqual({ lat: 40.7, lng: -74 });
  });

  test('GeoPoint fields win when both shapes are present', () => {
    expect(extractCoords({ latitude: 1, longitude: 2, lat: 9, lng: 9 })).toEqual({ lat: 1, lng: 2 });
  });

  test('preserves zero coordinates rather than treating them as missing', () => {
    // A `||` fallback here would corrupt null-island coordinates; `??` must be used.
    expect(extractCoords({ latitude: 0, longitude: 0 })).toEqual({ lat: 0, lng: 0 });
  });

  test('missing fields surface as undefined rather than throwing', () => {
    expect(extractCoords({})).toEqual({ lat: undefined, lng: undefined });
  });
});

describe('calculatePoints', () => {
  const base = { requirePhotos: false, rarityScoring: true, targetBirds: true };

  test('a common non-target bird scores 1', () => {
    expect(calculatePoints('common', false, base)).toBe(1);
  });

  test('rarity multiplies the base point', () => {
    expect(calculatePoints('uncommon', false, base)).toBe(2);
    expect(calculatePoints('rare', false, base)).toBe(5);
    expect(calculatePoints('legendary', false, base)).toBe(10);
    expect(calculatePoints('mythic', false, base)).toBe(25);
  });

  test('a target bird adds a flat 3-point bonus', () => {
    expect(calculatePoints('common', true, base)).toBe(4);
    expect(calculatePoints('rare', true, base)).toBe(8);
  });

  test('rarityScoring off flattens every rarity to 1', () => {
    const cfg = { ...base, rarityScoring: false };
    expect(calculatePoints('mythic', false, cfg)).toBe(1);
    expect(calculatePoints('common', false, cfg)).toBe(1);
  });

  test('targetBirds off removes the bonus even for a target', () => {
    const cfg = { ...base, targetBirds: false };
    expect(calculatePoints('common', true, cfg)).toBe(1);
  });

  test('both toggles off scores exactly 1 for everything', () => {
    const cfg = { requirePhotos: false, rarityScoring: false, targetBirds: false };
    expect(calculatePoints('mythic', true, cfg)).toBe(1);
  });

  test('never returns a non-positive score', () => {
    for (const r of ['common', 'uncommon', 'rare', 'legendary', 'mythic'] as const) {
      for (const isTarget of [true, false]) {
        expect(calculatePoints(r, isTarget, base)).toBeGreaterThan(0);
      }
    }
  });
});
