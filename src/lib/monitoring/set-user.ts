import * as Sentry from "@sentry/nextjs";

export interface UserContext {
  id: string;
  email?: string;
  username?: string;
  [key: string]: unknown;
}

export function setUser(user: UserContext | null): void {
  if (user) {
    Sentry.setUser({
      ...user,
    });
  } else {
    Sentry.setUser(null);
  }
}

export default setUser;
