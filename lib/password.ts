/**
 * @file lib/password.ts
 * @description The only argon2 import in the app (D5). Workers/Void port = swap this file to a WASM
 * Argon2id package; stored `$argon2id$…` hashes stay valid.
 */
import argon2 from "argon2";

/**
 * Static Argon2id hash of a throwaway string. Login verifies against it when the username doesn't
 * exist, so both failure paths cost the same. A literal on purpose: hashing at module scope
 * (64 MiB + RNG) is slow on cold start and not allowed in a Workers global scope.
 */
export const DUMMY_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$yj8ABQOu3k2MH3LO1o0GAA$0PCw0JV5stVKbdllQ/ziAQE7Z/9zh3tnOYarkDM+QaY";

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

/** false on mismatch or malformed hash; never throws. */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    return await argon2.verify(storedHash, password);
  } catch {
    return false;
  }
}
