"use client";

import React from 'react';
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { FaSort, FaSortUp, FaSortDown } from 'react-icons/fa';
import TrackItem from "./TrackItem";
import ColumnVisibilityControl from "./ColumnVisibilityControl";
import { Track } from "../../../../../shared/types";
import { ColumnVisibility, useColumnVisibility } from '@/app/hooks/useColumnVisibility';

export type SortColumn = 'name' | 'artistName' | 'albumName' | 'year' | 'duration' | 'tags';
export type SortDirection = 'asc' | 'desc';

interface TracksTableProps {
  tracks: Track[];
  onSelectTrack: (trackId: string, event?: React.MouseEvent) => void;
  onPlayTrack: (trackId: string) => void;
  selectedTrackIds: string[];
  onReorderTracks: (startIndex: number, endIndex: number) => void;
  onRemoveFromPlaylist?: (trackId: string) => void;
  isPlaylistView?: boolean;
  currentPlaylistId?: string | null;
  playlistSortMode?: 'manual' | 'column';
  onContextMenu?: (trackId: string, x: number, y: number) => void;
  sortColumn?: SortColumn | null;
  sortDirection?: SortDirection;
  onSort?: (column: SortColumn) => void;
}

const TracksTable: React.FC<TracksTableProps> = ({
  tracks,
  onSelectTrack,
  onPlayTrack,
  selectedTrackIds,
  onReorderTracks,
  onRemoveFromPlaylist,
  isPlaylistView = false,
  currentPlaylistId = null,
  playlistSortMode = 'manual',
  onContextMenu,
  sortColumn,
  sortDirection = 'asc',
  onSort,
}) => {
  // Column visibility hook
  const { columnVisibility, toggleColumn, resetToDefault } = useColumnVisibility();

  // Enable drag for both library and playlist tracks
  // - Library tracks: can be dragged to playlists (cross-playlist operations)
  // - Playlist tracks: can be reordered (when in manual mode) or dragged to other playlists
  const isDragEnabled = isPlaylistView ? playlistSortMode === 'manual' : true; // Always enabled for library view
  
  // Add debugging
  console.log('🔧 [TRACKS TABLE] isDragEnabled:', isDragEnabled, 'isPlaylistView:', isPlaylistView, 'playlistSortMode:', playlistSortMode);



  const getSortIcon = (column: SortColumn) => {
    if (!onSort) return null;
    
    if (sortColumn === column) {
      return sortDirection === 'asc' ? (
        <FaSortUp className="ml-1 text-blue-600" size={12} />
      ) : (
        <FaSortDown className="ml-1 text-blue-600" size={12} />
      );
    }
    return <FaSort className="ml-1 text-gray-400 opacity-50 group-hover:opacity-100 transition-opacity" size={12} />;
  };

  const handleSort = (column: SortColumn) => {
    if (onSort) {
      onSort(column);
    }
  };

  // Local drag handler for track reordering (isolated from global MainContent)
  const handleLocalDragEnd = (event: any) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) {
      return;
    }

    console.log('👉 [LOCAL DRAG] Track reordering in TracksTable:', { activeId: active.id, overId: over.id });

    // Only handle reordering for playlist view
    if (isPlaylistView && playlistSortMode === 'manual' && onReorderTracks) {
      const oldIndex = tracks.findIndex(track => (track.playlist_track_id || track.id) === active.id);
      const newIndex = tracks.findIndex(track => (track.playlist_track_id || track.id) === over.id);
      
      console.log('👉 [LOCAL DRAG] Reordering from index', oldIndex, 'to', newIndex);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        onReorderTracks(oldIndex, newIndex);
      }
    }
  };

  const SortableHeader: React.FC<{ column: SortColumn; children: React.ReactNode }> = ({ column, children }) => {
    // In playlist view, only allow column sorting when in column mode
    const isColumnSortingEnabled = !isPlaylistView || playlistSortMode === 'column';
    
    if (!onSort || !isColumnSortingEnabled) {
      return (
        <th className="px-3 py-1 text-left text-xs font-medium text-gray-500 uppercase">
          <div className="flex items-center">
            {children}
            {/* Show appropriate hint based on mode */}
            {isPlaylistView && column === 'name' && (
              <span className="ml-2 text-xs text-gray-400 font-normal">
                {playlistSortMode === 'manual' ? '(Drag to reorder)' : '(Switch to Column Sort)'}
              </span>
            )}
          </div>
        </th>
      );
    }

    return (
      <th 
        className="px-3 py-1 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 group transition-colors select-none"
        onClick={() => handleSort(column)}
        title={`Sort by ${children}`}
      >
        <div className="flex items-center">
          {children}
          {getSortIcon(column)}
        </div>
      </th>
    );
  };

  const renderTableHeader = () => (
    <thead className="bg-gray-50">
      <tr>
        {columnVisibility.name && <SortableHeader column="name">Title</SortableHeader>}
        {columnVisibility.artistName && <SortableHeader column="artistName">Artist</SortableHeader>}
        {columnVisibility.albumName && <SortableHeader column="albumName">Album</SortableHeader>}
        {columnVisibility.year && <SortableHeader column="year">Year</SortableHeader>}
        {columnVisibility.duration && <SortableHeader column="duration">Duration</SortableHeader>}
        {columnVisibility.tags && <SortableHeader column="tags">Tags</SortableHeader>}
        {isPlaylistView && (
          <th className="px-3 py-1 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
        )}
      </tr>
    </thead>
  );

  const renderTableBody = () => (
    <tbody className="bg-white divide-y divide-gray-200">
      {tracks.map((track, index) => {
        const uniqueKey = track.playlist_track_id || track.id;
        return (
          <TrackItem
            key={uniqueKey}
            track={track}
            index={index}
            onSelectTrack={(_, event) => onSelectTrack(uniqueKey.toString(), event)}
            onPlayTrack={() => onPlayTrack(uniqueKey.toString())}
            isSelected={selectedTrackIds.includes(uniqueKey.toString())}
            selectedTrackIds={selectedTrackIds}
            allTracks={tracks}
            onRemoveFromPlaylist={onRemoveFromPlaylist}
            isPlaylistView={isPlaylistView}
            currentPlaylistId={currentPlaylistId}
            isDragEnabled={isDragEnabled}
            onContextMenu={onContextMenu}
            columnVisibility={columnVisibility}
          />
        );
      })}
    </tbody>
  );

  return (
    <div className="space-y-2">
      {/* Column Visibility Controls */}
      <div className="flex justify-end">
        <ColumnVisibilityControl
          columnVisibility={columnVisibility}
          onToggleColumn={toggleColumn}
          onResetToDefault={resetToDefault}
        />
      </div>

      {/* Table */}
      {isPlaylistView && playlistSortMode === 'manual' ? (
        // Isolated DndContext for track reordering (no snapback)
        <DndContext 
          collisionDetection={closestCenter}
          onDragEnd={handleLocalDragEnd}
        >
          <SortableContext 
            items={tracks.map((track) => track.playlist_track_id || track.id)} 
            strategy={verticalListSortingStrategy}
          >
            <table className="min-w-full divide-y divide-gray-200">
              {renderTableHeader()}
              {renderTableBody()}
            </table>
          </SortableContext>
        </DndContext>
      ) : (
        // No local DndContext for library view (uses global one for cross-playlist drag)
        <SortableContext 
          items={tracks.map((track) => track.playlist_track_id || track.id)} 
          strategy={verticalListSortingStrategy}
        >
          <table className="min-w-full divide-y divide-gray-200">
            {renderTableHeader()}
            {renderTableBody()}
          </table>
        </SortableContext>
      )}
    </div>
  );
};

export default TracksTable;
