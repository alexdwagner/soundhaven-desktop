import React, { useRef, useEffect, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions';
import { useComments } from '@/hooks/UseComments';
import CommentsPanel from '../comments/CommentsPanel';
import Modal from '../Modal';
import { debounce } from 'lodash';

const WaveSurferWithRegions = () => {

  const waveformRef = useRef<HTMLDivElement | null>(null);
  const waveSurferRef = useRef<WaveSurfer | null>(null);
  const regionsPluginRef = useRef<RegionsPlugin | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [regionParams, setRegionParams] = useState<{ id: string; time: number; color: string } | null>(null);

  const { addMarkerAndComment, fetchCommentsAndMarkers, newCommentInput, setNewCommentInput } = useComments();

// Debounced double click handler defined with useCallback at the top level
const debouncedHandleDoubleClick = useCallback(
  debounce((e) => {
  if (regionsPluginRef.current && waveformRef.current) {
    const clickPositionX = e.clientX - waveformRef.current.getBoundingClientRect().left;
    const clickTime = waveSurferRef.current.getDuration() * (clickPositionX / waveformRef.current.offsetWidth);

    // Add a region at the click position
    const region = regionsPluginRef.current.addRegion({
      start: clickTime,
      end: clickTime + 0.1, // Make the region slightly longer than 0 for visibility
      color: 'rgba(0, 123, 255, 0.5)',
    });

    setRegionParams({
      id: region.id,
      time: clickTime,
      color: 'rgba(0, 123, 255, 0.5)'
    });

    setModalOpen(true);
  }
}, 300), []); // No dependencies for useCallback

  useEffect(() => {
    if (waveformRef.current) {
      waveSurferRef.current = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: 'violet',
        progressColor: 'purple',
        backend: 'WebAudio',
        plugins: [
          // Initialize the Regions plugin here and assign it to the ref
          regionsPluginRef.current = RegionsPlugin.create()
        ]
      });

      waveSurferRef.current.load('test.mp3');

      waveSurferRef.current.on('ready', () => {
        console.log('WaveSurfer is ready');

        // Fetch comments and markers for the current track
        fetchCommentsAndMarkers(1); // Replace 1 with the actual track ID
      });

      waveSurferRef.current.on('error', (error) => {
        console.error('WaveSurfer error:', error);
      });

      // Add the double click event listener to the waveform
      waveformRef.current.addEventListener('dblclick', debouncedHandleDoubleClick);

      return () => {
        waveSurferRef.current.destroy();
        waveformRef.current.removeEventListener('dblclick', debouncedHandleDoubleClick);
      };
    }
  }, []);

  const handleCommentSubmit = () => {
    // Add the marker and comment to the backend using the addMarkerAndComment method
    addMarkerAndComment(1, 1, newCommentInput, regionParams.time, 'dummy_token'); // Replace 1 with the actual track ID and user ID, and 'dummy_token' with the actual token
  
    setModalOpen(false);
    setNewCommentInput(''); // clear the comment input
  };

  return (
    <div>
      <div id="waveform" ref={waveformRef} style={{ width: '100%', height: '150px' }}></div>
      {modalOpen && (
  <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}>
    <form onSubmit={(e) => {
      e.preventDefault();
      handleCommentSubmit();
    }}>
      <input
        name="comment"
        type="text"
        placeholder="Enter comment"
        value={ newCommentInput}
        onChange={(e) =>   setNewCommentInput(e.target.value)} // Update comment state on change
      />
      <button type="submit">Submit</button>
    </form>
  </Modal>
)}
    </div>
  );
};

export default WaveSurferWithRegions;