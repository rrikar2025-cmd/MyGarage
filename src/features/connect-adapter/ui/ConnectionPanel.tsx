import { useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import {
  isOBDAvailable,
  searchAdapters,
  getAdapters,
  stopAdapterSearch,
  connectAdapter,
  disconnectAdapter,
  useOBD,
  type OBDDevice,
} from '@/entities/obd';
import { Button, Card, Text, Notice, Icon } from '@/shared/ui';
import { useTranslation } from '@/shared/i18n';
import { useTheme } from '@/shared/theme';
export function ConnectionPanel() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const status = useOBD((s) => s.status);
  const deviceName = useOBD((s) => s.deviceName);
  const [devices, setDevices] = useState<OBDDevice[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<'bluetoothError' | 'connectError' | null>(null);
  const epoch = useRef(0);
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') stop.current?.();
    });
    return () => {
      ++epoch.current;
      stop.current?.();
      subscription.remove();
    };
  }, []);
  async function search() {
    const current = ++epoch.current;
    setError(null);
    setDevices([]);
    setSearching(true);
    setSearched(false);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      if (timer) clearTimeout(timer);
      void stopAdapterSearch().catch(() => {});
      if (epoch.current === current) {
        setSearching(false);
        setSearched(true);
      }
      ++epoch.current;
    };
    stop.current = finish;
    try {
      await searchAdapters();
      if (epoch.current !== current) {
        await stopAdapterSearch();
        return;
      }
      const until = Date.now() + 12500;
      const poll = async () => {
        if (epoch.current !== current) return;
        try {
          const found = await getAdapters();
          if (epoch.current === current) setDevices(found);
        } catch {
          if (epoch.current === current) setError('bluetoothError');
          finish();
          return;
        }
        if (Date.now() >= until) finish();
        else timer = setTimeout(poll, 700);
      };
      await poll();
    } catch {
      if (epoch.current === current) {
        setError('bluetoothError');
        finish();
      }
    }
  }
  async function connect(device: OBDDevice) {
    stop.current?.();
    setError(null);
    try {
      await connectAdapter(device);
    } catch {
      setError('connectError');
    }
  }
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Icon name="bluetooth" size={26} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '700' }}>{t('adapter')}</Text>
          <Text variant="caption" muted>
            {status === 'connected' ? deviceName : t(status)}
          </Text>
        </View>
      </View>
      {!isOBDAvailable ? (
        <Notice>{t('nativeRequired')}</Notice>
      ) : status === 'connected' ? (
        <Button
          label={t('disconnect')}
          variant="secondary"
          onPress={() => void disconnectAdapter().catch(() => setError('connectError'))}
        />
      ) : (
        <>
          <Text variant="caption" muted>
            {t('connectionHint')}
          </Text>
          <Button
            label={t(
              searching ? 'stopSearch' : status === 'connecting' ? 'connecting' : 'searchAdapters',
            )}
            icon="bluetooth"
            busy={status === 'connecting'}
            variant={searching ? 'secondary' : 'primary'}
            onPress={() => (searching ? stop.current?.() : void search())}
          />
          {searching && (
            <Text variant="caption" muted accessibilityLiveRegion="polite">
              {t('searching')}
            </Text>
          )}
          {devices.map((device) => (
            <Button
              key={device.id}
              variant="secondary"
              disabled={status === 'connecting'}
              label={`${device.name === 'Unknown' ? t('unknownDevice') : device.name} · ${device.rssi} dBm`}
              onPress={() => void connect(device)}
            />
          ))}
          {searched && !devices.length && !error && <Notice>{t('noAdapters')}</Notice>}
        </>
      )}
      {error && <Notice tone="error">{t(error)}</Notice>}
    </Card>
  );
}
