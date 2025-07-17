import { useState, useEffect } from 'react';

export interface ColumnVisibility {
  name: boolean;      // Always true (required)
  artistName: boolean; // Always true (required)
  albumName: boolean;
  year: boolean;
  duration: boolean;
  tags: boolean;
  genre: boolean;
  mood: boolean;
}

const DEFAULT_VISIBILITY: ColumnVisibility = {
  name: true,
  artistName: true,
  albumName: true,
  year: true,
  duration: true,
  tags: true,
  genre: false,
  mood: false,
};

const STORAGE_KEY = 'tracksTable_columnVisibility';

export const useColumnVisibility = () => {
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>(DEFAULT_VISIBILITY);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Ensure required columns are always visible
        setColumnVisibility({
          ...parsed,
          name: true,
          artistName: true,
        });
      }
    } catch (error) {
      console.error('Failed to load column visibility settings:', error);
    }
  }, []);

  // Save to localStorage when changed
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(columnVisibility));
    } catch (error) {
      console.error('Failed to save column visibility settings:', error);
    }
  }, [columnVisibility]);

  const toggleColumn = (column: keyof ColumnVisibility) => {
    // Prevent hiding required columns
    if (column === 'name' || column === 'artistName') {
      return;
    }

    setColumnVisibility(prev => ({
      ...prev,
      [column]: !prev[column]
    }));
  };

  const resetToDefault = () => {
    setColumnVisibility(DEFAULT_VISIBILITY);
  };

  const getVisibleColumns = () => {
    return Object.entries(columnVisibility)
      .filter(([_, visible]) => visible)
      .map(([column, _]) => column as keyof ColumnVisibility);
  };

  return {
    columnVisibility,
    toggleColumn,
    resetToDefault,
    getVisibleColumns,
  };
}; 