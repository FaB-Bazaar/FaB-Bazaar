import React from 'react';

// This component uses standard React 'children' but we expect two direct children.
export default function FeaturedCardLayout({ children }: { children: React.ReactNode }) {
  const [text, card] = React.Children.toArray(children);

  return (
    <div className="not-prose my-12 flex flex-col md:flex-row items-center gap-8">
      {/* Column 1: Explanatory Text */}
      <div className="md:w-1/2 prose prose-invert">
        {text}
      </div>
      {/* Column 2: The Card Itself */}
      <div className="md:w-1/2 flex justify-center">
        {card}
      </div>
    </div>
  );
}