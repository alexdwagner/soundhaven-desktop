import React, { useState } from 'react';
import { Track } from '../../../../../shared/types';
import { useTracks } from '../../hooks/UseTracks';

interface EditTrackFormProps {
  track: Track;
  closeModal: () => void;
  fetchTracks: () => void;
}

const EditTrackForm: React.FC<EditTrackFormProps> = ({ track, closeModal, fetchTracks }) => {
  const { updateTrackMetadata } = useTracks();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: track.name || '',
    artistName: track.artistName || track.artist?.name || '',
    albumName: track.albumName || track.album?.name || '',
    year: track.year?.toString() || '',
    genre: track.genre || '',
    trackNumber: track.trackNumber?.toString() || '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    
    try {
      const payload = {
        name: formData.name.trim(),
        artistName: formData.artistName.trim(),
        albumName: formData.albumName.trim(),
        year: formData.year ? parseInt(formData.year) : undefined,
        genre: formData.genre.trim() || undefined,
        trackNumber: formData.trackNumber ? parseInt(formData.trackNumber) : undefined,
      };
  
      console.log('Submitting track metadata update:', payload);
      await updateTrackMetadata(track.id, payload);
      console.log("Track metadata updated successfully.");
      
      closeModal();
      fetchTracks();
    } catch (error) {
      console.error("Failed to update track metadata:", error);
      setError(error instanceof Error ? error.message : 'Failed to update track metadata');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Edit Track Metadata</h2>
      
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Track Title */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Track Title *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter track title"
          />
        </div>

        {/* Artist Name */}
        <div>
          <label htmlFor="artistName" className="block text-sm font-medium text-gray-700 mb-1">
            Artist
          </label>
          <input
            type="text"
            id="artistName"
            name="artistName"
            value={formData.artistName}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter artist name"
          />
        </div>

        {/* Album Name */}
        <div>
          <label htmlFor="albumName" className="block text-sm font-medium text-gray-700 mb-1">
            Album
          </label>
          <input
            type="text"
            id="albumName"
            name="albumName"
            value={formData.albumName}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter album name"
          />
        </div>

        {/* Year and Track Number Row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="year" className="block text-sm font-medium text-gray-700 mb-1">
              Year
            </label>
            <input
              type="number"
              id="year"
              name="year"
              value={formData.year}
              onChange={handleChange}
              min="1900"
              max={new Date().getFullYear()}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="YYYY"
            />
          </div>
          
          <div>
            <label htmlFor="trackNumber" className="block text-sm font-medium text-gray-700 mb-1">
              Track #
            </label>
            <input
              type="number"
              id="trackNumber"
              name="trackNumber"
              value={formData.trackNumber}
              onChange={handleChange}
              min="1"
              max="999"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="1"
            />
          </div>
        </div>

        {/* Genre */}
        <div>
          <label htmlFor="genre" className="block text-sm font-medium text-gray-700 mb-1">
            Genre
          </label>
          <input
            type="text"
            id="genre"
            name="genre"
            value={formData.genre}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter genre"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={closeModal}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !formData.name.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditTrackForm;
