import React from 'react';
import Image from 'next/image';

export const MathworksIcon = ({ className }: { className?: string }) => {
  return (
    <Image 
      src="/mathworks.svg"  // Make sure to move your SVG to the public folder
      alt="Mathworks"
      width={24}
      height={24}
      className={className}
    />
  );
};

export default MathworksIcon; 