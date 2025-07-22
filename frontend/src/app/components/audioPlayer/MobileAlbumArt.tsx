"use client";

import React from "react";
import { Track } from "../../../../../shared/types";

interface MobileAlbumArtProps {
  track: Track | null;
  onTap: () => void;
}

const MobileAlbumArt: React.FC<MobileAlbumArtProps> = ({ track, onTap }) => {
  if (!track) {
    return (
      <div 
        className="w-14 h-14 bg-gray-200 rounded-lg flex items-center justify-center cursor-pointer"
        onClick={onTap}
      >
        <svg className="w-7 h-7 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
      </div>
    );
  }

  return (
    <div 
      className="w-14 h-14 rounded-lg overflow-hidden cursor-pointer shadow-sm hover:shadow-md transition-shadow"
      onClick={onTap}
    >
      <img
        src={`/api/album-art/${track.id}`}
        alt={`Album art for ${track.name}`}
        className="w-full h-full object-cover"
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTYiIGhlaWdodD0iNTYiIHZpZXdCb3g9IjAgMCA1NiA1NiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjU2IiBoZWlnaHQ9IjU2IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yOCAyMUMyNS4yNCAyMSAyMyAyMy4yNCAyMyAyNkMyMyAyOC43NiAyNS4yNCAzMSAyOCAzMUMyOC43NiAzMSAzMSAyOC43NiAzMSAyNkMzMSAyMy4yNCAyOC43NiAyMSAyOCAyMVoiIGZpbGw9IiM5QjlCQTAiLz4KPHBhdGggZD0iTTI4IDM1QzI1LjI0IDM1IDIzIDM3LjI0IDIzIDQwQzIzIDQyLjc2IDI1LjI0IDQ1IDI4IDQ1QzI4Ljc2IDQ1IDMxIDQyLjc2IDMxIDQwQzMxIDM3LjI0IDI4Ljc2IDM1IDI4IDM1WiIgZmlsbD0iIzlCOUJBQCIvPgo8L3N2Zz4K';
        }}
      />
    </div>
  );
};

export default MobileAlbumArt; 