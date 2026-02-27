//components/heroes/CardGrid.tsx
import React from 'react';
import { cn } from '@/lib/utils'; // Optional: for combining class names if needed

// Define the component's props. It only needs to accept 'children'.
interface CardGridProps {
  children: React.ReactNode;
  className?: string; // Allow passing extra classes for customization
}

/**
 * A simple, responsive grid container for displaying cards within hero articles.
 * It uses the special `children` prop to render whatever components are placed inside it.
 */
export default function CardGrid({ children, className }: CardGridProps) {
  return (
    // The `not-prose` class is essential. It tells Tailwind's typography plugin
    // to NOT apply article styling (like margins) to our grid, so we have full control.
    <div 
      className={cn(
        "not-prose my-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6",
        className // Allows for custom styling from the outside if ever needed
      )}
    >
      {children}
    </div>
  );
}