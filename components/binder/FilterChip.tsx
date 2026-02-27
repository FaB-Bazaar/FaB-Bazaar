// components/binder/FilterChip.tsx
import React from 'react';
import { X } from 'lucide-react';

interface FilterChipProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
  onRemove: () => void;
}

export const FilterChip: React.FC<FilterChipProps> = ({ 
  label, 
  isActive, 
  onClick, 
  onRemove 
}) => (
  <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${
    isActive 
      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-700' 
      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600'
  }`}>
    <button onClick={onClick} className="hover:underline">
      {label}
    </button>
    {isActive && (
      <button onClick={onRemove} className="hover:text-red-600 dark:hover:text-red-400">
        <X className="w-3 h-3" />
      </button>
    )}
  </div>
);