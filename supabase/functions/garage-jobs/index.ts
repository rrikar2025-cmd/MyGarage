import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import {
  equalJobHash,
  validMediaPath,
  reminderMessage,
  ticketDisposition,
  type ReminderClaim,
  type ExpoTicket,
} from '../_shared/job-protocol.ts';
const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const bucket = 'mygarage-private';
async function authorized(request: Request) {
  const value = request.headers.get('x-mygarage-job-key') ?? '';
  if (!/^[a-f0-9]{64}$/.test(value)) return false;
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))),
    (v) => v.toString(16).padStart(2, '0'),
  ).join('');
  const { data, error } = await admin
    .from('garage_job_settings')
    .select('job_key_hash')
    .eq('id', true)
    .single();
  return !error && typeof data.job_key_hash === 'string' && equalJobHash(hash, data.job_key_hash);
}
async function cleanMedia() {
  const stale = await admin
    .from('garage_attachments')
    .delete()
    .eq('state', 'uploading')
    .lt('created_at', new Date(Date.now() - 3600000).toISOString());
  if (stale.error) throw stale.error;
  const queued = await admin
    .from('media_deletion_queue')
    .select('path,created_at')
    .order('last_checked_at', { ascending: true, nullsFirst: true })
    .limit(200);
  if (queued.error) throw queued.error;
  const paths = queued.data.map((row) => row.path as string);
  if (paths.some((path) => !validMediaPath(path))) throw new Error('Invalid cleanup path');
  if (paths.length) {
    const removed = await admin.storage.from(bucket).remove(paths);
    if (removed.error) throw removed.error;
    const touched = await admin
      .from('media_deletion_queue')
      .update({ last_checked_at: new Date().toISOString() })
      .in('path', paths);
    if (touched.error) throw touched.error;
    // Retain tombstones for late completion of an interrupted upload, without restoring access.
    const retired = queued.data
      .filter((row) => Date.parse(row.created_at) < Date.now() - 7 * 86400000)
      .map((row) => row.path);
    if (retired.length) {
      const result = await admin.from('media_deletion_queue').delete().in('path', retired);
      if (result.error) throw result.error;
    }
  }
  return paths.length;
}
async function mark(claim: ReminderClaim, values: Record<string, unknown>) {
  const result = await admin
    .from('service_reminder_deliveries')
    .update(values)
    .eq('service_entry_id', claim.service_entry_id)
    .eq('push_device_id', claim.push_device_id)
    .eq('reminder_state', claim.reminder_state)
    .eq('revision', claim.revision);
  if (result.error) throw result.error;
}
async function sendReminders() {
  const claimed = await admin.rpc('claim_service_reminders', { p_limit: 100 });
  if (claimed.error) throw claimed.error;
  const claims = claimed.data as ReminderClaim[];
  if (!claims.length) return 0;
  let tickets: ExpoTicket[];
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(claims.map(reminderMessage)),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('Push request failed');
    const result = await response.json();
    tickets = result.data;
    if (
      !Array.isArray(tickets) ||
      tickets.length !== claims.length ||
      tickets.some((t) => !t || !['ok', 'error'].includes(t.status))
    )
      throw new Error('Invalid ticket count');
  } catch {
    await Promise.all(claims.map((claim) => mark(claim, { status: 'unknown' })));
    return 0;
  }
  let accepted = 0;
  for (let i = 0; i < claims.length; i++) {
    const claim = claims[i]!,
      disposition = ticketDisposition(tickets[i]!);
    await mark(claim, { status: disposition.status, ticket_id: disposition.ticket_id });
    if (disposition.status === 'accepted') accepted++;
    if (disposition.disableDevice) {
      const disabled = await admin
        .from('push_devices')
        .update({ enabled: false, updated_at: new Date().toISOString() })
        .eq('id', claim.push_device_id);
      if (disabled.error) throw disabled.error;
    }
  }
  return accepted;
}
async function checkReceipts() {
  const pending = await admin
    .from('service_reminder_deliveries')
    .select('ticket_id,push_device_id')
    .eq('status', 'accepted')
    .not('ticket_id', 'is', null)
    .lt('created_at', new Date(Date.now() - 15 * 60000).toISOString())
    .limit(300);
  if (pending.error) throw pending.error;
  if (!pending.data.length) return;
  const response = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: pending.data.map((row) => row.ticket_id) }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('Receipt request failed');
  const result = await response.json();
  for (const row of pending.data) {
    const receipt = result.data?.[row.ticket_id] as ExpoTicket | undefined;
    if (!receipt) continue;
    const checked = await admin
      .from('service_reminder_deliveries')
      .update({
        status: receipt.status === 'ok' ? 'delivered' : 'failed',
        receipt_checked_at: new Date().toISOString(),
      })
      .eq('ticket_id', row.ticket_id);
    if (checked.error) throw checked.error;
    if (receipt.details?.error === 'DeviceNotRegistered') {
      const disabled = await admin
        .from('push_devices')
        .update({ enabled: false, updated_at: new Date().toISOString() })
        .eq('id', row.push_device_id);
      if (disabled.error) throw disabled.error;
    }
  }
  const expired = await admin
    .from('service_reminder_deliveries')
    .update({ status: 'unknown' })
    .eq('status', 'accepted')
    .lt('created_at', new Date(Date.now() - 86400000).toISOString());
  if (expired.error) throw expired.error;
}
Deno.serve(async (request) => {
  if (request.method !== 'POST')
    return Response.json({ error: 'method_not_allowed' }, { status: 405 });
  try {
    if (!(await authorized(request)))
      return Response.json({ error: 'unauthorized' }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    if (body.dryRun === true) {
      const devices = await admin
        .from('push_devices')
        .select('id', { count: 'exact', head: true })
        .eq('enabled', true);
      const media = await admin.storage.getBucket(bucket);
      if (devices.error || media.error) throw new Error('Schema not ready');
      return Response.json({
        ok: true,
        dryRun: true,
        privateBucket: !media.data.public,
        enabledDevices: devices.count,
      });
    }
    const results = await Promise.allSettled([cleanMedia(), sendReminders(), checkReceipts()]);
    const ok = results.every((result) => result.status === 'fulfilled');
    return Response.json(
      {
        ok,
        cleaned: results[0].status === 'fulfilled' ? results[0].value : null,
        accepted: results[1].status === 'fulfilled' ? results[1].value : null,
      },
      { status: ok ? 200 : 500 },
    );
  } catch {
    return Response.json({ error: 'garage_jobs_failed' }, { status: 500 });
  }
});
