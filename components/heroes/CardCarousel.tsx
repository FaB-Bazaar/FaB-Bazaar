//components/heroes/CardCarousel.tsx
"use client";

import * as React from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";

interface CardCarouselProps {
  children: React.ReactNode;
}

/**
 * A responsive carousel for displaying multiple cards in a slidable interface.
 * Now includes auto-scrolling animation with manual controls.
 */
export default function CardCarousel({ children }: CardCarouselProps) {
  const [api, setApi] = React.useState<CarouselApi>();
  const autoplayPlugin = React.useRef(
    Autoplay({ delay: 3000, stopOnInteraction: true, stopOnMouseEnter: true })
  );

  return (
    <div className="not-prose my-8 relative group max-w-6xl mx-auto">
      <Carousel
        setApi={setApi}
        opts={{
          align: "start",
          loop: true,
          slidesToScroll: 1,
        }}
        plugins={[autoplayPlugin.current]}
        className="w-full px-12"
      >
        <CarouselContent className="px-3">
          {React.Children.map(children, (child) => (
            <CarouselItem className="basis-4/5 sm:basis-1/2 md:basis-1/3 lg:basis-1/4 p-2">
              {child}
            </CarouselItem>
          ))}
        </CarouselContent>

        <CarouselPrevious
          className="
            hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 z-10
            opacity-0 group-hover:opacity-100 transition-opacity
            h-10 w-10
          "
        />
        <CarouselNext
          className="
            hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 z-10
            opacity-0 group-hover:opacity-100 transition-opacity
            h-10 w-10
          "
        />
      </Carousel>
    </div>
  );
}
