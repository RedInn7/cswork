'use client';
import { createAuthClient } from 'better-auth/react';
import { emailOTPClient } from 'better-auth/client/plugins';
import { readLocale } from './i18n';
export const authClient = createAuthClient({
  plugins: [emailOTPClient()],
  // Like api(): sign-in mails and errors follow the site language.
  fetchOptions: {
    onRequest: (context) => {
      context.headers.set('X-Locale', readLocale());
    },
  },
});
