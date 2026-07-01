"use client";

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from "lucide-react";

interface BinderVisibilitySettingsProps {
  visibility: any;
  onVisibilityChange: (newVisibility: any) => void;
}

export default function BinderVisibilitySettings({ visibility, onVisibilityChange }: BinderVisibilitySettingsProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleLevelChange = (level: string) => {
    const newVisibility = { ...visibility, level };
    // Auto-update permissions based on the main level
    const isPublic = level === 'public';
    const isUnlisted = level === 'unlisted';
    newVisibility.allowInSearch = isPublic;
    newVisibility.allowInMatching = isPublic || isUnlisted;
    newVisibility.allowDiscordCommands = isPublic || isUnlisted;
    newVisibility.allowMcpFeatures = isPublic || isUnlisted;
    newVisibility.allowWebhooks = isPublic || isUnlisted;
    onVisibilityChange(newVisibility);
  };

  const handleAdvancedChange = (field: string, value: boolean) => {
    onVisibilityChange({ ...visibility, [field]: value });
  };

  return (
    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Visibility:</label>
        <select 
          value={visibility.level}
          onChange={e => handleLevelChange(e.target.value)}
          className="text-sm px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-300 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="public">Public</option>
          <option value="unlisted">Unlisted</option>
          <option value="private">Private</option>
        </select>
      </div>
      
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
        {visibility.level === 'public' && "Visible to everyone and appears in searches."}
        {visibility.level === 'unlisted' && "Anyone with the link can view; hidden from search."}
        {visibility.level === 'private' && "Only you can view this binder."}
      </div>
      
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
      >
        {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        Advanced Privacy Settings
      </button>
      
      {showAdvanced && (
        <div className="mt-2 space-y-2 pl-2 border-l-2 border-gray-300 dark:border-gray-600">
          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={visibility.allowInSearch} onChange={e => handleAdvancedChange('allowInSearch', e.target.checked)} className="rounded text-blue-600 bg-gray-100 border-gray-300 dark:bg-gray-900 dark:border-gray-600 focus:ring-blue-500" />
            Show in card searches
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={visibility.allowInMatching} onChange={e => handleAdvancedChange('allowInMatching', e.target.checked)} className="rounded text-blue-600 bg-gray-100 border-gray-300 dark:bg-gray-900 dark:border-gray-600 focus:ring-blue-500" />
            Allow trade matching
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={visibility.allowDiscordCommands} onChange={e => handleAdvancedChange('allowDiscordCommands', e.target.checked)} className="rounded text-blue-600 bg-gray-100 border-gray-300 dark:bg-gray-900 dark:border-gray-600 focus:ring-blue-500" />
            Enable Discord bot commands
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={visibility.allowMcpFeatures} onChange={e => handleAdvancedChange('allowMcpFeatures', e.target.checked)} className="rounded text-blue-600 bg-gray-100 border-gray-300 dark:bg-gray-900 dark:border-gray-600 focus:ring-blue-500" />
            Enable MCP features
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={visibility.allowWebhooks} onChange={e => handleAdvancedChange('allowWebhooks', e.target.checked)} className="rounded text-blue-600 bg-gray-100 border-gray-300 dark:bg-gray-900 dark:border-gray-600 focus:ring-blue-500" />
            Enable webhooks / notifications
          </label>
        </div>
      )}
    </div>
  );
}