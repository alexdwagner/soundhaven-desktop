import { electronApiService } from '../services/electronApiService';

jest.mock('electron', () => ({
  ipcRenderer: {
    invoke: jest.fn()
  }
}));

describe('ElectronApiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('login makes correct IPC call', async () => {
    const mockResponse = { 
      user: { id: 1, name: 'Test' }, 
      access_token: 'token123' 
    };
    (window.electronAPI.invoke as jest.Mock).mockResolvedValue(mockResponse);
    
    const result = await electronApiService.login('test@test.com', 'password');
    expect(window.electronAPI.invoke).toHaveBeenCalledWith(
      'auth:login', 
      { email: 'test@test.com', password: 'password' }
    );
    expect(result).toEqual(mockResponse);
  });
});