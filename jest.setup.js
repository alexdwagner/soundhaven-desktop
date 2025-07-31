// Jest setup file for SoundHaven Desktop tests
const { TextEncoder, TextDecoder } = require('util');

// Polyfill for jsdom
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock Electron
global.window = global.window || {};
global.window.electronAPI = {
  invoke: jest.fn(),
  on: jest.fn(),
  removeAllListeners: jest.fn(),
};

global.window.electron = {
  ipcRenderer: {
    invoke: jest.fn(),
    on: jest.fn(),
    removeAllListeners: jest.fn(),
  },
};

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock WaveSurfer
jest.mock('wavesurfer.js', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      load: jest.fn(),
      play: jest.fn(),
      pause: jest.fn(),
      seekTo: jest.fn(),
      getDuration: jest.fn().mockReturnValue(100),
      getCurrentTime: jest.fn().mockReturnValue(0),
      setPlaybackRate: jest.fn(),
      setVolume: jest.fn(),
      on: jest.fn(),
      un: jest.fn(),
      destroy: jest.fn(),
      isPlaying: jest.fn().mockReturnValue(false),
    })),
  };
});

// Mock WaveSurfer Regions Plugin
jest.mock('wavesurfer.js/dist/plugins/regions', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      addRegion: jest.fn().mockReturnValue({
        id: 'mock-region-id',
        start: 0,
        end: 1,
        data: {},
        setOptions: jest.fn(),
        update: jest.fn(),
        remove: jest.fn(),
      }),
      getRegions: jest.fn().mockReturnValue([]),
      clearRegions: jest.fn(),
      on: jest.fn(),
    })),
  };
});

// Mock React Context values for testing
global.mockContextValues = {
  auth: {
    user: { id: 1, email: 'test@example.com' },
    token: 'mock-token',
    login: jest.fn(),
    logout: jest.fn(),
    register: jest.fn(),
  },
  playback: {
    currentTrack: {
      id: 'test-track-id',
      name: 'Test Track',
      file_path: '/test/path.mp3',
      duration: 300,
    },
    isPlaying: false,
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn(),
  },
  comments: {
    comments: [],
    markers: [],
    addMarkerAndComment: jest.fn(),
    deleteComment: jest.fn(),
    editComment: jest.fn(),
    selectedCommentId: null,
    setSelectedCommentId: jest.fn(),
    regionCommentMap: {},
    setRegionCommentMap: jest.fn(),
  },
};

// Suppress console warnings in tests
const originalWarn = console.warn;
const originalError = console.error;

console.warn = (...args) => {
  if (args[0]?.includes?.('Warning: ReactDOM.render is no longer supported')) {
    return;
  }
  originalWarn.apply(console, args);
};

console.error = (...args) => {
  if (args[0]?.includes?.('Warning: ReactDOM.render is no longer supported')) {
    return;
  }
  originalError.apply(console, args);
};

// Mock fetch globally
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    headers: new Headers(),
  })
);

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // Deprecated
    removeListener: jest.fn(), // Deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};