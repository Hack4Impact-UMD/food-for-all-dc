// Suppress MUI act warnings globally in Jest
const suppressedWarnings = [
  'Warning: An update to ForwardRef(TouchRipple) inside a test was not wrapped in act(...).',
  'Warning: `ReactDOMTestUtils.act` is deprecated in favor of `React.act`.'
];

const originalError = console.error;
console.error = (...args) => {
  if (typeof args[0] === 'string' && suppressedWarnings.some(w => args[0].includes(w))) {
    return;
  }
  originalError(...args);
};
