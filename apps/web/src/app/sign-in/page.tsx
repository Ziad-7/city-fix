import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SignIn } from './SignIn';

export const metadata: Metadata = { title: 'الدخول' };

export default function SignInPage() {
  return (
    <Suspense>
      <SignIn />
    </Suspense>
  );
}
