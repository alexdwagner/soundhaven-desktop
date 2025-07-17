import React, { useState, useRef, useEffect } from 'react';
import { FaEye, FaEyeSlash, FaCog, FaRedo } from 'react-icons/fa';
import { ColumnVisibility } from '@/app/hooks/useColumnVisibility';

interface ColumnVisibilityControlProps {
  columnVisibility: ColumnVisibility;
  onToggleColumn: (column: keyof ColumnVisibility) => void;
  onResetToDefault: () => void;
}

const ColumnVisibilityControl: React.FC<ColumnVisibilityControlProps> = ({
  columnVisibility,
  onToggleColumn,
  onResetToDefault,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const columnLabels: Record<keyof ColumnVisibility, string> = {
    name: 'Title',
    artistName: 'Artist',
    albumName: 'Album',
    year: 'Year',
    duration: 'Duration',
    tags: 'Tags',
    genre: 'Genre',
    mood: 'Mood',
  };

  const requiredColumns = ['name', 'artistName'];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
        title="Column Visibility"
      >
        <FaCog size={14} />
        <span>Columns</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10">
          <div className="p-2 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Show Columns</span>
              <button
                onClick={onResetToDefault}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                title="Reset to default"
              >
                <FaRedo size={10} />
                Reset
              </button>
            </div>
          </div>
          
          <div className="max-h-64 overflow-y-auto">
            {Object.entries(columnVisibility).map(([column, visible]) => {
              const isRequired = requiredColumns.includes(column);
              return (
                <div
                  key={column}
                  className={`flex items-center justify-between px-3 py-2 hover:bg-gray-50 ${
                    isRequired ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                  }`}
                  onClick={() => !isRequired && onToggleColumn(column as keyof ColumnVisibility)}
                >
                  <span className="text-sm text-gray-700">
                    {columnLabels[column as keyof ColumnVisibility]}
                    {isRequired && <span className="text-xs text-gray-500 ml-1">(required)</span>}
                  </span>
                  <div className="flex items-center">
                    {visible ? (
                      <FaEye className="text-blue-600" size={14} />
                    ) : (
                      <FaEyeSlash className="text-gray-400" size={14} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ColumnVisibilityControl; 