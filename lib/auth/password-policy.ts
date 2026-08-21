export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_REQUIREMENT =
  "Minimum 8 characters with uppercase, lowercase, a number, and a symbol.";

export function isStrongPassword(value: string) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(value);
}
