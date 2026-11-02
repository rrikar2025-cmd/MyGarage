import { useState } from 'react';
import { Linking } from 'react-native';
import { useTranslation } from '@/shared/i18n';
import { Button, Card, Notice, Section, Text } from '@/shared/ui';

export function CommunitySupport({ url }: { url: string }) {
  const { t } = useTranslation();
  const [error, setError] = useState(false);

  async function openCommunity() {
    setError(false);
    try {
      await Linking.openURL(url);
    } catch {
      setError(true);
    }
  }

  return (
    <Section title={t('communitySupport')}>
      <Card>
        <Text muted>{t('communitySupportHint')}</Text>
        <Button
          label={t('communitySupportButton')}
          variant="secondary"
          onPress={() => void openCommunity()}
        />
        {error && <Notice tone="error">{t('communitySupportError')}</Notice>}
      </Card>
    </Section>
  );
}
