import {
  getRarity,
  getRarityFromCount,
  RARITY_MULTIPLIERS,
  RARITY_COLORS,
  type Rarity,
} from '../../lib/birdRarity';

const ALL: Rarity[] = ['common', 'uncommon', 'rare', 'legendary', 'mythic'];

describe('getRarity', () => {
  test('unlisted species default to common', () => {
    expect(getRarity('Definitely Not A Real Bird')).toBe('common');
  });

  test('lookup is case-insensitive', () => {
    expect(getRarity('eskimo curlew')).toBe('mythic');
    expect(getRarity('Eskimo Curlew')).toBe('mythic');
    expect(getRarity('ESKIMO CURLEW')).toBe('mythic');
  });

  test('known mythic species resolve correctly', () => {
    expect(getRarity('Slaty-backed Gull')).toBe('mythic');
    expect(getRarity('Fork-tailed Flycatcher')).toBe('mythic');
  });

  test('handles apostrophes in names', () => {
    expect(getRarity("Bachman's Warbler")).toBe('mythic');
  });

  test('an empty name is common, not a crash', () => {
    expect(getRarity('')).toBe('common');
  });

  test('always returns a valid rarity', () => {
    for (const name of ['Cedar Waxwing', 'Black Rail', 'zzz', '']) {
      expect(ALL).toContain(getRarity(name));
    }
  });
});

describe('getRarityFromCount', () => {
  test('an abundant bird is common', () => {
    expect(getRarityFromCount(80, 100)).toBe('common');
  });

  test('ratio bands map to the documented tiers', () => {
    expect(getRarityFromCount(50, 100)).toBe('common');    // 0.50 > 0.40
    expect(getRarityFromCount(20, 100)).toBe('uncommon');  // 0.20 > 0.10
    expect(getRarityFromCount(5, 100)).toBe('rare');       // 0.05 > 0.02
    expect(getRarityFromCount(1, 100)).toBe('legendary');  // 0.01 > 0.004
    expect(getRarityFromCount(1, 1000)).toBe('mythic');    // 0.001
  });

  test('boundaries are exclusive — exactly 0.40 is not common', () => {
    expect(getRarityFromCount(40, 100)).toBe('uncommon');
    expect(getRarityFromCount(10, 100)).toBe('rare');
    expect(getRarityFromCount(2, 100)).toBe('legendary');
  });

  test('the static map acts as a floor for common birds', () => {
    // A bird explicitly listed common stays common even when locally scarce.
    expect(getRarityFromCount(1, 1000, 'American Robin')).toBe('common');
  });

  test('the floor does not promote genuinely rare birds', () => {
    expect(getRarityFromCount(1, 1000, 'Eskimo Curlew')).toBe('mythic');
  });

  test('the floor lookup is case-insensitive', () => {
    const lower = getRarityFromCount(1, 1000, 'american robin');
    const upper = getRarityFromCount(1, 1000, 'AMERICAN ROBIN');
    expect(lower).toBe(upper);
  });

  test('count equal to max is common', () => {
    expect(getRarityFromCount(100, 100)).toBe('common');
  });

  test('always returns a valid rarity across the range', () => {
    for (let c = 0; c <= 100; c += 7) {
      expect(ALL).toContain(getRarityFromCount(c, 100));
    }
  });
});

describe('rarity tables', () => {
  test('every rarity has a multiplier', () => {
    for (const r of ALL) expect(typeof RARITY_MULTIPLIERS[r]).toBe('number');
  });

  test('multipliers increase monotonically with rarity', () => {
    const values = ALL.map((r) => RARITY_MULTIPLIERS[r]);
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThan(values[i - 1]);
  });

  test('every rarity has a colour', () => {
    for (const r of ALL) expect(RARITY_COLORS[r]).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});
