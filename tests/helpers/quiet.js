/**
 * Preloaded into every test process (see the `test` script in package.json).
 *
 * The app logs prolifically on every request and every access check. Left
 * alone that buries the test report, and the sheer volume of child-process
 * output has been observed to corrupt the test runner's IPC stream
 * ("Unable to deserialize cloned data").
 *
 * Set TEST_VERBOSE=1 to get the application logs back while debugging.
 */
if (!process.env.TEST_VERBOSE) {
  const noop = () => {};
  console.log = noop;
  console.info = noop;
  console.debug = noop;
  console.warn = noop;
  console.error = noop;
}
