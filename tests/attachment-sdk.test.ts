import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
test('Storage SDK sends JPEG ArrayBuffer without public upload or overwriting, and signs private views for one minute', async () => {
  const requests: { url: string; body: unknown; headers: Headers }[] = [];
  const client = createClient('https://storage-contract.example.invalid', 'test-publishable-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, init) => {
        const url = String(input);
        requests.push({ url, body: init?.body, headers: new Headers(init?.headers) });
        return new Response(
          JSON.stringify(
            url.includes('/object/sign/')
              ? [
                  {
                    path: 'owner/photo.jpg',
                    signedURL: '/object/sign/mygarage-private/owner/photo.jpg?token=fixture',
                  },
                ]
              : { Key: 'mygarage-private/owner/photo.jpg', Id: 'fixture' },
          ),
          { headers: { 'Content-Type': 'application/json' } },
        );
      },
    },
  });
  const bytes = new Uint8Array([255, 216, 255, 0]).buffer;
  const bucket = client.storage.from('mygarage-private');
  assert.equal(
    (
      await bucket.upload('owner/photo.jpg', bytes, {
        contentType: 'image/jpeg',
        cacheControl: '0',
        upsert: false,
      })
    ).error,
    null,
  );
  assert.equal(requests[0]?.body, bytes);
  assert.equal(requests[0]?.headers.get('content-type'), 'image/jpeg');
  assert.equal(requests[0]?.headers.get('x-upsert'), 'false');
  const signed = await bucket.createSignedUrls(['owner/photo.jpg'], 60);
  assert.equal(signed.error, null);
  assert.ok(signed.data?.[0]?.signedUrl?.includes('/object/sign/'));
  assert.equal(JSON.parse(String(requests[1]?.body)).expiresIn, 60);
  assert.ok(requests.every((r) => !r.url.includes('/object/public/')));
});
