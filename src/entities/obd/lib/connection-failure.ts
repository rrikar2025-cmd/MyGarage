export type ConnectionFailureKey =
  | 'connectError'
  | 'connectBluetoothTimeout'
  | 'connectUartError'
  | 'connectNotifyError'
  | 'connectAdapterTimeout'
  | 'connectVehicleError'
  | 'connectDisconnected'
  | 'connectBusy'
  | 'bluetoothError';
export function describeConnectionFailure(error: unknown): {
  key: ConnectionFailureKey;
  code: string;
} {
  const message =
    error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
      ? error.message
      : '';
  const candidate = message.match(/\bOBD_[A-Z0-9_]{1,48}\b/)?.[0];
  const token =
    candidate &&
    /^OBD_(?:(?:BLUETOOTH|UART|ECU)_UNAVAILABLE|(?:BLE|SERVICES|NOTIFY|ELM|ECU)_FAILED|(?:BLE|INIT)_TIMEOUT|COMMAND_TIMEOUT_(?:ATZ|ATE0|ATL0|ATS1|ATH0|ATSP0|0100)|BUSY|DISCONNECTED|CONNECT_FAILED)$/.test(
      candidate,
    )
      ? candidate
      : undefined;
  const text = message.toUpperCase();
  if (token === 'OBD_BLUETOOTH_UNAVAILABLE') return { key: 'bluetoothError', code: token };
  if (token === 'OBD_BUSY') return { key: 'connectBusy', code: token };
  if (token?.includes('UART') || text.includes('NO COMPATIBLE UART'))
    return { key: 'connectUartError', code: token ?? 'OBD_UART_UNAVAILABLE' };
  if (token?.includes('NOTIFY') || text.includes('NOTIFICATION'))
    return { key: 'connectNotifyError', code: token ?? 'OBD_NOTIFY_FAILED' };
  if (
    token?.includes('ECU') ||
    token === 'OBD_COMMAND_TIMEOUT_0100' ||
    text.includes('PROTOCOL WAS NOT DETECTED') ||
    text.includes('ECU IS NOT RESPONDING') ||
    text.includes('NO DATA')
  )
    return { key: 'connectVehicleError', code: token ?? 'OBD_ECU_UNAVAILABLE' };
  if (
    token?.includes('ELM') ||
    token?.includes('INIT_TIMEOUT') ||
    token?.startsWith('OBD_COMMAND_TIMEOUT_AT') ||
    /TIMED OUT ON AT/.test(text)
  )
    return { key: 'connectAdapterTimeout', code: token ?? 'OBD_ELM_TIMEOUT' };
  if (text.includes('TIMED OUT ON CONNECTION') && !token)
    return { key: 'connectError', code: 'OBD_LEGACY_CONNECTION_TIMEOUT' };
  if (token === 'OBD_BLE_TIMEOUT')
    return { key: 'connectBluetoothTimeout', code: token ?? 'OBD_BLE_TIMEOUT' };
  if (text.includes('DISCONNECTED'))
    return { key: 'connectDisconnected', code: token ?? 'OBD_DISCONNECTED' };
  return { key: 'connectError', code: token ?? 'OBD_CONNECT_FAILED' };
}
