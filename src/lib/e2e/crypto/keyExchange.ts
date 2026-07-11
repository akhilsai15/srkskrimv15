import sodium from 'libsodium-wrappers';
import { hkdf, ensureReady } from './hkdf';
import { generateKeyPair } from './box';

export interface KeyPair {
  publicKey: string;  // Base64
  privateKey: string; // Base64
}

export interface BobPrekeyBundle {
  identityPublicKey: string;         // Base64 - Bob's X25519 DH identity public key
  signedPrekey: string;              // Base64
  oneTimePrekey?: string;            // Base64
  // Signing fields below prove the signedPrekey genuinely belongs to Bob's identity
  // (prevents a compromised/malicious server from swapping in its own signed prekey
  // undetected). Optional here for backwards compatibility with raw aliceX3DH/bobX3DH
  // callers, but REQUIRED for anyone going through initiateVerifiedSession() below.
  signingIdentityPublicKey?: string; // Base64 - Bob's Ed25519 signing public key
  signedPreKeySignature?: string;    // Base64 - detached signature over signedPrekey
}

export interface FullIdentity {
  signingIdentityKeyPair: KeyPair; // Ed25519 (crypto_sign) - used ONLY to sign the signed prekey
  dhIdentityKeyPair: KeyPair;      // X25519 (crypto_box) - used for X3DH Diffie-Hellman math
  signedPrekeyKeyPair: KeyPair;
  signedPreKeySignature: string;  // Base64 detached signature over signedPrekeyKeyPair.publicKey
  oneTimePrekeys: KeyPair[];
}

/**
 * Generates a brand-new user's full identity: a long-term Ed25519 signing keypair,
 * a long-term X25519 DH identity keypair, a signed medium-term prekey, and a batch
 * of single-use one-time prekeys. This is the client-side bootstrap step that should
 * run once per device before any session can be established.
 */
export async function generateIdentity(oneTimePrekeyCount = 10): Promise<FullIdentity> {
  await ensureReady();

  // Ed25519 signing keypair - a separate key purpose from the X25519 DH keys below.
  // Signing keys and DH keys must never be reused for each other's purpose.
  const signingPair = sodium.crypto_sign_keypair();
  const signingIdentityKeyPair: KeyPair = {
    publicKey: sodium.to_base64(signingPair.publicKey),
    privateKey: sodium.to_base64(signingPair.privateKey),
  };

  // X25519 identity keypair used for the actual X3DH Diffie-Hellman math.
  const dhIdentityKeyPair = await generateKeyPair();

  const signedPrekeyKeyPair = await generateKeyPair();

  const signedPrekeyPubBytes = sodium.from_base64(signedPrekeyKeyPair.publicKey);
  const signatureBytes = sodium.crypto_sign_detached(signedPrekeyPubBytes, signingPair.privateKey);
  const signedPreKeySignature = sodium.to_base64(signatureBytes);

  const oneTimePrekeys: KeyPair[] = [];
  for (let i = 0; i < oneTimePrekeyCount; i++) {
    oneTimePrekeys.push(await generateKeyPair());
  }

  return {
    signingIdentityKeyPair,
    dhIdentityKeyPair,
    signedPrekeyKeyPair,
    signedPreKeySignature,
    oneTimePrekeys,
  };
}

/**
 * Verifies that a signed prekey was genuinely signed by the claimed identity's
 * signing key. Must be called BEFORE trusting/using a signed prekey fetched from
 * any server - a malicious or compromised server could otherwise substitute its
 * own signed prekey and silently man-in-the-middle the session.
 *
 * Never throws - returns false on any malformed input so callers can rely on a
 * plain boolean.
 */
export async function verifyPreKeySignature(
  signingIdentityPublicKeyBase64: string | undefined,
  signedPrekeyPublicKeyBase64: string,
  signatureBase64: string | undefined
): Promise<boolean> {
  await ensureReady();

  if (!signingIdentityPublicKeyBase64 || !signatureBase64) {
    return false;
  }

  try {
    const signingPub = sodium.from_base64(signingIdentityPublicKeyBase64);
    const signedPrekeyPub = sodium.from_base64(signedPrekeyPublicKeyBase64);
    const signature = sodium.from_base64(signatureBase64);
    return sodium.crypto_sign_verify_detached(signature, signedPrekeyPub, signingPub);
  } catch (err) {
    return false;
  }
}

/**
 * Alice initiates X3DH and computes the shared secret.
 */
export async function aliceX3DH(
  aliceIdentity: KeyPair,
  aliceEphemeral: KeyPair,
  bobBundle: BobPrekeyBundle
): Promise<Uint8Array> {
  await ensureReady();

  const aliceIdPriv = sodium.from_base64(aliceIdentity.privateKey);
  const aliceEphPriv = sodium.from_base64(aliceEphemeral.privateKey);

  const bobIdPub = sodium.from_base64(bobBundle.identityPublicKey);
  const bobSignedPub = sodium.from_base64(bobBundle.signedPrekey);

  // DH1 = scalarmult(IK_A_priv, SPK_B_pub)
  const dh1 = sodium.crypto_scalarmult(aliceIdPriv, bobSignedPub);
  // DH2 = scalarmult(EK_A_priv, IK_B_pub)
  const dh2 = sodium.crypto_scalarmult(aliceEphPriv, bobIdPub);
  // DH3 = scalarmult(EK_A_priv, SPK_B_pub)
  const dh3 = sodium.crypto_scalarmult(aliceEphPriv, bobSignedPub);

  let totalLength = dh1.length + dh2.length + dh3.length;
  let dh4: Uint8Array | null = null;

  if (bobBundle.oneTimePrekey) {
    const bobOneTimePub = sodium.from_base64(bobBundle.oneTimePrekey);
    // DH4 = scalarmult(EK_A_priv, OPK_B_pub)
    dh4 = sodium.crypto_scalarmult(aliceEphPriv, bobOneTimePub);
    totalLength += dh4.length;
  }

  // Concatenate DH outputs
  const concatenated = new Uint8Array(totalLength);
  concatenated.set(dh1, 0);
  concatenated.set(dh2, dh1.length);
  concatenated.set(dh3, dh1.length + dh2.length);
  if (dh4) {
    concatenated.set(dh4, dh1.length + dh2.length + dh3.length);
  }

  // Derive shared secret key via HKDF (using salt of 32 zero bytes and info = "X3DH")
  const salt = new Uint8Array(32);
  const info = new Uint8Array(Array.from("X3DH").map(c => c.charCodeAt(0)));
  const sharedSecret = await hkdf(concatenated, 32, salt, info);

  // Cleanup secrets
  concatenated.fill(0);
  dh1.fill(0);
  dh2.fill(0);
  dh3.fill(0);
  if (dh4) dh4.fill(0);

  return sharedSecret;
}

/**
 * Bob receives X3DH initiation parameters and computes the same shared secret.
 */
export async function bobX3DH(
  bobIdentity: KeyPair,
  bobSignedPrekey: KeyPair,
  bobOneTimePrekey: KeyPair | null,
  aliceIdentityPubBase64: string,
  aliceEphemeralPubBase64: string
): Promise<Uint8Array> {
  await ensureReady();

  const bobSignedPriv = sodium.from_base64(bobSignedPrekey.privateKey);
  const bobIdPriv = sodium.from_base64(bobIdentity.privateKey);

  const aliceIdPub = sodium.from_base64(aliceIdentityPubBase64);
  const aliceEphPub = sodium.from_base64(aliceEphemeralPubBase64);

  // DH1 = scalarmult(SPK_B_priv, IK_A_pub)
  const dh1 = sodium.crypto_scalarmult(bobSignedPriv, aliceIdPub);
  // DH2 = scalarmult(IK_B_priv, EK_A_pub)
  const dh2 = sodium.crypto_scalarmult(bobIdPriv, aliceEphPub);
  // DH3 = scalarmult(SPK_B_priv, EK_A_pub)
  const dh3 = sodium.crypto_scalarmult(bobSignedPriv, aliceEphPub);

  let totalLength = dh1.length + dh2.length + dh3.length;
  let dh4: Uint8Array | null = null;

  if (bobOneTimePrekey) {
    const bobOneTimePriv = sodium.from_base64(bobOneTimePrekey.privateKey);
    // DH4 = scalarmult(OPK_B_priv, EK_A_pub)
    dh4 = sodium.crypto_scalarmult(bobOneTimePriv, aliceEphPub);
    totalLength += dh4.length;
  }

  // Concatenate DH outputs in the same order
  const concatenated = new Uint8Array(totalLength);
  concatenated.set(dh1, 0);
  concatenated.set(dh2, dh1.length);
  concatenated.set(dh3, dh1.length + dh2.length);
  if (dh4) {
    concatenated.set(dh4, dh1.length + dh2.length + dh3.length);
  }

  // Derive shared secret key via HKDF (must match Alice's parameters exactly)
  const salt = new Uint8Array(32);
  const info = new Uint8Array(Array.from("X3DH").map(c => c.charCodeAt(0)));
  const sharedSecret = await hkdf(concatenated, 32, salt, info);

  // Cleanup secrets
  concatenated.fill(0);
  dh1.fill(0);
  dh2.fill(0);
  dh3.fill(0);
  if (dh4) dh4.fill(0);

  return sharedSecret;
}

/**
 * Verifies Bob's signed prekey signature BEFORE running X3DH. This is the ONLY
 * sanctioned entry point for initiating a session as Alice - unlike calling
 * aliceX3DH() directly, it is impossible to accidentally skip signature
 * verification when using this function.
 */
export async function initiateVerifiedSession(
  aliceIdentity: KeyPair,
  aliceEphemeral: KeyPair,
  bobBundle: BobPrekeyBundle
): Promise<Uint8Array> {
  const isValid = await verifyPreKeySignature(
    bobBundle.signingIdentityPublicKey,
    bobBundle.signedPrekey,
    bobBundle.signedPreKeySignature
  );

  if (!isValid) {
    throw new Error(
      "SECURITY: signed prekey signature verification failed, aborting session (possible MITM or server tampering)"
    );
  }

  return aliceX3DH(aliceIdentity, aliceEphemeral, bobBundle);
}
