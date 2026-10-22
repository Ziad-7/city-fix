import React, { forwardRef } from 'react';
import Link from 'next/link';
import { Icon } from '../Icon';
import type { AdminIconName } from '../admin-icon-shapes';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'gold' | 'ghost';
  size?: 'md' | 'sm';
  block?: boolean;
  loading?: boolean;
  icon?: AdminIconName;
  href?: string;
}

const ButtonBase = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', block, loading, icon, className = '', children, ...props }, ref) => {
    const classes = [
      'ftc-btn',
      `ftc-btn--${variant}`,
      size === 'sm' && 'ftc-btn--sm',
      block && 'ftc-btn--block',
      loading && 'is-loading',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const iconNode = loading ? <span className="ftc-spinner" aria-hidden /> : icon ? <Icon name={icon} size={size === 'sm' ? 16 : 20} /> : null;

    if ('href' in props && props.href) {
      // For Link, only pass safe props (not button-specific event handlers/attributes)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { disabled, ...linkPropsRest } = props;
      return (
        <Link
          ref={ref as React.Ref<HTMLAnchorElement>}
          href={props.href}
          className={classes}
          onClick={('onClick' in linkPropsRest && linkPropsRest.onClick) as React.MouseEventHandler<HTMLAnchorElement> | undefined}
        >
          {iconNode}
          {children}
        </Link>
      );
    }

    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        className={classes}
        {...props}
        aria-busy={loading}
        disabled={loading || props.disabled}
      >
        {iconNode}
        {children}
      </button>
    );
  },
);

ButtonBase.displayName = 'Button';

export const Button = ButtonBase as React.ForwardRefExoticComponent<ButtonProps & React.RefAttributes<HTMLButtonElement | HTMLAnchorElement>>;
