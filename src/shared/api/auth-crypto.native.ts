import { CryptoDigestAlgorithm, digest, getRandomValues, randomUUID } from 'expo-crypto';
// Supabase PKCE needs secure random values and SHA-256 on Hermes.
// Install only missing primitives; never replace an existing WebCrypto implementation.
const nativeCrypto = globalThis.crypto ?? ({} as Crypto);
nativeCrypto.getRandomValues ??= getRandomValues as Crypto['getRandomValues'];
nativeCrypto.randomUUID ??= randomUUID as Crypto['randomUUID'];
if (!nativeCrypto.subtle?.digest) {
  const pkceDigest: Pick<SubtleCrypto, 'digest'> = {
    digest(algorithm, data) {
      const name = typeof algorithm === 'string' ? algorithm : algorithm.name;
      if (name !== 'SHA-256') return Promise.reject(new Error('Unsupported auth digest'));
      return digest(CryptoDigestAlgorithm.SHA256, data);
    },
  };
  Object.defineProperty(nativeCrypto, 'subtle', { value: pkceDigest, configurable: true });
}
if (!globalThis.crypto)
  Object.defineProperty(globalThis, 'crypto', { value: nativeCrypto, configurable: true });
