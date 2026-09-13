import bcrypt from "bcryptjs";

const PIN_ROUNDS = 12;

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, PIN_ROUNDS);
}

export async function verifyPin(
  pin: string,
  pinHash: string,
): Promise<boolean> {
  return bcrypt.compare(pin, pinHash);
}
