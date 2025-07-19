import React from 'react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Playback Settings */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Playback</h3>
            <div className="space-y-3 text-sm text-gray-500">
              <div className="flex items-center justify-between">
                <span>Auto-play next track</span>
                <span className="text-xs bg-gray-100 px-2 py-1 rounded">Coming soon</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Crossfade duration</span>
                <span className="text-xs bg-gray-100 px-2 py-1 rounded">Coming soon</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Default volume</span>
                <span className="text-xs bg-gray-100 px-2 py-1 rounded">Coming soon</span>
              </div>
            </div>
          </div>

          {/* Audio & Comments */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Audio & Comments</h3>
            <div className="space-y-3 text-sm text-gray-500">
              <div className="flex items-center justify-between">
                <span>Comment marker style</span>
                <span className="text-xs bg-gray-100 px-2 py-1 rounded">Coming soon</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Waveform colors</span>
                <span className="text-xs bg-gray-100 px-2 py-1 rounded">Coming soon</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Timezone for comment dates</span>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-400">
                    Currently: {Intl.DateTimeFormat().resolvedOptions().timeZone}
                  </span>
                  <span className="text-xs bg-gray-100 px-2 py-1 rounded">Coming soon</span>
                </div>
              </div>
            </div>
          </div>

          {/* Interface */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Interface</h3>
            <div className="space-y-3 text-sm text-gray-500">
              <div className="flex items-center justify-between">
                <span>Theme</span>
                <span className="text-xs bg-gray-100 px-2 py-1 rounded">Coming soon</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Keyboard shortcuts</span>
                <span className="text-xs bg-gray-100 px-2 py-1 rounded">Coming soon</span>
              </div>
            </div>
          </div>

          {/* About */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">About</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p>SoundHaven Desktop</p>
              <p className="text-xs text-gray-500">
                A modern audio player with collaborative commenting features.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-6 border-t border-gray-200 space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal; 