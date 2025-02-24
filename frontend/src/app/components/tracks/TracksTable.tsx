"use client";

import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import TrackItem from "./TrackItem";

interface TracksTableProps {
  tracks: Track[];
  onSelectTrack: (trackId: number) => void;
  setSelectedTrackId: React.Dispatch<React.SetStateAction<number | null>>;
  onReorderTracks: (startIndex: number, endIndex: number) => void;
}

const TracksTable: React.FC<TracksTableProps> = ({
  tracks,
  onSelectTrack,
  setSelectedTrackId,
  onReorderTracks,
}) => {
  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = tracks.findIndex((track) => track.id === active.id);
      const newIndex = tracks.findIndex((track) => track.id === over.id);
      onReorderTracks(oldIndex, newIndex);
    }
  };

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={tracks.map((track) => track.id)} strategy={verticalListSortingStrategy}>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Artist</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Album</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-gray-200">
            {tracks.map((track, index) => (
              <TrackItem
                key={track.id}
                track={track}
                index={index}
                onSelectTrack={onSelectTrack}
                setSelectedTrackId={setSelectedTrackId}
              />
            ))}
          </tbody>
        </table>
      </SortableContext>
    </DndContext>
  );
};

export default TracksTable;
