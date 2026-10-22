import { AppShell } from '@/ui/Shell';

/** Public: the sorting guide works without signing in, so no boot or sign-in redirect here. */
export default function RecyclingGuideLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
