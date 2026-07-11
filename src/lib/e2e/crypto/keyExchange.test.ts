import { describe, it, expect } from 'vitest';
import { generateKeyPair, ensureReady } from './box';
import {
  aliceX3DH,
  bobX3DH,
  generateIdentity,
  verifyPreKeySignature,
  initiateVerifiedSession,
} from './keyExchange';

describe('X3DH Key Exchange Tests', () => {
  it('should successfully compute identical shared secrets for Alice and Bob (with OPK)', async () => {
    await ensureReady();

    // 1. Generate Alice's keys
    const aliceIdentity = await generateKeyPair();
    const aliceEphemeral = await generateKeyPair();

    // 2. Generate Bob's keys
    const bobIdentity = await generateKeyPair();
    const bobSignedPrekey = await generateKeyPair();
    const bobOneTimePrekey = await generateKeyPair();

    // 3. Alice fetches Bob's prekey bundle
    const bobBundle = {
      identityPublicKey: bobIdentity.publicKey,
      signedPrekey: bobSignedPrekey.publicKey,
      oneTimePrekey: bobOneTimePrekey.publicKey,
    };

    // 4. Alice calculates the shared secret
    const aliceSecret = await aliceX3DH(aliceIdentity, aliceEphemeral, bobBundle);

    // 5. Bob receives Alice's parameters and calculates the shared secret
    const bobSecret = await bobX3DH(
      bobIdentity,
      bobSignedPrekey,
      bobOneTimePrekey,
      aliceIdentity.publicKey,
      aliceEphemeral.publicKey
    );

    expect(aliceSecret).toEqual(bobSecret);
    expect(aliceSecret.length).toBe(32);
  });

  it('should successfully compute identical shared secrets for Alice and Bob (without OPK)', async () => {
    await ensureReady();

    // 1. Generate Alice's keys
    const aliceIdentity = await generateKeyPair();
    const aliceEphemeral = await generateKeyPair();

    // 2. Generate Bob's keys
    const bobIdentity = await generateKeyPair();
    const bobSignedPrekey = await generateKeyPair();

    // 3. Alice fetches Bob's prekey bundle (no OPK)
    const bobBundle = {
      identityPublicKey: bobIdentity.publicKey,
      signedPrekey: bobSignedPrekey.publicKey,
    };

    // 4. Alice calculates the shared secret
    const aliceSecret = await aliceX3DH(aliceIdentity, aliceEphemeral, bobBundle);

    // 5. Bob receives Alice's parameters and calculates the shared secret
    const bobSecret = await bobX3DH(
      bobIdentity,
      bobSignedPrekey,
      null, // No OPK
      aliceIdentity.publicKey,
      aliceEphemeral.publicKey
    );

    expect(aliceSecret).toEqual(bobSecret);
    expect(aliceSecret.length).toBe(32);
  });
});

describe('Identity generation & signed prekey verification', () => {
  it('generateIdentity() should produce a signing keypair, DH identity keypair, a signed prekey, and 10 one-time prekeys', async () => {
    await ensureReady();
    const bob = await generateIdentity();

    expect(bob.signingIdentityKeyPair.publicKey).toBeDefined();
    expect(bob.dhIdentityKeyPair.publicKey).toBeDefined();
    expect(bob.signedPrekeyKeyPair.publicKey).toBeDefined();
    expect(bob.signedPreKeySignature).toBeDefined();
    expect(bob.oneTimePrekeys.length).toBe(10);

    // The signing keypair and DH identity keypair must be different key material.
    expect(bob.signingIdentityKeyPair.publicKey).not.toEqual(bob.dhIdentityKeyPair.publicKey);
  });

  it('verifyPreKeySignature() should accept a genuine signature over the signed prekey', async () => {
    await ensureReady();
    const bob = await generateIdentity();

    const isValid = await verifyPreKeySignature(
      bob.signingIdentityKeyPair.publicKey,
      bob.signedPrekeyKeyPair.publicKey,
      bob.signedPreKeySignature
    );

    expect(isValid).toBe(true);
  });

  it('verifyPreKeySignature() should reject a tampered signed prekey (signature no longer matches)', async () => {
    await ensureReady();
    const bob = await generateIdentity();
    const attackerPrekey = await generateKeyPair();

    // Attacker swaps in their own signed prekey but keeps Bob's original signature.
    const isValid = await verifyPreKeySignature(
      bob.signingIdentityKeyPair.publicKey,
      attackerPrekey.publicKey, // wrong key, signature won't match
      bob.signedPreKeySignature
    );

    expect(isValid).toBe(false);
  });

  it('verifyPreKeySignature() should reject a signature made by the wrong signing identity', async () => {
    await ensureReady();
    const bob = await generateIdentity();
    const attacker = await generateIdentity();

    const isValid = await verifyPreKeySignature(
      attacker.signingIdentityKeyPair.publicKey, // wrong identity
      bob.signedPrekeyKeyPair.publicKey,
      bob.signedPreKeySignature
    );

    expect(isValid).toBe(false);
  });

  it('initiateVerifiedSession() should throw and never attempt X3DH if the signature is invalid', async () => {
    await ensureReady();
    const aliceIdentity = await generateKeyPair();
    const aliceEphemeral = await generateKeyPair();
    const bob = await generateIdentity();
    const attackerPrekey = await generateKeyPair();

    await expect(
      initiateVerifiedSession(aliceIdentity, aliceEphemeral, {
        identityPublicKey: bob.dhIdentityKeyPair.publicKey,
        signingIdentityPublicKey: bob.signingIdentityKeyPair.publicKey,
        signedPrekey: attackerPrekey.publicKey, // tampered
        signedPreKeySignature: bob.signedPreKeySignature,
      })
    ).rejects.toThrow("SECURITY: signed prekey signature verification failed");
  });

  it('initiateVerifiedSession() should succeed and match bobX3DH when the signature is genuine', async () => {
    await ensureReady();
    const aliceIdentity = await generateKeyPair();
    const aliceEphemeral = await generateKeyPair();
    const bob = await generateIdentity();

    const aliceSecret = await initiateVerifiedSession(aliceIdentity, aliceEphemeral, {
      identityPublicKey: bob.dhIdentityKeyPair.publicKey,
      signingIdentityPublicKey: bob.signingIdentityKeyPair.publicKey,
      signedPrekey: bob.signedPrekeyKeyPair.publicKey,
      signedPreKeySignature: bob.signedPreKeySignature,
      oneTimePrekey: bob.oneTimePrekeys[0].publicKey,
    });

    const bobSecret = await bobX3DH(
      bob.dhIdentityKeyPair,
      bob.signedPrekeyKeyPair,
      bob.oneTimePrekeys[0],
      aliceIdentity.publicKey,
      aliceEphemeral.publicKey
    );

    expect(aliceSecret).toEqual(bobSecret);
  });
});
