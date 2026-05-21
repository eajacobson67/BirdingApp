import { Image, ImageSourcePropType, View } from 'react-native';

export type { ThemePalette, BirdStyle } from '../../lib/birdStyles';
export { BIRD_STYLES } from '../../lib/birdStyles';

import type { BirdStyle } from '../../lib/birdStyles';

const BIRD_PNGS: Partial<Record<string, ImageSourcePropType>> = {
  waxwing:        require('../../assets/birds/cedar_waxwing.png'),
  cardinal:       require('../../assets/birds/cardinal.png'),
  robin:          require('../../assets/birds/robin.png'),
  hummingbird:    require('../../assets/birds/hummingbird.png'),
  paintedbunting: require('../../assets/birds/painted_bunting.png'),
  housesparrow:   require('../../assets/birds/house_sparrow.png'),
  scissortailedflycatcher: require('../../assets/birds/scissor_tailed_flycatcher.png'),
  bluejay:      require('../../assets/birds/blue_jay.png'),
};

interface Props {
  birdStyle: BirdStyle;
  size?: number;
  profileImageUri?: string;
}

export function BirdAvatar({ birdStyle: b, size = 80, profileImageUri }: Props) {
  const pngSource = BIRD_PNGS[b.id];

  if (profileImageUri) {
    return (
      <Image
        source={{ uri: profileImageUri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }

  if (pngSource) {
    return (
      <Image
        source={pngSource}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    );
  }

  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: b.body }} />
  );
}
