import argon2 from 'argon2';

// Password hashing using argon2id — the strongest argon2 variant.
// argon2i is resistant to side-channel attacks, argon2d to GPU attacks.
// argon2id combines both — required by OWASP for password hashing.

const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536,  // 64 MB
  timeCost: 3,
  parallelism: 1,
};

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain);
}
