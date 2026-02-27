// components/ui/QuantityStepper.tsx

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus } from "lucide-react";
import { cn } from '@/lib/utils';

interface QuantityStepperProps {
  // The current value of the stepper
  value: number;
  // Callback function for when the value changes
  onChange: (newValue: number) => void;
  // The minimum allowed value (defaults to 1)
  minValue?: number;
  // Optional class names for custom styling
  className?: string;
  buttonClassName?: string;
  inputClassName?: string;
}

export function QuantityStepper({
  value,
  onChange,
  minValue = 1,
  className,
  buttonClassName,
  inputClassName
}: QuantityStepperProps) {
  // We use an internal state to handle the temporary empty string while the user is typing.
  const [inputValue, setInputValue] = useState<number | ''>(value);

  // This effect syncs the internal state if the external `value` prop changes.
  useEffect(() => {
    if (value !== inputValue) {
      setInputValue(value);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // This function validates and commits the new value to the parent component.
  const handleCommit = (newValue: number | '') => {
    // Determine the numeric value, defaulting to the minimum if empty.
    const numericValue = typeof newValue === 'number' ? newValue : minValue;
    // Ensure the value is not less than the minimum.
    const finalValue = Math.max(minValue, numericValue);
    
    // Call the parent's onChange if the value is different.
    if (finalValue !== value) {
      onChange(finalValue);
    }
    // Always update the input to reflect the final, validated value.
    setInputValue(finalValue);
  };

  const handleDecrement = () => {
    // Use the current input value for immediate feedback, then commit.
    handleCommit(Number(inputValue || minValue) - 1);
  };

  const handleIncrement = () => {
    handleCommit(Number(inputValue || minValue) + 1);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    // Allow the input to be empty while typing.
    if (rawValue === '') {
      setInputValue('');
    } else {
      const num = parseInt(rawValue, 10);
      if (!isNaN(num)) {
        setInputValue(num);
      }
    }
  };

  const handleBlur = () => {
    // When the user clicks away from the input, commit the change.
    handleCommit(inputValue);
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        variant="outline"
        size="icon"
        onClick={handleDecrement}
        disabled={value <= minValue}
        className={cn("h-8 w-8", buttonClassName)}
        aria-label="Decrease quantity"
      >
        <Minus className="h-4 w-4" />
      </Button>
      
      <Input
        type="number" // "number" provides mobile numeric keyboard, "text" with pattern="[0-9]*" avoids steppers
        min={minValue}
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handleBlur();
            (e.target as HTMLInputElement).blur();
          }
        }}
        className={cn("w-16 h-8 text-center text-base font-semibold", inputClassName)}
      />

      <Button
        variant="outline"
        size="icon"
        onClick={handleIncrement}
        className={cn("h-8 w-8", buttonClassName)}
        aria-label="Increase quantity"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}