import React from 'react';

interface AmbientBackgroundProps {
  enabled: boolean;
  isDucking: boolean;
}

const AmbientBackground: React.FC<AmbientBackgroundProps> = () => {
  // Ambient audio removed per user request.
  return null;
};

export default AmbientBackground;