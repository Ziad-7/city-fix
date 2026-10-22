import { Fragment } from 'react';

export interface KvListProps {
  items: {
    label: string;
    value: React.ReactNode;
    numeric?: boolean;
  }[];
}

export function KvList({ items }: KvListProps) {
  return (
    <dl className="kv">
      {items.map((i) => (
        <Fragment key={i.label}>
          <dt>{i.label}</dt>
          <dd className={i.numeric ? 'num' : undefined}>{i.value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}
