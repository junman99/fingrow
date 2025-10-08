import React from 'react';

type ScrollContextType = {
  setScrollEnabled?: (enabled: boolean) => void;
};

export const ScrollContext = React.createContext<ScrollContextType>({});
