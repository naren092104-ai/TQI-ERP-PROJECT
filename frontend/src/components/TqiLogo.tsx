import React from 'react';

interface TqiLogoProps {
  size?: number | string;
  className?: string;
}

export const TqiLogo: React.FC<TqiLogoProps> = ({ size = 96, className = '' }) => {
  return (
    <img 
      src="/logo.png" 
      alt="TQI Logo" 
      width={size} 
      height={size} 
      className={`shrink-0 select-none object-contain ${className}`} 
    />
  );
};
