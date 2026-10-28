import test from 'node:test';
import assert from 'node:assert/strict';
import { isLikelyOBDName, bleDeviceName } from '../src/entities/obd/lib/device-discovery';
test('default adapter candidates exclude laptops, nameless devices and unrelated BLE advertisements', () => {
  for (const name of [
    'MacBook Pro - admin',
    'Unknown',
    '',
    'BLE adapter',
    'XH_CL_B000548C',
    'Temperature sensor',
    'LED_ELMcontrol',
  ])
    assert.equal(isLikelyOBDName(name), false, name);
  for (const name of [
    'OBDII',
    'OBD2',
    'ELM327',
    'OBDLink CX',
    'Vgate iCar Pro',
    'vLinker MC+',
    'YMOBD',
    'OBDII_ABC123',
  ])
    assert.equal(isLikelyOBDName(name), true, name);
});
test('unnamed devices are honestly labelled and distinguishable in the explicit full list', () => {
  assert.equal(
    bleDeviceName('Unknown', '94100000-0000-4000-8000-000000000123', 'Unnamed device'),
    'Unnamed device · 000123',
  );
  assert.equal(
    bleDeviceName('  ', 'AA:BB:CC:DD:EE:FF', 'Пристрій без назви'),
    'Пристрій без назви · DDEEFF',
  );
  assert.equal(bleDeviceName('MacBook Pro - admin', 'id', 'Unnamed'), 'MacBook Pro - admin');
  assert.equal(bleDeviceName('OBD\u0000II', 'id', 'Unnamed'), 'OBD II');
});
