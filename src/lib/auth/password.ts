import bcrypt from "bcryptjs";

// Cost 12: each verify takes ~200-300ms; login endpoint is also rate-limited (5/min)
const BCRYPT_COST = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
