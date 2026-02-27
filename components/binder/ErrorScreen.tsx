// components/binder/ErrorScreen.tsx
import React from 'react';
import { Button } from '@/components/ui/button';

interface ErrorScreenProps {
  error: string;
  onRetry?: () => void;
}

export const ErrorScreen: React.FC<ErrorScreenProps> = ({ 
  error, 
  onRetry 
}) => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-2">
          Error Loading Binder
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">{error}</p>
        <Button 
          onClick={onRetry || (() => window.location.reload())} 
          variant="outline"
        >
          Try Again
        </Button>
      </div>
    </div>
  );
};