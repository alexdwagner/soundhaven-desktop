"use client";

import React, { useRef } from 'react';
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { FaSort, FaSortUp, FaSortDown } from 'react-icons/fa';
import TrackItem from "./TrackItem";
import { Track } from "../../../../../shared/types";

export type SortColumn = 'name' | 'artistName' | 'albumName' | 'year' | 'duration';
export type SortDirection = 'asc' | 'desc';

interface TracksTableProps {
  tracks: Track[];
  onSelectTrack: (trackId: string, event?: React.MouseEvent) => void;
  onPlayTrack: (trackId: string) => void;
  selectedTrackIds: string[];
  onReorderTracks: (startIndex: number, endIndex: number) => void;
  onRemoveFromPlaylist?: (trackId: string) => void;
  isPlaylistView?: boolean;
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
  playlistSortMode = 'manual',
  onContextMenu,
  sortColumn,
  sortDirection = 'asc',
  onSort,
}) => {
  // Add ref to track the last drag operation and prevent duplicates
  const lastDragRef = useRef<{ activeId: any; overId: any; timestamp: number } | null>(null);

  // Only allow drag and drop in playlist view when in manual mode
  const isDragEnabled = isPlaylistView && playlistSortMode === 'manual';

  // Add debugging
  console.log('🔧 [TRACKS TABLE] isDragEnabled:', isDragEnabled, 'isPlaylistView:', isPlaylistView, 'playlistSortMode:', playlistSortMode);

  const handleDragStart = (event: any) => {
    const { active } = event;
    console.log('🔄 [TRACK SORT] Drag started:', { activeId: active.id });
    console.log('🔄 [TRACK SORT] Active element:', active);
    console.log('🔄 [TRACK SORT] Tracks in SortableContext:', tracks.map(t => t.id));
  };

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    console.log('🔄 [TRACK SORT] Drag ended:', { activeId: active.id, overId: over?.id });
    console.log('🔄 [TRACK SORT] Full event:', event);
    console.log('🔄 [TRACK SORT] Available tracks:', tracks.map(t => ({ id: t.id, name: t.name })));
    
    // Don't process if drag is not enabled
    if (!isDragEnabled) {
      console.log('🔄 [TRACK SORT] Drag not enabled, skipping');
      return;
    }
    
    // Prevent processing if no valid drop target
    if (!active || !over || active.id === over.id) {
      console.log('🔄 [TRACK SORT] No valid drop or same position, skipping');
      return;
    }

    // Prevent duplicate operations within a short timeframe
    const now = Date.now();
    const lastDrag = lastDragRef.current;
    if (lastDrag && 
        lastDrag.activeId === active.id && 
        lastDrag.overId === over.id && 
        now - lastDrag.timestamp < 500) { // 500ms debounce
      console.log('🔄 [TRACK SORT] Duplicate drag detected, skipping');
      return;
    }

    // Update the last drag tracking
    lastDragRef.current = { activeId: active.id, overId: over.id, timestamp: now };

    const oldIndex = tracks.findIndex((track) => track.id === active.id);
    const newIndex = tracks.findIndex((track) => track.id === over.id);
    
    console.log('🔄 [TRACK SORT] Track lookup results:', {
      activeId: active.id,
      overId: over.id,
      oldIndex,
      newIndex,
      activeTrack: tracks[oldIndex],
      overTrack: tracks[newIndex]
    });
    
    // Validate indices
    if (oldIndex === -1 || newIndex === -1) {
      console.error('🔄 [TRACK SORT] Invalid track indices:', { oldIndex, newIndex, activeId: active.id, overId: over.id });
      return;
    }

    console.log('🔄 [TRACK SORT] Moving track from index', oldIndex, 'to', newIndex);
    console.log('🔄 [TRACK SORT] Track being moved:', tracks[oldIndex]?.name);
    
    console.log('🔄 [TRACK SORT] About to call onReorderTracks with:', { oldIndex, newIndex });
    console.log('🔄 [TRACK SORT] onReorderTracks function:', typeof onReorderTracks, onReorderTracks);
    
    try {
      console.log('🔄 [TRACK SORT] Calling onReorderTracks...');
      await onReorderTracks(oldIndex, newIndex);
      console.log('🔄 [TRACK SORT] onReorderTracks completed successfully');
    } catch (error) {
      console.error('❌ [TRACK SORT] Error in onReorderTracks:', error);
      console.error('❌ [TRACK SORT] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    }
  };

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

  return (
    <>
      {isDragEnabled ? (
        <DndContext 
          collisionDetection={closestCenter} 
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext 
            items={tracks.map((track) => track.id)} 
            strategy={verticalListSortingStrategy}
          >
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <SortableHeader column="name">Title</SortableHeader>
                  <SortableHeader column="artistName">Artist</SortableHeader>
                  <SortableHeader column="albumName">Album</SortableHeader>
                  <SortableHeader column="year">Year</SortableHeader>
                  <SortableHeader column="duration">Duration</SortableHeader>
                  {isPlaylistView && (
                    <th className="px-3 py-1 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  )}
                </tr>
              </thead>

              <tbody className="bg-white divide-y divide-gray-200">
                {tracks.map((track, index) => (
                  <TrackItem
                    key={track.id}
                    track={track}
                    index={index}
                    onSelectTrack={onSelectTrack}
                    onPlayTrack={onPlayTrack}
                    isSelected={selectedTrackIds.includes(track.id)}
                    onRemoveFromPlaylist={onRemoveFromPlaylist}
                    isPlaylistView={isPlaylistView}
                    isDragEnabled={isDragEnabled}
                    onContextMenu={onContextMenu}
                  />
                ))}
              </tbody>
            </table>
          </SortableContext>
        </DndContext>
      ) : (
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <SortableHeader column="name">Title</SortableHeader>
              <SortableHeader column="artistName">Artist</SortableHeader>
              <SortableHeader column="albumName">Album</SortableHeader>
              <SortableHeader column="year">Year</SortableHeader>
              <SortableHeader column="duration">Duration</SortableHeader>
              {isPlaylistView && (
                <th className="px-3 py-1 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              )}
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-gray-200">
            {tracks.map((track, index) => (
              <TrackItem
                key={track.id}
                track={track}
                index={index}
                onSelectTrack={onSelectTrack}
                onPlayTrack={onPlayTrack}
                isSelected={selectedTrackIds.includes(track.id)}
                onRemoveFromPlaylist={onRemoveFromPlaylist}
                isPlaylistView={isPlaylistView}
                isDragEnabled={isDragEnabled}
                onContextMenu={onContextMenu}
              />
            ))}
          </tbody>
        </table>
      )}
    </>
  );
};

export default TracksTable;
