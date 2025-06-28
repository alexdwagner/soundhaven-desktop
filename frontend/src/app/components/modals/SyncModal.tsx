import React, { useState, useEffect } from 'react';

interface SyncDiff {
  orphanedFiles: string[];
  missingFiles: Array<{
    track: {
      id: number;
      name: string;
      filePath: string;
    };
    fileName: string;
  }>;
  invalidPaths: Array<{
    id: number;
    name: string;
    filePath: string;
  }>;
  filesInUploads: string[];
  tracksInDb: Array<{
    id: number;
    name: string;
    filePath: string;
  }>;
  isHealthy: boolean;
}

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSync: (actions: {
    deleteOrphaned: boolean;
    fixPaths: boolean;
    addMissing: boolean;
  }) => void;
  diff: SyncDiff | null;
  isLoading: boolean;
}

const SyncModal: React.FC<SyncModalProps> = ({
  isOpen,
  onClose,
  onSync,
  diff,
  isLoading
}) => {
  const [selectedActions, setSelectedActions] = useState({
    deleteOrphaned: false,
    fixPaths: false,
    addMissing: false,
  });

  useEffect(() => {
    if (diff) {
      setSelectedActions({
        deleteOrphaned: diff.orphanedFiles.length > 0,
        fixPaths: diff.invalidPaths.length > 0,
        addMissing: diff.missingFiles.length > 0,
      });
    }
  }, [diff]);

  if (!isOpen) return null;

  const handleSync = () => {
    onSync(selectedActions);
  };

  const getActionDescription = () => {
    const actions = [];
    if (selectedActions.deleteOrphaned && diff?.orphanedFiles.length) {
      actions.push(`Delete ${diff.orphanedFiles.length} orphaned file${diff.orphanedFiles.length > 1 ? 's' : ''}`);
    }
    if (selectedActions.fixPaths && diff?.invalidPaths.length) {
      actions.push(`Fix ${diff.invalidPaths.length} invalid path${diff.invalidPaths.length > 1 ? 's' : ''}`);
    }
    if (selectedActions.addMissing && diff?.missingFiles.length) {
      actions.push(`Add ${diff.missingFiles.length} missing file${diff.missingFiles.length > 1 ? 's' : ''} to database`);
    }
    return actions.join(', ');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Database Sync
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto max-h-[60vh]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Analyzing database and files...</span>
            </div>
          ) : diff ? (
            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Sync Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{diff.filesInUploads.length}</div>
                    <div className="text-gray-600">Files in uploads</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{diff.tracksInDb.length}</div>
                    <div className="text-gray-600">Tracks in database</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{diff.orphanedFiles.length}</div>
                    <div className="text-gray-600">Orphaned files</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{diff.missingFiles.length}</div>
                    <div className="text-gray-600">Missing files</div>
                  </div>
                </div>
                <div className="mt-3 text-center">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    diff.isHealthy 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {diff.isHealthy ? '✅ Database is healthy' : '⚠️ Database needs sync'}
                  </span>
                </div>
              </div>

              {/* Orphaned Files */}
              {diff.orphanedFiles.length > 0 && (
                <div className="border border-orange-200 rounded-lg p-4">
                  <div className="flex items-center mb-3">
                    <input
                      type="checkbox"
                      id="deleteOrphaned"
                      checked={selectedActions.deleteOrphaned}
                      onChange={(e) => setSelectedActions(prev => ({
                        ...prev,
                        deleteOrphaned: e.target.checked
                      }))}
                      className="mr-3"
                    />
                    <label htmlFor="deleteOrphaned" className="text-lg font-medium text-orange-800">
                      🗑️ Orphaned Files ({diff.orphanedFiles.length})
                    </label>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    These files exist in the uploads folder but are not referenced in the database.
                  </p>
                  <div className="bg-orange-50 rounded p-3 max-h-32 overflow-y-auto">
                    {diff.orphanedFiles.map((file, index) => (
                      <div key={index} className="text-sm text-orange-700 font-mono">
                        {file}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Missing Files */}
              {diff.missingFiles.length > 0 && (
                <div className="border border-red-200 rounded-lg p-4">
                  <div className="flex items-center mb-3">
                    <input
                      type="checkbox"
                      id="addMissing"
                      checked={selectedActions.addMissing}
                      onChange={(e) => setSelectedActions(prev => ({
                        ...prev,
                        addMissing: e.target.checked
                      }))}
                      className="mr-3"
                    />
                    <label htmlFor="addMissing" className="text-lg font-medium text-red-800">
                      ❌ Missing Files ({diff.missingFiles.length})
                    </label>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    These tracks exist in the database but their files are missing from the uploads folder.
                  </p>
                  <div className="bg-red-50 rounded p-3 max-h-32 overflow-y-auto">
                    {diff.missingFiles.map((item, index) => (
                      <div key={index} className="text-sm text-red-700">
                        <span className="font-medium">{item.track.name}</span>
                        <span className="text-red-500 ml-2">→ {item.fileName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Invalid Paths */}
              {diff.invalidPaths.length > 0 && (
                <div className="border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center mb-3">
                    <input
                      type="checkbox"
                      id="fixPaths"
                      checked={selectedActions.fixPaths}
                      onChange={(e) => setSelectedActions(prev => ({
                        ...prev,
                        fixPaths: e.target.checked
                      }))}
                      className="mr-3"
                    />
                    <label htmlFor="fixPaths" className="text-lg font-medium text-yellow-800">
                      🔧 Invalid Paths ({diff.invalidPaths.length})
                    </label>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    These tracks have file paths that don't follow the expected format.
                  </p>
                  <div className="bg-yellow-50 rounded p-3 max-h-32 overflow-y-auto">
                    {diff.invalidPaths.map((track, index) => (
                      <div key={index} className="text-sm text-yellow-700">
                        <span className="font-medium">{track.name}</span>
                        <span className="text-yellow-500 ml-2">→ {track.filePath}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No Issues */}
              {diff.isHealthy && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <div className="text-green-600 text-lg font-medium mb-2">
                    ✅ Database is in sync!
                  </div>
                  <p className="text-green-700">
                    All files in the uploads folder are properly referenced in the database.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No sync data available
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {diff && !diff.isHealthy && (
                <span>Selected actions: {getActionDescription()}</span>
              )}
            </div>
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              {diff && !diff.isHealthy && (
                <button
                  onClick={handleSync}
                  disabled={!Object.values(selectedActions).some(Boolean)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  Sync Database
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SyncModal; 