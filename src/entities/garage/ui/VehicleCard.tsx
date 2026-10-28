import { useState } from 'react';
import { View, Image } from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { Text } from '@/shared/ui';
import { useTranslation } from '@/shared/i18n';
import { useTheme, radius } from '@/shared/theme';
import { formatNumber } from '@/shared/lib';
import type { Vehicle } from '../model/types';
export function CarDrawing({ color }: { color: string }) {
  return (
    <Svg width="100%" height={110} viewBox="0 0 320 110" accessible={false} aria-hidden={true}>
      <Line x1="18" y1="92" x2="306" y2="92" stroke={color} strokeOpacity={0.2} />
      <Path
        d="M24 76V62Q26 51 58 48L93 21Q103 15 124 15H191Q204 15 216 29L238 49L281 57Q294 60 295 72V81H270M228 81H94M52 81H25M72 47H219M107 22L87 47M175 21L180 47M127 48V71M194 48V70M138 55H149M203 55H214M27 60H47M274 62H293"
        fill="none"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="73" cy="78" r="20" fill="none" stroke={color} strokeWidth="2.4" />
      <Circle cx="73" cy="78" r="10" fill="none" stroke={color} strokeWidth="1.5" />
      <Circle cx="249" cy="78" r="20" fill="none" stroke={color} strokeWidth="2.4" />
      <Circle cx="249" cy="78" r="10" fill="none" stroke={color} strokeWidth="1.5" />
    </Svg>
  );
}
export function VehicleCard({
  vehicle,
  selected = false,
  photoURI,
}: {
  vehicle: Vehicle;
  selected?: boolean;
  photoURI?: string;
}) {
  const { colors } = useTheme();
  const [failedURI, setFailedURI] = useState<string | null>(null);
  const { t, locale } = useTranslation();
  return (
    <View
      style={{
        backgroundColor: selected ? colors.hero : colors.surface,
        borderRadius: radius.lg,
        padding: 24,
        gap: 8,
      }}
    >
      <Text variant="eyebrow" color={selected ? colors.heroMuted : colors.muted}>
        {selected ? t('yourVehicle') : String(vehicle.year)}
      </Text>
      <Text
        variant="heading"
        color={selected ? colors.onHero : colors.text}
        style={{ fontSize: 26, lineHeight: 34 }}
      >
        {vehicle.make} {vehicle.model}
      </Text>
      <View
        style={{
          width: '100%',
          aspectRatio: 16 / 9,
          justifyContent: 'center',
          overflow: 'hidden',
          borderRadius: radius.sm,
        }}
      >
        {photoURI && photoURI !== failedURI ? (
          <Image
            source={{ uri: photoURI }}
            accessibilityLabel={`${t('vehiclePhoto')}: ${vehicle.make} ${vehicle.model}`}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
            onError={() => setFailedURI(photoURI)}
          />
        ) : (
          <CarDrawing color={selected ? colors.heroMuted : colors.primary} />
        )}
      </View>
      <View
        style={{ flexDirection: 'row', gap: 16, justifyContent: 'space-between', flexWrap: 'wrap' }}
      >
        <Text variant="caption" color={selected ? colors.heroMuted : colors.muted}>
          {vehicle.year} · {formatNumber(vehicle.mileage, locale)} {t('speedUnit').split('/')[0]}
        </Text>
        {vehicle.plate ? (
          <Text
            variant="caption"
            color={selected ? colors.onHero : colors.text}
            style={{ fontWeight: '700', letterSpacing: 1 }}
          >
            {vehicle.plate}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
