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
  describeConnectionFailure,
  isLikelyOBDName,
  bleDeviceName,
} from '@/entities/obd';
import { Button, Card, Text, Notice, Icon } from '@/shared/ui';
import { useTranslation, type MessageKey } from '@/shared/i18n';
import { useTheme } from '@/shared/theme';
export function ConnectionPanel() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const status = useOBD((s) => s.status);
  const deviceName = useOBD((s) => s.deviceName);
  const [showAll, setShowAll] = useState(false);
  const [devices, setDevices] = useState<OBDDevice[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const epoch = useRef(0);
  const connectionAttempt = useRef(0),
    connectionLock = useRef(false);
  const [failureCode, setFailureCode] = useState<string | null>(null);
  const likelyDevices = devices.filter((device) => isLikelyOBDName(device.name));
  const visibleDevices = showAll ? devices : likelyDevices;
  const hiddenCount = devices.length - likelyDevices.length;
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') stop.current?.();
    });
    return () => {
      ++epoch.current;
      ++connectionAttempt.current;
      stop.current?.();
      subscription.remove();
    };
  }, []);
  async function search() {
    const current = ++epoch.current;
    setError(null);
    setFailureCode(null);
    setDevices([]);
    setShowAll(false);
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
    if (connectionLock.current) return;
    connectionLock.current = true;
    const attempt = ++connectionAttempt.current;
    stop.current?.();
    setError(null);
    setFailureCode(null);
    try {
      await connectAdapter(device);
    } catch (failure) {
      if (attempt === connectionAttempt.current) {
        const description = describeConnectionFailure(failure);
        setError(description.key);
        setFailureCode(description.code);
      }
    } finally {
      if (attempt === connectionAttempt.current) connectionLock.current = false;
    }
  }
  async function cancelConnection() {
    ++connectionAttempt.current;
    connectionLock.current = true;
    setError(null);
    setFailureCode(null);
    try {
      await disconnectAdapter();
    } catch {
      setError('connectError');
    } finally {
      connectionLock.current = false;
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
          {status === 'connecting' && (
            <Button
              label={t('cancelConnection')}
              variant="ghost"
              onPress={() => void cancelConnection()}
            />
          )}
          {searching && (
            <Text variant="caption" muted accessibilityLiveRegion="polite">
              {t('searching')}
            </Text>
          )}
          {devices.length > 0 && (
            <Text variant="caption" muted>
              {t(showAll ? 'allBleDevices' : 'likelyObdDevices')}
            </Text>
          )}
          {showAll && <Notice>{t('allBleDevicesHint')}</Notice>}
          {visibleDevices.map((device) => (
            <Button
              key={device.id}
              variant="secondary"
              disabled={status === 'connecting'}
              label={`${bleDeviceName(device.name, device.id, t('unknownDevice'))} · ${device.rssi} dBm`}
              onPress={() => void connect(device)}
            />
          ))}
          {(hiddenCount > 0 || showAll) && (
            <Button
              label={t(showAll ? 'showObdDevices' : 'showAllBleDevices')}
              variant="ghost"
              disabled={status === 'connecting'}
              onPress={() => setShowAll((value) => !value)}
            />
          )}
          {searched && !visibleDevices.length && !error && (
            <Notice>{t(devices.length ? 'noLikelyObdDevices' : 'noBleDevices')}</Notice>
          )}
        </>
      )}
      {error && <Notice tone="error">{t(error)}</Notice>}
      {error && failureCode && (
        <Text muted variant="caption">
          {t('connectionFailureCode')}: {failureCode}
        </Text>
      )}
    </Card>
  );
}
