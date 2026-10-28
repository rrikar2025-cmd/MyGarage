import { useEffect, useRef } from 'react';
import { Modal, Platform, View, Pressable, ScrollView, type View as ViewType } from 'react-native';
import { useTheme, radius } from '@/shared/theme';
import { useTranslation } from '@/shared/i18n';
import { Text } from './Text';
import { Button } from './Button';
export function Confirm({
  visible,
  title,
  body,
  action,
  busy,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  body: string;
  action: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const cancel = useRef<ViewType>(null);
  // RN Modal owns background isolation; web needs initial focus, focus containment and restoration.
  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;
    const previous = document.activeElement as HTMLElement | null;
    const timer = setTimeout(() => (cancel.current as unknown as HTMLElement)?.focus(), 50);
    function key(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) {
        event.preventDefault();
        onCancel();
      }
      if (event.key !== 'Tab') return;
      const root = document.querySelector('[data-testid="confirm-dialog"]');
      const targets = root?.querySelectorAll<HTMLElement>('button, [tabindex="0"]');
      if (!targets?.length) return;
      const first = targets[0]!,
        last = targets[targets.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', key);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', key);
      previous?.focus();
    };
  }, [visible, busy, onCancel]);
  return (
    <Modal
      accessibilityLabel={title}
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => !busy && onCancel()}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,.55)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
        }}
      >
        <View
          testID="confirm-dialog"
          accessibilityViewIsModal
          style={{
            width: '100%',
            maxWidth: 440,
            maxHeight: '85%',
            borderRadius: radius.md,
            padding: 24,
            backgroundColor: colors.surface,
            gap: 18,
          }}
        >
          <Text variant="heading" accessibilityRole="header">
            {title}
          </Text>
          <ScrollView>
            <Text muted>{body}</Text>
          </ScrollView>
          <Pressable
            ref={cancel}
            accessibilityRole="button"
            accessibilityLabel={t('cancel')}
            disabled={busy}
            onPress={onCancel}
            style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center' }}
          >
            <Text>{t('cancel')}</Text>
          </Pressable>
          <Button label={action} variant="danger" busy={busy} onPress={onConfirm} />
        </View>
      </View>
    </Modal>
  );
}
