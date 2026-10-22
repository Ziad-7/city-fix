import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SignIn } from './SignIn';

export const metadata: Metadata = { title: 'الدخول' };
// The tab title follows the language once the page loads (see SignIn).

export default function SignInPage() {
  return (
    <Suspense>
      <SignIn />
    </Suspense>
  );
}
