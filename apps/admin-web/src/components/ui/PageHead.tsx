import { Icon } from '../Icon';

export interface PageHeadProps {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  search?: {
    value: string;
    onChange: (v: string) => void;
    onSubmit?: () => void;
    placeholder: string;
    ariaLabel: string;
  };
}

export function PageHead({ title, subtitle, actions, search }: PageHeadProps) {
  return (
    <header className="page-head">
      <div className="grow">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions}
      {search && (
        <label className="search">
          <Icon name="search" size={18} />
          <input
            aria-label={search.ariaLabel}
            placeholder={search.placeholder}
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search.onSubmit?.()}
          />
        </label>
      )}
    </header>
  );
}
