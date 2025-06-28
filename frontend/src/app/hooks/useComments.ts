import { useState, useContext, useCallback, useEffect } from 'react';
import CommentsContext from '../contexts/CommentsContext';
// import { CommentsContextType } from '../../types/types';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions';
import type { Region } from 'wavesurfer.js/dist/plugins/regions';

// Define a type for region with data
interface RegionWithData extends Region {
  data: {
    commentId: number;
  };
  update: (options: any) => void;
}

export const useComments = (
  waveSurferRef: React.MutableRefObject<WaveSurfer | null>,
  regionsRef: React.MutableRefObject<RegionsPlugin | null>
): any => {
  const { 
    comments, 
    setComments, 
    markers,
    setMarkers,
    fetchComments,
    fetchCommentsAndMarkers,
    addComment,
    addMarkerAndComment, 
    editComment,
    deleteComment,
    selectedCommentId, 
    setSelectedCommentId,
    selectedRegionId,
    setSelectedRegionId,
    regionCommentMap,
    setRegionCommentMap,
  } = useContext(CommentsContext);

  const [newCommentInput, setNewCommentInput] = useState('');

  // console.log("🎣 [useComments] Hook called - markers:", markers);
  // console.log("🎣 [useComments] Hook called - markers length:", markers?.length);
  // console.log("🎣 [useComments] Hook called - regionCommentMap:", regionCommentMap);
  // console.log("🎣 [useComments] Hook called - comments:", comments?.length, "comments");

  // Add debugging for waveSurfer and regions
  useEffect(() => {
    console.log("useComments - waveSurferRef.current:", !!waveSurferRef.current);
    console.log("useComments - regionsRef.current:", !!regionsRef.current);
    
    if (waveSurferRef.current && regionsRef.current && markers?.length) {
      console.log("useComments - We have waveSurfer, regions, and markers. Should be able to create regions.");
      
      // Check if regions are being created
      setTimeout(() => {
        if (regionsRef.current) {
          const regions = regionsRef.current.getRegions();
          console.log("useComments - Current regions:", regions);
        }
      }, 1000);
    }
  }, [waveSurferRef.current, regionsRef.current, markers]);

  // console.log("Markers in useComments:•", markers);

  // Add other comment-related logic and state variables here, e.g.,
  // const [isLoading, setIsLoading] = useState(false);
  // const [error, setError] = useState(null);

  // console.log("Region-Comment Map in useComments:", regionCommentMap);

  useEffect(() => {
    console.log('Selected comment ID changed:', selectedCommentId);
  }, [selectedCommentId]);

  const handleSelectComment = useCallback((commentId: number) => {
    console.log('handleSelectComment called with:', commentId);
    console.log('Current state of comments:', comments);
    
    setSelectedCommentId(commentId);

    if (!waveSurferRef.current || !regionsRef.current) return;

    const regions = regionsRef.current.getRegions();

    console.log('regionCommentMap:', regionCommentMap);
    const selectedRegion = regions.find((region) =>
      Object.entries(regionCommentMap).some(([regionId, cId]) => cId === commentId && region.id === regionId)
    );

    if (selectedRegion) {
      console.log('Selected region:', selectedRegion);
      selectedRegion.setOptions({ color: 'rgba(0, 255, 0, 0.7)' });
      waveSurferRef.current.seekTo(selectedRegion.start / waveSurferRef.current.getDuration());
    }

    // Merged logic from AudioPlayer's handleSelectComment
    if (regionsRef.current) {
      const regions = regionsRef.current.getRegions();
      regions.forEach((region: any) => {
        if (region.data?.commentId === commentId) {
        region.update({ color: 'rgba(0, 255, 0, 0.7)' });
          if (waveSurferRef.current) {
        waveSurferRef.current.seekTo(region.start / waveSurferRef.current.getDuration());
          }
      }
    });
    }
  }, [regionCommentMap, setSelectedCommentId, comments, waveSurferRef, regionsRef]);

  return { 
    newCommentInput, 
    setNewCommentInput, 
    comments, 
    setComments, 
    markers,
    setMarkers,
    fetchComments,
    fetchCommentsAndMarkers, 
    addComment, 
    addMarkerAndComment, 
    editComment,
    deleteComment,
    selectedCommentId, 
    setSelectedCommentId,
    selectedRegionId,
    setSelectedRegionId,
    regionCommentMap,
    setRegionCommentMap,
    handleSelectComment
  };
};
