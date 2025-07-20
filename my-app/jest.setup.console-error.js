// Suppress all console.error output globally in Jest
global.beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
