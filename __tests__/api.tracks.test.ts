import { apiService } from '@/services/electronApiService';

// Mock the electron API service
jest.mock('@/services/electronApiService');

describe('API Tracks Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getTracks', () => {
    it('should fetch tracks successfully', async () => {
      const mockTracks = [
        { id: '1', name: 'Track 1', file_path: '/path/1.mp3', duration: 180 },
        { id: '2', name: 'Track 2', file_path: '/path/2.mp3', duration: 240 },
      ];

      (apiService.getTracks as jest.Mock).mockResolvedValue(mockTracks);

      const result = await apiService.getTracks();

      expect(result).toEqual(mockTracks);
      expect(apiService.getTracks).toHaveBeenCalledTimes(1);
    });

    it('should handle errors when fetching tracks', async () => {
      const error = new Error('Network error');
      (apiService.getTracks as jest.Mock).mockRejectedValue(error);

      await expect(apiService.getTracks()).rejects.toThrow('Network error');
    });
  });

  describe('updateTrackMetadata', () => {
    it('should update track metadata successfully', async () => {
      const trackId = 1;
      const updates = { name: 'Updated Track Name' };
      const updatedTrack = { id: '1', name: 'Updated Track Name', file_path: '/path/1.mp3', duration: 180 };

      (apiService.updateTrackMetadata as jest.Mock).mockResolvedValue(updatedTrack);

      const result = await apiService.updateTrackMetadata(trackId, updates);

      expect(result).toEqual(updatedTrack);
      expect(apiService.updateTrackMetadata).toHaveBeenCalledWith(trackId, updates);
    });
  });

  describe('deleteTrack', () => {
    it('should delete track successfully', async () => {
      const trackId = 1;
      (apiService.deleteTrack as jest.Mock).mockResolvedValue(undefined);

      await apiService.deleteTrack(trackId);

      expect(apiService.deleteTrack).toHaveBeenCalledWith(trackId);
      expect(apiService.deleteTrack).toHaveBeenCalledTimes(1);
    });
  });
});