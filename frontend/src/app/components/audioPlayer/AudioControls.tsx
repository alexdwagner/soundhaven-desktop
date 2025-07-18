import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlay,
  faPause,
  faForward,
  faBackward,
  faStepForward,
  faStepBackward,
  faHeart,
  faVolumeUp,
  faTachometerAlt,
} from "@fortawesome/free-solid-svg-icons";

interface AudioControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onSkipForward: () => void;
  onSkipBackward: () => void;
  onPlayNext: () => void;
  onPlayPrevious: () => void;
  onPlaybackSpeedChange: (speed: number) => void;
  onToggleFavorite: () => void;
  onVolumeChange: (volume: number) => void;
  isFavorite: boolean;
  playbackSpeed: number;
  volume: number;
  modalOpen?: boolean;
}

const AudioControls: React.FC<AudioControlsProps> = ({
  isPlaying,
  onPlayPause,
  onSkipForward,
  onSkipBackward,
  onPlayNext,
  onPlayPrevious,
  onPlaybackSpeedChange,
  onToggleFavorite,
  onVolumeChange,
  isFavorite,
  playbackSpeed,
  volume,
}) => {
  // Spacebar handling moved to TracksManager for global access

  const iconStyle = { fontSize: "1.3em" }; // Increase icon size by 30%

  return (
    <div
      className="audio-controls"
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        width: "100%",
        marginTop: "12px",
      }}
    >
      {/* Left spacer div */}
      <div style={{ flex: 1 }}>
        {/* Volume control */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <FontAwesomeIcon icon={faVolumeUp} style={iconStyle} />
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            style={{ width: "80px" }} // Make slider shorter
          />
        </div>
      </div>

      {/* Center div with audio controls */}
      <div
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "20px",
        }}
      >
        <button onClick={onPlayPrevious}>
          <FontAwesomeIcon icon={faStepBackward} style={iconStyle} />
        </button>
        <button onClick={onSkipBackward}>
          <FontAwesomeIcon icon={faBackward} style={iconStyle} />
        </button>
        <button onClick={onPlayPause}>
          <FontAwesomeIcon
            icon={isPlaying ? faPause : faPlay}
            style={iconStyle}
          />
        </button>
        <button onClick={onSkipForward}>
          <FontAwesomeIcon icon={faForward} style={iconStyle} />
        </button>
        <button onClick={onPlayNext}>
          <FontAwesomeIcon icon={faStepForward} style={iconStyle} />
        </button>
        <button onClick={onToggleFavorite}>
          <FontAwesomeIcon
            icon={faHeart}
            className={isFavorite ? "favorite" : ""}
            style={iconStyle}
          />
        </button>
      </div>

      {/* Right div with playback speed slider and volume */}
      <div
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: "20px",
        }}
      >
        {/* Playback speed control */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <FontAwesomeIcon icon={faTachometerAlt} style={iconStyle} />
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={playbackSpeed}
            onChange={(e) => onPlaybackSpeedChange(parseFloat(e.target.value))}
            style={{ width: "80px" }} // Make slider shorter
          />
        </div>
      </div>
    </div>
  );
};

export default AudioControls;
