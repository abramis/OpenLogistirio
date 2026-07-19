export function readSetupToken(fragment: string | null | undefined): string | null {
  if (!fragment) {
    return null;
  }

  const token = new URLSearchParams(fragment).get('token')?.trim();
  return token || null;
}
