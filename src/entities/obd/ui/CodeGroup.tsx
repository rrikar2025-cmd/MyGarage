import { useState } from 'react';
import { View } from 'react-native';
import type { ReadStatus } from '@/shared/types';
import { useTranslation } from '@/shared/i18n';
import { Button, Notice, Text } from '@/shared/ui';
import { describeDtc } from '../lib/codes';
export function CodeGroup({
  kind,
  codes,
  status,
}: {
  kind: 'stored' | 'pending' | 'permanent';
  codes: string[];
  status?: ReadStatus;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [limit, setLimit] = useState(20);
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontWeight: '700' }} accessibilityRole="header">
        {t(kind)} · {status === 'read' || codes.length ? codes.length : '—'}
      </Text>
      {status !== 'read' && (
        <Notice>
          {t(
            status === 'unavailable'
              ? 'groupUnavailable'
              : status === 'not_requested'
                ? 'groupNotRequested'
                : 'groupLegacy',
          )}
        </Notice>
      )}
      {status === 'read' && !codes.length && (
        <Text muted variant="caption">
          {t('groupNoCodes')}
        </Text>
      )}
      {codes.slice(0, limit).map((code) => (
        <View key={code} style={{ gap: 8 }}>
          <Button
            label={code}
            variant="secondary"
            accessibilityState={{ expanded: expanded === code }}
            onPress={() => setExpanded(expanded === code ? null : code)}
          />
          {expanded === code && (
            <>
              <Text>{t(describeDtc(code))}</Text>
              <Text muted variant="caption">
                {t('dtcMeaningHint')}
              </Text>
            </>
          )}
        </View>
      ))}
      {codes.length > limit && (
        <Button label={t('showMore')} variant="ghost" onPress={() => setLimit((n) => n + 20)} />
      )}
    </View>
  );
}
