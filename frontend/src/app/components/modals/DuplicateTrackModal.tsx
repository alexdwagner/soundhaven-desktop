"use client";

import React from 'react';

interface DuplicateTrackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const DuplicateTrackModal: React.FC<DuplicateTrackModalProps> = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
      <div className="bg-white p-4 rounded-lg">
        <h2 className="text-lg font-bold mb-2">Duplicate Track</h2>
        <p>This track is already in the playlist. Do you want to add it again?</p>
        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="mr-2 px-4 py-2 bg-gray-200 rounded">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 bg-blue-500 text-white rounded">Add Anyway</button>
        </div>
      </div>
    </div>
  );
};

export default DuplicateTrackModal;