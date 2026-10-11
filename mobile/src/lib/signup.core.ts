/** Sign-up form checks (pure). Returns a plain-language problem or null. */
export function signUpProblem(f: { name: string; email: string; password: string; agreed: boolean }): string | null {
  if (!f.name.trim()) return "Please enter your name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return "Enter a valid email address.";
  if (f.password.length < 8) return "Password must be at least 8 characters.";
  if (!f.agreed) return "Please agree to the Terms and Privacy Policy to continue.";
  return null;
}

/** Forgot-password form check (pure). */
export function resetEmailProblem(email: string): string | null {
  if (!email.trim()) return "Enter the email you signed up with.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Enter a valid email address.";
  return null;
}
