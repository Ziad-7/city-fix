import React from 'react';
import { Icon } from '../Icon';
import type { AdminIconName } from '../admin-icon-shapes';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
  as?: 'section' | 'aside' | 'div';
  labelledBy?: string;
  style?: React.CSSProperties;
  action?: React.ReactNode;
}

export function Card({ children, className = '', padded = true, as = 'section', labelledBy, style, action }: CardProps) {
  const classes = ['ftc-card', !padded && 'is-unpadded', className].filter(Boolean).join(' ');
  const Comp = as as React.ElementType;

  return (
    <Comp className={classes} aria-labelledby={labelledBy} style={style}>
      {children}
      {action}
    </Comp>
  );
}

export interface CardHeadProps {
  id?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: AdminIconName;
  action?: React.ReactNode;
}

export function CardHead({ id, title, subtitle, icon, action }: CardHeadProps) {
  return (
    <div className="card-head">
      <div>
        <h2 className="sec-title" id={id}>
          {icon && <Icon name={icon} />}
          {title}
        </h2>
        {subtitle && <p className="sec-sub">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
