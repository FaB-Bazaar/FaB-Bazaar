// lib/profile/profile-load-error.ts
//
// What to tell a visitor when the profile page fails to load. Only a 404 means
// the user does not exist; anything else is a loading problem worth retrying.

export interface ProfileLoadError {
  title: string;
  message: string;
}

/** @param status HTTP status of the failed request, or null for a network failure. */
export function describeProfileLoadError(status: number | null, username: string): ProfileLoadError {
  if (status === 404) {
    return { title: 'Profile Not Found', message: `No user found with username "${username}".` };
  }
  if (status === 429) {
    return { title: 'Too Many Requests', message: 'Please wait a minute and try again.' };
  }
  return { title: "Couldn't Load Profile", message: 'Something went wrong loading this profile. Please try again.' };
}
