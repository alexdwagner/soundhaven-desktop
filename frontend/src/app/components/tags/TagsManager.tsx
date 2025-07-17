"use client";

import React, { useState, useEffect, useRef } from 'react';
import { FaTag, FaPlus, FaTimes, FaEdit, FaTrash, FaUser, FaRobot, FaCog, FaCheck } from 'react-icons/fa';
import { Track, Tag } from '../../../../../shared/types';
import { useTags } from '@/app/hooks/useTags';

interface TagsManagerProps {
  track: Track;
  onTagsChange?: (tags: Tag[]) => void;
  className?: string;
}

const TagsManager: React.FC<TagsManagerProps> = ({ track, onTagsChange, className = '' }) => {
  const { tags: allTags, createTag, updateTag, deleteTag, addTagToTrack, removeTagFromTrack, loading } = useTags();
  const [trackTags, setTrackTags] = useState<Tag[]>(track.tags || []);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6B7280');
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Common tag colors
  const tagColors = [
    '#6B7280', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', 
    '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#84CC16'
  ];

  // Filter available tags for suggestions
  const availableTags = allTags.filter(tag => 
    !trackTags.some(trackTag => trackTag.id === tag.id) &&
    tag.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get icon for tag type
  const getTagIcon = (type: string) => {
    switch (type) {
      case 'manual': return <FaUser size={10} />;
      case 'auto': return <FaRobot size={10} />;
      case 'system': return <FaCog size={10} />;
      default: return <FaTag size={10} />;
    }
  };

  // Handle adding existing tag to track
  const handleAddExistingTag = async (tag: Tag) => {
    try {
      await addTagToTrack(track.id, tag.id);
      const updatedTags = [...trackTags, tag];
      setTrackTags(updatedTags);
      onTagsChange?.(updatedTags);
      setShowSuggestions(false);
      setSearchTerm('');
    } catch (error) {
      console.error('Failed to add tag to track:', error);
    }
  };

  // Handle creating new tag
  const handleCreateNewTag = async () => {
    if (!newTagName.trim()) return;

    try {
      const newTag = await createTag({
        name: newTagName.trim(),
        color: newTagColor,
        type: 'manual'
      });

      await addTagToTrack(track.id, newTag.id);
      const updatedTags = [...trackTags, newTag];
      setTrackTags(updatedTags);
      onTagsChange?.(updatedTags);
      
      setIsAddingTag(false);
      setNewTagName('');
      setNewTagColor('#6B7280');
    } catch (error) {
      console.error('Failed to create and add tag:', error);
    }
  };

  // Handle removing tag from track
  const handleRemoveTag = async (tagId: string) => {
    try {
      await removeTagFromTrack(track.id, tagId);
      const updatedTags = trackTags.filter(tag => tag.id !== tagId);
      setTrackTags(updatedTags);
      onTagsChange?.(updatedTags);
    } catch (error) {
      console.error('Failed to remove tag from track:', error);
    }
  };

  // Handle editing tag
  const handleEditTag = async (tag: Tag, newName: string, newColor: string) => {
    try {
      const updatedTag = await updateTag(tag.id, { name: newName, color: newColor });
      const updatedTags = trackTags.map(t => t.id === tag.id ? updatedTag : t);
      setTrackTags(updatedTags);
      onTagsChange?.(updatedTags);
      setEditingTag(null);
    } catch (error) {
      console.error('Failed to edit tag:', error);
    }
  };

  // Handle deleting tag completely
  const handleDeleteTag = async (tagId: string) => {
    if (!confirm('Are you sure you want to delete this tag? It will be removed from all tracks.')) {
      return;
    }

    try {
      await deleteTag(tagId);
      const updatedTags = trackTags.filter(tag => tag.id !== tagId);
      setTrackTags(updatedTags);
      onTagsChange?.(updatedTags);
    } catch (error) {
      console.error('Failed to delete tag:', error);
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
    <div className={`space-y-2 ${className}`}>
      {/* Current Tags */}
      <div className="flex flex-wrap gap-2">
        {trackTags.map((tag) => (
          <div key={tag.id} className="relative group">
            {editingTag?.id === tag.id ? (
              <EditTagForm
                tag={tag}
                onSave={handleEditTag}
                onCancel={() => setEditingTag(null)}
                colors={tagColors}
              />
            ) : (
              <span
                className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full text-white cursor-pointer hover:opacity-80"
                style={{ backgroundColor: tag.color }}
                title={`${tag.name} (${tag.type}${tag.confidence ? `, ${Math.round(tag.confidence * 100)}%` : ''})`}
              >
                {getTagIcon(tag.type)}
                {tag.name}
                {tag.type === 'manual' && (
                  <div className="hidden group-hover:flex items-center gap-1 ml-1">
                    <button
                      onClick={() => setEditingTag(tag)}
                      className="hover:text-yellow-200"
                      title="Edit tag"
                    >
                      <FaEdit size={8} />
                    </button>
                    <button
                      onClick={() => handleDeleteTag(tag.id)}
                      className="hover:text-red-200"
                      title="Delete tag"
                    >
                      <FaTrash size={8} />
                    </button>
                  </div>
                )}
                <button
                  onClick={() => handleRemoveTag(tag.id)}
                  className="hover:text-red-200 ml-1"
                  title="Remove from track"
                >
                  <FaTimes size={8} />
                </button>
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Add Tag Section */}
      <div className="relative" ref={suggestionsRef}>
        {isAddingTag ? (
          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border">
            <input
              ref={inputRef}
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="Enter tag name"
              className="flex-1 px-2 py-1 text-sm border rounded"
              onKeyPress={(e) => e.key === 'Enter' && handleCreateNewTag()}
            />
            <div className="flex items-center gap-1">
              {tagColors.map((color) => (
                <button
                  key={color}
                  onClick={() => setNewTagColor(color)}
                  className={`w-4 h-4 rounded-full border-2 ${
                    newTagColor === color ? 'border-gray-800' : 'border-gray-300'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <button
              onClick={handleCreateNewTag}
              disabled={!newTagName.trim()}
              className="px-2 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-50"
            >
              <FaCheck size={10} />
            </button>
            <button
              onClick={() => {
                setIsAddingTag(false);
                setNewTagName('');
                setNewTagColor('#6B7280');
              }}
              className="px-2 py-1 text-xs bg-gray-600 text-white rounded"
            >
              <FaTimes size={10} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Search tags or create new..."
              className="flex-1 px-2 py-1 text-sm border rounded"
            />
            <button
              onClick={() => setIsAddingTag(true)}
              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
            >
              <FaPlus size={10} />
              New
            </button>
          </div>
        )}

        {/* Suggestions Dropdown */}
        {showSuggestions && searchTerm && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded shadow-lg max-h-48 overflow-y-auto z-10">
            {availableTags.length > 0 ? (
              availableTags.slice(0, 10).map((tag) => (
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
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-gray-500">
                No matching tags found
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Edit Tag Form Component
interface EditTagFormProps {
  tag: Tag;
  onSave: (tag: Tag, newName: string, newColor: string) => void;
  onCancel: () => void;
  colors: string[];
}

const EditTagForm: React.FC<EditTagFormProps> = ({ tag, onSave, onCancel, colors }) => {
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState(tag.color || '#6B7280');

  const handleSave = () => {
    if (name.trim()) {
      onSave(tag, name.trim(), color);
    }
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="px-2 py-1 text-xs border rounded"
        onKeyPress={(e) => e.key === 'Enter' && handleSave()}
        autoFocus
      />
      <div className="flex items-center gap-1">
        {colors.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={`w-3 h-3 rounded-full border ${
              color === c ? 'border-gray-800' : 'border-gray-300'
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <button
        onClick={handleSave}
        className="px-2 py-1 text-xs bg-green-600 text-white rounded"
      >
        <FaCheck size={8} />
      </button>
      <button
        onClick={onCancel}
        className="px-2 py-1 text-xs bg-gray-600 text-white rounded"
      >
        <FaTimes size={8} />
      </button>
    </div>
  );
};

export default TagsManager; 