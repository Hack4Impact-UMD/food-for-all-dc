# Food for All DC Development Guide

## Build/Run Commands
- **Start app**: `cd my-app && npm start`
- **Build app**: `cd my-app && npm run build`
- **Run tests**: `cd my-app && npm test`
- **Run single test**: `cd my-app && npm test -- -t "test name"`
- **Firebase functions**:
  - Lint: `cd my-app/functions && npm run lint`
  - Build: `cd my-app/functions && npm run build`
  - Deploy: `cd my-app/functions && npm run deploy`
- **Python functions**: Run specific tests with `cd my-app/functions-python && python testing.py`

## Code Style Guidelines
- **TypeScript**: Use strict typing with proper interfaces/types
- **React components**: Functional components with hooks preferred
- **Imports**: Group imports by external libraries, then internal modules
- **Formatting**: Uses Prettier with default config
- **Error handling**: Use try/catch for async operations, proper error states in UI
- **Naming**: PascalCase for components, camelCase for variables/functions
- **Firebase**: Follow Firebase best practices for data structure and security
- **Python**: PEP 8 style, use type hints