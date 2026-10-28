import test from 'node:test';
import assert from 'node:assert/strict';
import {
  equalJobHash,
  validMediaPath,
  reminderMessage,
  ticketDisposition,
} from '../supabase/functions/_shared/job-protocol';
test('worker credentials and cleanup paths fail closed on mismatches and traversal', () => {
  assert.equal(equalJobHash('a'.repeat(64), 'a'.repeat(64)), true);
  assert.equal(equalJobHash('a'.repeat(64), 'b'.repeat(64)), false);
  assert.equal(equalJobHash('', ''), false);
  assert.equal(
    validMediaPath('a1111111-1111-4111-8111-111111111111/b1111111-1111-4111-8111-111111111111.jpg'),
    true,
  );
  for (const path of [
    '../photo.jpg',
    'owner/../../photo.jpg',
    'a1111111-1111-4111-8111-111111111111/not-a-photo.svg',
  ])
    assert.equal(validMediaPath(path), false);
});
test('push messages reveal no car or financial details and ticket acceptance is distinct from device delivery', () => {
  const message = reminderMessage({
    service_entry_id: 'private-service',
    push_device_id: 'private-device',
    reminder_state: 'overdue',
    revision: 'private-deadline',
    expo_push_token: 'ExpoPushToken[test]',
    locale: 'uk',
  });
  assert.deepEqual(message.data, { type: 'service-reminder' });
  assert.ok(!JSON.stringify(message).includes('private-'));
  assert.equal(message.channelId, 'service-reminders');
  assert.equal(ticketDisposition({ status: 'ok', id: 'ticket' }).status, 'accepted');
  assert.equal(
    ticketDisposition({ status: 'error', details: { error: 'DeviceNotRegistered' } }).disableDevice,
    true,
  );
  assert.equal(ticketDisposition({ status: 'ok' }).status, 'failed');
});
