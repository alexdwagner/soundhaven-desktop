module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/frontend/src/$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    '^@main/(.*)$': '<rootDir>/main/src/$1',
    // Mock CSS imports
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    // Mock static assets
    '\\.(jpg|jpeg|png|gif|svg|ico)$': '<rootDir>/__mocks__/fileMock.js',
  },
  roots: [
    '<rootDir>',
    '<rootDir>/__tests__',
    '<rootDir>/frontend',
    '<rootDir>/main',
    '<rootDir>/shared'
  ],
  testMatch: [
    '<rootDir>/__tests__/**/*.test.{js,ts,tsx}',
    '<rootDir>/frontend/src/**/__tests__/**/*.test.{js,ts,tsx}',
    '<rootDir>/main/src/**/__tests__/**/*.test.{js,ts,tsx}',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  collectCoverageFrom: [
    'frontend/src/**/*.{ts,tsx}',
    'main/src/**/*.{ts}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
    '!**/dist/**',
  ],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        moduleResolution: 'node',
        resolveJsonModule: true,
        isolatedModules: true,
        skipLibCheck: true,
        allowJs: true,
        strict: true,
        noEmit: true,
        target: 'esnext',
        module: 'esnext',
        lib: ['dom', 'dom.iterable', 'esnext'],
        paths: {
          '@/*': ['./frontend/src/*'],
          '@shared/*': ['./shared/*'],
          '@main/*': ['./main/src/*'],
        },
        baseUrl: '.',
      },
    }],
  },
  modulePathIgnorePatterns: [
    '<rootDir>/dist/',
    '<rootDir>/node_modules/',
    '<rootDir>/frontend/node_modules/',
    '<rootDir>/main/node_modules/',
    '<rootDir>/frontend/.next/',
    '<rootDir>/out/',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.next/',
    '/dist/',
  ],
  // Handle experimental syntax warnings
  transformIgnorePatterns: [
    'node_modules/(?!(wavesurfer\\.js|@dnd-kit)/)',
  ],
};