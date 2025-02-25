import React, { useState } from 'react';
import { Track } from '../../types/types';
import { useTracks } from '@/hooks/UseTracks';

interface EditTrackFormProps {
  track: Track;
  closeModal: () => void;
  fetchTracks: () => void;
}

const EditTrackForm: React.FC<EditTrackFormProps> = ({ track, closeModal, fetchTracks }) => {
  const { updateTrackMetadata } = useTracks();
  const [name, setName] = useState(track.name);
  const [artistName, setArtistName] = useState(track.artist?.name || '');
  const [albumName, setAlbumName] = useState(track.album?.name || '');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Update the state based on input name
    const { name, value } = e.target;
    if (name === 'name') setName(value);
    else if (name === 'artistName') setArtistName(value);
    else if (name === 'albumName') setAlbumName(value);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: name, // from state
        artistName: artistName, // from state
        albumName: albumName, // from state
      };
  
      console.log('Submitting with payload:', payload);
      await updateTrackMetadata(track.id, payload);
      console.log("Track metadata updated successfully.");
      closeModal();
      fetchTracks();
    } catch (error) {
      console.error("Failed to update track metadata:", error);
    }
  };
  

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-center">
      <h2 className="text-2xl font-bold mb-4">Edit Metadata</h2>
      <div className="mb-4">
        <label className="block mb-1">
          Title:
          <input
            name="name"
            value={name} // Use the state variable directly
            onChange={handleChange}
            className="border border-gray-300 rounded px-2 py-1 ml-2"
          />
        </label>
      </div>
      <div className="mb-4">
        <label className="block mb-1">
          Artist:
          <input
            name="artistName"
            value={artistName} // Use the state variable directly
            onChange={handleChange}
            className="border border-gray-300 rounded px-2 py-1 ml-2"
          />
        </label>
      </div>
      <div className="mb-4">
        <label className="block mb-1">
          Album:
          <input
            name="albumName"
            value={albumName} // Use the state variable directly
            onChange={handleChange}
            className="border border-gray-300 rounded px-2 py-1 ml-2"
          />
        </label>
      </div>
      <button
        type="submit"
        className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
      >
        Save
      </button>
    </form>
  );
};

export default EditTrackForm;
