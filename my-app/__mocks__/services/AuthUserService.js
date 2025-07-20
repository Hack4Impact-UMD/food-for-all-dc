// __mocks__/services/AuthUserService.js

module.exports = {
  authUserService: {
    getAllUsers: jest.fn().mockResolvedValue([
      {
        id: 'test-uid',
        uid: 'test-uid',
        name: 'Test User',
        role: 2, // UserType.ClientIntake
        phone: '555-1234',
        email: 'test@example.com',
      },
    ]),
    // Add other methods as needed for tests
  },
};
