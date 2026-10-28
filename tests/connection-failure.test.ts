import test from 'node:test';
import assert from 'node:assert/strict';
import { describeConnectionFailure } from '../src/entities/obd/lib/connection-failure';
test('connection errors distinguish BLE, UART, notifications, ELM reset and ECU negotiation', () => {
  for (const [message, key] of [
    ['OBD_BLE_TIMEOUT: timeout', 'connectBluetoothTimeout'],
    ['OBD_BLUETOOTH_UNAVAILABLE: Bluetooth unavailable', 'bluetoothError'],
    ['OBD_UART_UNAVAILABLE: No compatible UART service found', 'connectUartError'],
    ['OBD_NOTIFY_FAILED: ATT error', 'connectNotifyError'],
    ['OBD_COMMAND_TIMEOUT_ATZ: timeout', 'connectAdapterTimeout'],
    ['OBD_INIT_TIMEOUT: timeout', 'connectAdapterTimeout'],
    ['OBD_COMMAND_TIMEOUT_0100: timeout', 'connectVehicleError'],
    ['OBD_ECU_FAILED: ECU refused', 'connectVehicleError'],
    ['OBD_BUSY', 'connectBusy'],
  ])
    assert.equal(describeConnectionFailure(new Error(message)).key, key);
});
test('existing development binaries still map legacy native messages without exposing private details', () => {
  assert.equal(
    describeConnectionFailure(new Error('ELM327 timed out on connection')).key,
    'connectError',
  );
  assert.equal(
    describeConnectionFailure({ message: 'ELM327 timed out on ATZ' }).key,
    'connectAdapterTimeout',
  );
  assert.equal(
    describeConnectionFailure({ message: 'Vehicle protocol was not detected' }).key,
    'connectVehicleError',
  );
  const failure = describeConnectionFailure({
    message: 'Unknown peripheral AA:BB:CC:DD:EE:FF and VIN W1234567891234567',
  });
  assert.deepEqual(failure, { key: 'connectError', code: 'OBD_CONNECT_FAILED' });
  assert.deepEqual(describeConnectionFailure(null), failure);
  assert.equal(
    describeConnectionFailure({ message: 'Peripheral OBD_PRIVATE_VEHICLE_IDENTIFIER disconnected' })
      .code,
    'OBD_DISCONNECTED',
  );
});
