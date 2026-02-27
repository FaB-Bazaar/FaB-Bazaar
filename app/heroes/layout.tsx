import React from 'react';

// This layout simply passes its children through without any authentication checks.
// By existing, it prevents the app from using a higher-level layout (like one from app/ or app/admin/)
// for the /heroes/* routes.
export default function HeroesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}