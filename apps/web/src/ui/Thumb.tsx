/* eslint-disable @next/next/no-img-element -- photos are user data URLs or signed storage URLs */
import type { IconName } from '@/domain/types';
import { Icon } from './Icon';

/** Request thumbnail: the report photo when there is one, else the category icon on slate (`.w-thumb`). */
export function Thumb({ uri, icon, size = 52 }: { uri?: string; icon: IconName; size?: number }) {
  return (
    <span className="w-thumb" aria-hidden="true" style={size !== 52 ? { width: size, height: size } : undefined}>
      {uri ? <img src={uri} alt="" /> : <Icon name={icon} size={Math.round(size * 0.42)} />}
    </span>
  );
}
