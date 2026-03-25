import React from 'react';

interface TensorAxIconProps {
  className?: string;
  /** When true, applies a spin animation */
  spinning?: boolean;
}

/**
 * Official TensorAx brand icon — geometric hexagonal mark.
 * Source: TensorAx_Icon.svg from brand identity library.
 */
export const TensorAxIcon: React.FC<TensorAxIconProps> = ({ className = 'w-5 h-5', spinning }) => (
  <svg
    viewBox="0 0 200.45 250.79"
    fill="currentColor"
    className={`${className} ${spinning ? 'animate-[txSpin_1.2s_ease-in-out_infinite]' : ''}`}
  >
    {/* Top chevron */}
    <polygon points="200.45 57.89 200.45 111.79 100.22 53.95 100.22 53.9 0 111.79 0 57.84 100.22 0 200.45 57.89" />
    {/* Left pillar */}
    <polygon points="40.94 109.91 40.94 227.15 0 250.79 0 133.56 40.94 109.91" />
    {/* Right pillar */}
    <polygon points="159.51 109.91 159.51 227.15 200.45 250.79 200.45 133.56 159.51 109.91" />
    {/* Centre pillar */}
    <polygon points="141.2 99.36 141.2 227.17 100.22 250.79 59.24 227.17 59.24 99.36 100.22 75.72 141.2 99.36" />
  </svg>
);
