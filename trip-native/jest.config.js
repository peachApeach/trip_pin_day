module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
  moduleNameMapper: {
    '^../constants$': '<rootDir>/__mocks__/constants.ts',
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
}
