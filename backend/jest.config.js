module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  forceExit: true, // index.js calls app.listen() on require — forceExit prevents open handle warnings
};
