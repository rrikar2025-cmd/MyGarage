import { useState } from 'react';
import { Image, Pressable } from 'react-native';
import type { Attachment } from '@/entities/attachment';
import { useTranslation } from '@/shared/i18n';
import { radius } from '@/shared/theme';
import { Button, Card, Notice, Text } from '@/shared/ui';
export function AttachmentTile({
  item,
  url,
  busy,
  onRemove,
  onOpen,
}: {
  item: Attachment;
  url?: string;
  busy: boolean;
  onRemove: () => void;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const [failedURL, setFailedURL] = useState<string | null>(null);
  return (
    <Card>
      {url && url !== failedURL ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={item.caption ? `${t('photoOpen')}: ${item.caption}` : t('photoOpen')}
          onPress={onOpen}
        >
          <Image
            source={{ uri: url }}
            onError={() => setFailedURL(url)}
            accessibilityLabel={item.caption || t('photoPreview')}
            style={{ width: '100%', height: 200, borderRadius: radius.sm }}
            resizeMode="contain"
          />
        </Pressable>
      ) : (
        <Notice>{t(item.state === 'ready' ? 'photoPreviewFailed' : 'photoIncomplete')}</Notice>
      )}
      {item.caption && <Text>{item.caption}</Text>}
      <Button label={t('photoRemove')} variant="danger" disabled={busy} onPress={onRemove} />
    </Card>
  );
}
