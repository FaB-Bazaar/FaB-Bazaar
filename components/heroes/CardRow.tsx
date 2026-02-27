"use client";

import React, { PropsWithChildren } from "react";

type Props = PropsWithChildren<{
  className?: string;
}>;

export default function CardRow({ children, className = "" }: Props) {
  return (
    <div
      className={`flex flex-wrap justify-center gap-4 ${className}`}
    >
      {children}
    </div>
  );
}
