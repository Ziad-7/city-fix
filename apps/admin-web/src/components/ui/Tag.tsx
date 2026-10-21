export interface TagProps {
  tone: 'danger' | 'gold' | 'muted' | 'ext';
  children: React.ReactNode;
}

export function Tag({ tone, children }: TagProps) {
  return <span className={`ftc-tag-${tone}`}>{children}</span>;
}

// DangerTag is just a Tag with danger tone
export function DangerTag({ children }: { children: React.ReactNode }) {
  return <Tag tone="danger">{children}</Tag>;
}
