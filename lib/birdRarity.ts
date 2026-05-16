export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary' | 'mythic';

export const RARITY_COLORS: Record<Rarity, string> = {
  common:    '#8BA3B0',
  uncommon:  '#2E8B57',
  rare:      '#2471A3',
  legendary: '#6A0DAD',
  mythic:    '#E8C84A',
};

export const RARITY_LABELS: Record<Rarity, string> = {
  common:    'Common',
  uncommon:  'Uncommon',
  rare:      'Rare',
  legendary: 'Legendary',
  mythic:    'Mythic',
};

export const RARITY_MULTIPLIERS: Record<Rarity, number> = {
  common:    1,
  uncommon:  2,
  rare:      5,
  legendary: 10,
  mythic:    25,
};

// Keyed by common name (lowercase). Unlisted species default to 'common'.
// Entries here act as a floor in getRarityFromCount — a bird marked 'common'
// will never be shown as rarer than common regardless of local abundance score.
const RARITY_MAP: Record<string, Rarity> = {
  // Common — widespread, everyday birds
  'american robin':           'common',
  'northern cardinal':        'common',
  'blue jay':                 'common',
  'mourning dove':            'common',
  'house sparrow':            'common',
  'european starling':        'common',
  'american goldfinch':       'common',
  'downy woodpecker':         'common',
  'black-capped chickadee':   'common',
  'song sparrow':             'common',
  'red-winged blackbird':     'common',
  'canada goose':             'common',
  'mallard':                  'common',
  'dark-eyed junco':          'common',
  'house finch':              'common',
  'american crow':            'common',
  'rock pigeon':              'common',
  'common grackle':           'common',
  'brown-headed cowbird':     'common',
  'turkey vulture':           'common',
  'killdeer':                 'common',
  'chipping sparrow':         'common',
  'gray catbird':             'common',
  'wild turkey':              'common',
  'eastern towhee':           'common',
  'eastern phoebe':           'common',
  'chimney swift':            'common',

  // Uncommon — less frequent sightings
  'cedar waxwing':                  'uncommon',
  'ruby-throated hummingbird':      'uncommon',
  'horned grebe':                   'uncommon',
  'great horned owl':               'uncommon',
  'belted kingfisher':              'uncommon',
  'eastern bluebird':               'uncommon',
  'baltimore oriole':               'uncommon',
  'rose-breasted grosbeak':         'uncommon',
  'indigo bunting':                 'uncommon',
  'yellow warbler':                 'uncommon',
  'hermit thrush':                  'uncommon',

  // Rare — uncommon across range or hard to spot
  'painted bunting':          'rare',
  'inca tern':                'rare',
  'scarlet tanager':          'rare',
  'prothonotary warbler':     'rare',
  'cerulean warbler':         'rare',
  'golden-winged warbler':    'rare',
  'american bittern':         'rare',
  'peregrine falcon':         'rare',
  'bald eagle':               'rare',
  'snowy owl':                'rare',
  'sandhill crane':           'rare',
  'wood thrush':              'rare',
  'dickcissel':               'rare',

  // Legendary — genuinely rare, restricted range, or special
  'ivory-billed woodpecker':  'legendary',
  'whooping crane':           'legendary',
  'california condor':        'legendary',
  'kirtlands warbler':        'legendary',
  'piping plover':            'legendary',
  'snowy plover':             'legendary',
  'black rail':               'legendary',

  // Mythic — critically rare or extraordinary finds
  'eskimo curlew':            'mythic',
  'bachman\'s warbler':       'mythic',
  'slaty-backed gull':        'mythic',
  'fork-tailed flycatcher':   'mythic',
  'flame-colored tanager':    'mythic',
};

export function getRarity(commonName: string): Rarity {
  return RARITY_MAP[commonName.toLowerCase()] ?? 'common';
}

// Derives rarity from a bird's observation count relative to the most-observed
// bird in the same fetch. The static RARITY_MAP acts as a floor: a bird
// explicitly marked 'common' will never display as rarer than common regardless
// of how its local count compares.
export function getRarityFromCount(count: number, maxCount: number, commonName?: string): Rarity {
  const ratio = count / maxCount;
  let dynamic: Rarity;
  if (ratio > 0.40) dynamic = 'common';
  else if (ratio > 0.10) dynamic = 'uncommon';
  else if (ratio > 0.02) dynamic = 'rare';
  else if (ratio > 0.004) dynamic = 'legendary';
  else dynamic = 'mythic';

  if (dynamic === 'common') return 'common';
  if (commonName && RARITY_MAP[commonName.toLowerCase()] === 'common') return 'common';
  return dynamic;
}
