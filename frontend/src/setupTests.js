import '@testing-library/jest-dom';

// jsdom has no layout, so these are no-ops the app calls during navigation.
window.scrollTo = () => {};
