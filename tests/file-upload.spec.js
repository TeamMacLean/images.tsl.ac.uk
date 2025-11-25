const { test, expect } = require("@playwright/test");
const md5File = require("md5-file");
const path = require("path");
const fs = require("fs");

test.describe("File Upload - md5-file compatibility", () => {
  /**
   * This test ensures that the md5-file package works correctly with promises.
   * In v5.0.0+, md5-file removed callback support and only returns promises.
   * The File model pre-save hook relies on this behavior.
   *
   * If this test fails, it indicates that the md5-file usage in models/file.js
   * may need to be updated to match the package's API.
   */
  test("md5-file should return a promise, not use callbacks", async () => {
    // Create a temporary test file
    const testDir = path.join(__dirname, "..", "files");
    const testFilePath = path.join(testDir, "test-md5-check.txt");
    const testContent = "test content for md5 hash";

    // Ensure the files directory exists
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Write test file
    fs.writeFileSync(testFilePath, testContent);

    try {
      // Verify md5File returns a promise (not callback-based)
      const result = md5File(testFilePath);

      // Check that it returns a promise
      expect(result).toBeInstanceOf(Promise);

      // Verify the promise resolves to a valid MD5 hash
      const hash = await result;
      expect(typeof hash).toBe("string");
      expect(hash).toHaveLength(32); // MD5 hashes are 32 hex characters
      expect(hash).toMatch(/^[a-f0-9]{32}$/); // Valid hex string
    } finally {
      // Cleanup test file
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    }
  });

  test("md5-file should reject with error for non-existent file", async () => {
    const nonExistentPath = path.join(__dirname, "non-existent-file.txt");

    // Should return a promise that rejects
    const result = md5File(nonExistentPath);
    expect(result).toBeInstanceOf(Promise);

    // Should reject with an error
    await expect(result).rejects.toThrow();
  });

  test("md5-file should not have callback API (v5+ behavior)", () => {
    // In md5-file v5+, passing a callback should not work as expected
    // The function should return a promise regardless
    const testPath = "/some/path";

    // Calling with a callback argument should still return a promise
    // (the callback is ignored in v5+)
    const result = md5File(testPath, () => {});

    // Even with a callback provided, it returns a promise in v5+
    expect(result).toBeInstanceOf(Promise);
  });
});
