"use client";

import React from 'react';

interface DuplicateTrackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  trackName?: string;
  playlistName?: string;
}

const DuplicateTrackModal: React.FC<DuplicateTrackModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  trackName, 
  playlistName 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center mb-4">
          <div className="bg-yellow-100 p-2 rounded-full mr-3">
            <svg className="w-6 h-6 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Track Already Exists</h2>
        </div>
        
        <p className="text-gray-600 mb-6">
          {trackName && playlistName ? (
            <>
              The track <span className="font-medium text-gray-900">"{trackName}"</span> already exists in 
              the playlist <span className="font-medium text-gray-900">"{playlistName}"</span>. 
              Would you still like to add it to this playlist?
            </>
          ) : (
            "This track is already in the playlist. Do you want to add it again?"
          )}
        </p>
        
        <div className="flex justify-end space-x-3">
          <button 
            onClick={onClose} 
            className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm} 
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
          >
            Add Anyway
          </button>
        </div>
      </div>
    </div>
  );
};

export default DuplicateTrackModal;