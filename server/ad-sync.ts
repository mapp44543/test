// AD sync was removed. This module kept as a harmless stub to avoid missing-import errors
export type ADUser = never;
export type ADProfile = never;

export async function getADUserFullName(_username: string): Promise<null> {
  return null;
}

export async function getADUserProfile(_username: string): Promise<null> {
  return null;
}