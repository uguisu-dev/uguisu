/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest/presets/default-esm',
    testEnvironment: 'node',
    extensionsToTreatAsEsm: ['.ts'],
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
    transform: {
        '\\.[jt]sx?$': ['ts-jest', { useESM: true }]
    },
    testMatch: [
        '<rootDir>/test/**/*',
    ],
};
