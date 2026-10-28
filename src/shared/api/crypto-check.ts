export function assertPKCECrypto() {
  if (
    typeof crypto === 'undefined' ||
    typeof crypto.getRandomValues !== 'function' ||
    typeof crypto.subtle?.digest !== 'function' ||
    typeof TextEncoder === 'undefined'
  ) {
    throw Object.assign(new Error('Secure PKCE primitives unavailable'), {
      code: 'secure_context_required',
    });
  }
}
