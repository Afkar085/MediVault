import '@testing-library/jest-dom';

// jsdom has no layout, so these are no-ops the app calls during navigation.
window.scrollTo = () => {};

// jsdom keeps one window.history for every test in a file. The app restores
// its screen and open record from history state, so a test that ended with a
// record open would otherwise leak that state into the next test.
beforeEach(() => {
  window.history.replaceState(null, '');
});
