import React from 'react';
import { Track } from '../../../../shared/types'; // Adjust the import path as needed

interface TrackInfoProps {
  // Make track optional to handle cases where it might not be provided
  track?: Track | null;
}

const TrackInfo: React.FC<TrackInfoProps> = ({ track }) => {
  // Check if track is not provided or null and render alternative content
  if (!track) {
    return <div>Loading track information...</div>; // or any other placeholder you prefer
  }

  return (
    <div className="text-center">
      <h2 className="text-lg font-bold">{track.name || 'Unknown Track'}</h2>
      <p className="text-sm text-gray-500">{track.artist?.name || 'Unknown Artist'}</p>
      <p className="text-sm text-gray-500">{track.album?.name || 'Unknown Album'}</p>
    </div>
  );
};

export default TrackInfo;
