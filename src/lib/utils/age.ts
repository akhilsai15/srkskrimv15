// Date of Birth validation helpers.
//
// Policy applied (kept in one place so it's consistent everywhere DOB is collected):
// - Absolute floor: 13 years old. This matches the general global baseline used by
//   most platforms (COPPA in the US, GDPR "information society services" floor in the EU)
//   and is also consistent with India's IT Rules requirement that intermediaries not
//   knowingly allow children under 13 to create accounts without guardian consent.
// - 13-17 year olds are allowed to sign up, but are flagged as a "minor" account.
//   Under India's DPDP Act, 2023, anyone under 18 is legally a "child" and processing
//   their data requires verifiable parental/guardian consent. Since this is a mock/demo
//   auth flow with no real guardian-consent backend, we surface a clear consent
//   checkbox at signup instead of silently treating 13-17 the same as an adult.
// - No future dates, and no unrealistic dates (>120 years old).

export interface DOBValidationResult {
  valid: boolean;
  error?: string;
  age?: number;
  isMinor?: boolean; // true if 13-17 (allowed, but flagged)
}

export const MIN_AGE = 13;
export const MINOR_UPPER_AGE = 18; // below this, treated as a minor per DPDP Act, 2023
export const MAX_AGE = 120;

export function calculateAge(dob: string | Date): number {
  const birthDate = typeof dob === 'string' ? new Date(dob) : dob;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export function validateDOB(dobString: string): DOBValidationResult {
  if (!dobString) {
    return { valid: false, error: 'Please enter your date of birth' };
  }

  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) {
    return { valid: false, error: 'Please enter a valid date' };
  }

  const today = new Date();
  if (dob > today) {
    return { valid: false, error: 'Date of birth cannot be in the future' };
  }

  const age = calculateAge(dob);

  if (age > MAX_AGE) {
    return { valid: false, error: 'Please enter a valid date of birth' };
  }

  if (age < MIN_AGE) {
    return { valid: false, error: `You must be at least ${MIN_AGE} years old to use SkrimChat` };
  }

  const isMinor = age < MINOR_UPPER_AGE;
  return { valid: true, age, isMinor };
}

// YYYY-MM-DD bounds to hand straight to a <input type="date" min={} max={}>
export function dobInputBounds() {
  const today = new Date();
  const max = new Date(today.getFullYear() - MIN_AGE, today.getMonth(), today.getDate());
  const min = new Date(today.getFullYear() - MAX_AGE, today.getMonth(), today.getDate());
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return { min: fmt(min), max: fmt(max) };
}
