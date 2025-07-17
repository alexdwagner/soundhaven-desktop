import React, { useState, useRef, useEffect } from 'react';
import { FaPlus, FaTimes, FaTag, FaUser, FaRobot, FaCog } from 'react-icons/fa';
import { Track, Tag } from '../../../../../shared/types';
import { useTags } from '@/app/hooks/useTags';

interface InlineTagInputProps {
  track: Track;
  onTagsChange?: (tags: Tag[]) => void;
}

const InlineTagInput: React.FC<InlineTagInputProps> = ({ track, onTagsChange }) => {
  const { tags: allTags, createTag, addTagToTrack, removeTagFromTrack } = useTags();
  const [trackTags, setTrackTags] = useState<Tag[]>(track.tags || []);
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Filter available tags for suggestions
  const availableTags = allTags.filter(tag => 
    !trackTags.some(trackTag => trackTag.id === tag.id) &&
    tag.name.toLowerCase().includes(inputValue.toLowerCase())
  );

  // Get icon for tag type
  const getTagIcon = (type: string) => {
    switch (type) {
      case 'manual': return <FaUser size={8} />;
      case 'auto': return <FaRobot size={8} />;
      case 'system': return <FaCog size={8} />;
      default: return <FaTag size={8} />;
    }
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    setShowSuggestions(value.length > 0);
  };

  // Handle key press
  const handleKeyPress = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      await handleCreateAndAddTag();
    } else if (e.key === 'Escape') {
      setInputValue('');
      setShowSuggestions(false);
    }
  };

  // Handle creating and adding a new tag
  const handleCreateAndAddTag = async () => {
    if (!inputValue.trim() || isCreating) return;

    setIsCreating(true);
    try {
      // Check if tag already exists
      const existingTag = allTags.find(tag => 
        tag.name.toLowerCase() === inputValue.trim().toLowerCase()
      );

      let tagToAdd: Tag;
      
      if (existingTag) {
        tagToAdd = existingTag;
      } else {
        // Create new tag
        tagToAdd = await createTag({
          name: inputValue.trim(),
          color: '#6B7280',
          type: 'manual'
        });
      }

      // Add to track
      await addTagToTrack(track.id, tagToAdd.id);
      
      // Update local state
      const updatedTags = [...trackTags, tagToAdd];
      setTrackTags(updatedTags);
      onTagsChange?.(updatedTags);
      
      // Clear input
      setInputValue('');
      setShowSuggestions(false);
    } catch (error) {
      console.error('Failed to create and add tag:', error);
    } finally {
      setIsCreating(false);
    }
  };

  // Handle adding existing tag
  const handleAddExistingTag = async (tag: Tag) => {
    try {
      await addTagToTrack(track.id, tag.id);
      const updatedTags = [...trackTags, tag];
      setTrackTags(updatedTags);
      onTagsChange?.(updatedTags);
      setInputValue('');
      setShowSuggestions(false);
    } catch (error) {
      console.error('Failed to add existing tag:', error);
    }
  };

  // Handle removing tag
  const handleRemoveTag = async (tagId: string) => {
    try {
      await removeTagFromTrack(track.id, tagId);
      const updatedTags = trackTags.filter(tag => tag.id !== tagId);
      setTrackTags(updatedTags);
      onTagsChange?.(updatedTags);
    } catch (error) {
      console.error('Failed to remove tag:', error);
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update track tags when track changes
  useEffect(() => {
    setTrackTags(track.tags || []);
  }, [track.tags]);

  return (
    <div className="space-y-2">
      {/* Current Tags */}
      <div className="flex flex-wrap gap-2">
        {trackTags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full text-white"
            style={{ backgroundColor: tag.color }}
            title={`${tag.name} (${tag.type}${tag.confidence ? `, ${Math.round(tag.confidence * 100)}%` : ''})`}
          >
            {getTagIcon(tag.type)}
            {tag.name}
            <button
              onClick={() => handleRemoveTag(tag.id)}
              className="hover:text-red-200 ml-1"
              title="Remove tag"
            >
              <FaTimes size={8} />
            </button>
          </span>
        ))}
      </div>

      {/* Input Section */}
      <div className="relative" ref={suggestionsRef}>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyPress}
            onFocus={() => inputValue && setShowSuggestions(true)}
            placeholder="Type a tag name and press Enter..."
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isCreating}
          />
          <button
            onClick={handleCreateAndAddTag}
            disabled={!inputValue.trim() || isCreating}
            className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            <FaPlus size={10} />
            {isCreating ? 'Adding...' : 'Add'}
          </button>
        </div>

        {/* Suggestions Dropdown */}
        {showSuggestions && inputValue && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-40 overflow-y-auto z-10">
            {availableTags.length > 0 ? (
              <>
                {availableTags.slice(0, 5).map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => handleAddExistingTag(tag)}
                    className="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center gap-2"
                  >
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full text-white"
                      style={{ backgroundColor: tag.color }}
                    >
                      {getTagIcon(tag.type)}
                      {tag.name}
                    </span>
                    <span className="text-xs text-gray-500">({tag.type})</span>
                  </button>
                ))}
                {!allTags.some(tag => tag.name.toLowerCase() === inputValue.toLowerCase()) && (
                  <div className="px-3 py-2 text-sm text-gray-500 border-t border-gray-100">
                    Press Enter to create "{inputValue}"
                  </div>
                )}
              </>
            ) : (
              <div className="px-3 py-2 text-sm text-gray-500">
                Press Enter to create "{inputValue}"
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default InlineTagInput; 