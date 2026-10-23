import { AppShell } from '@/ui/Shell';

/** Public: the smart bin demo works without signing in, so no boot or sign-in redirect here. */
export default function SmartBinLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
