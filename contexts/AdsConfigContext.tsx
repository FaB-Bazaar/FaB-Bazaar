"use client";

import { createContext, useContext } from "react";

interface AdsConfigContextValue {
  adsEnabled: boolean;
}

const AdsConfigContext = createContext<AdsConfigContextValue>({ adsEnabled: true });

export function AdsConfigProvider({
  adsEnabled,
  children,
}: {
  adsEnabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <AdsConfigContext.Provider value={{ adsEnabled }}>
      {children}
    </AdsConfigContext.Provider>
  );
}

export function useAdsConfig() {
  return useContext(AdsConfigContext);
}
