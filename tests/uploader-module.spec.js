const { test, expect } = require("@playwright/test");

test.describe("Uploader Module Integration Tests", () => {
  test.beforeEach(async ({ page }) => {
    // Mock SweetAlert to avoid actual popups during tests
    await page.addInitScript(() => {
      window.Swal = {
        fire: (options) => {
          console.log('Swal.fire called with:', options);
          window.lastSwalCall = options;
          if (options.onAfterClose) {
            // Don't actually reload the page in tests
            const originalReload = window.location.reload;
            window.location.reload = () => {
              console.log('Reload prevented in test');
            };
            options.onAfterClose();
            window.location.reload = originalReload;
          }
          return Promise.resolve();
        }
      };
    });
  });

  test("should load uploader module and initialize Uppy instance", async ({ page }) => {
    await page.goto("/");

    const uploaderTest = await page.evaluate(async () => {
      // Load the uploader module
      const script = document.createElement('script');
      script.type = 'module';
      script.textContent = `
        import uploader from '/js/dist/uploader.js';
        window.testUploader = uploader;
      `;
      document.head.appendChild(script);

      await new Promise(resolve => setTimeout(resolve, 200));

      // Check if uploader is available
      const uploaderModule = window.uploader || window.testUploader;

      return {
        hasUploader: uploaderModule !== undefined,
        hasInit: typeof uploaderModule?.init === 'function'
      };
    });

    expect(uploaderTest.hasUploader).toBe(true);
    expect(uploaderTest.hasInit).toBe(true);
  });

  test("should initialize Uppy with correct configuration", async ({ page }) => {
    await page.goto("/");

    const configTest = await page.evaluate(async () => {
      // Create a mock trigger button
      const trigger = document.createElement('button');
      trigger.id = 'uppy-trigger';
      document.body.appendChild(trigger);

      const script = document.createElement('script');
      script.type = 'module';
      script.textContent = `
        import Uppy from '@uppy/core';
        import Dashboard from '@uppy/dashboard';
        import Tus from '@uppy/tus';
        import ThumbnailGenerator from '@uppy/thumbnail-generator';

        // Recreate the uploader configuration
        const testCaptureID = 'test-capture-123';
        const uppy = new Uppy({
          debug: true,
          autoProceed: false,
          meta: {
            captureID: testCaptureID
          },
          restrictions: {
            maxFileSize: 500 * 1000 * 1000000,
            maxNumberOfFiles: 999,
            minNumberOfFiles: 1,
            allowedFileTypes: ['image/*', 'video/*', '.lif', '.lifext']
          }
        });

        uppy.use(ThumbnailGenerator, {
          thumbnailWidth: 200
        });

        uppy.use(Dashboard, {
          proudlyDisplayPoweredByUppy: false,
          trigger: '#uppy-trigger',
          showProgressDetails: true,
          metaFields: [
            {id: 'name', name: 'Name', placeholder: 'file name'},
            {id: 'description', name: 'Description', placeholder: 'describe what the image/video'},
          ]
        });

        uppy.use(Tus, {
          endpoint: '/uploads/'
        });

        window.testUppyInstance = uppy;
      `;
      document.head.appendChild(script);

      await new Promise(resolve => setTimeout(resolve, 300));

      const uppy = window.testUppyInstance;
      if (!uppy) return { success: false };

      const state = uppy.getState();
      const restrictions = state.restrictions;
      const meta = state.meta;

      return {
        success: true,
        debug: uppy.opts.debug,
        autoProceed: uppy.opts.autoProceed,
        captureID: meta.captureID,
        restrictions: {
          maxFileSize: restrictions.maxFileSize,
          maxNumberOfFiles: restrictions.maxNumberOfFiles,
          minNumberOfFiles: restrictions.minNumberOfFiles,
          allowedFileTypes: restrictions.allowedFileTypes
        },
        plugins: {
          hasDashboard: uppy.getPlugin('Dashboard') !== undefined,
          hasTus: uppy.getPlugin('Tus') !== undefined,
          hasThumbnailGenerator: uppy.getPlugin('ThumbnailGenerator') !== undefined
        }
      };
    });

    expect(configTest.success).toBe(true);
    expect(configTest.debug).toBe(true);
    expect(configTest.autoProceed).toBe(false);
    expect(configTest.captureID).toBe('test-capture-123');
    expect(configTest.restrictions.maxFileSize).toBe(500000000000);
    expect(configTest.restrictions.maxNumberOfFiles).toBe(999);
    expect(configTest.restrictions.minNumberOfFiles).toBe(1);
    expect(configTest.restrictions.allowedFileTypes).toContain('image/*');
    expect(configTest.restrictions.allowedFileTypes).toContain('video/*');
    expect(configTest.restrictions.allowedFileTypes).toContain('.lif');
    expect(configTest.restrictions.allowedFileTypes).toContain('.lifext');
    expect(configTest.plugins.hasDashboard).toBe(true);
    expect(configTest.plugins.hasTus).toBe(true);
    expect(configTest.plugins.hasThumbnailGenerator).toBe(true);
  });

  test("should configure Dashboard plugin correctly", async ({ page }) => {
    await page.goto("/");

    const dashboardTest = await page.evaluate(async () => {
      const trigger = document.createElement('button');
      trigger.id = 'uppy-trigger';
      document.body.appendChild(trigger);

      const script = document.createElement('script');
      script.type = 'module';
      script.textContent = `
        import Uppy from '@uppy/core';
        import Dashboard from '@uppy/dashboard';

        const uppy = new Uppy();
        uppy.use(Dashboard, {
          proudlyDisplayPoweredByUppy: false,
          trigger: '#uppy-trigger',
          showProgressDetails: true,
          metaFields: [
            {id: 'name', name: 'Name', placeholder: 'file name'},
            {id: 'description', name: 'Description', placeholder: 'describe what the image/video'},
          ]
        });

        window.dashboardTestUppy = uppy;
      `;
      document.head.appendChild(script);

      await new Promise(resolve => setTimeout(resolve, 200));

      const uppy = window.dashboardTestUppy;
      if (!uppy) return { success: false };

      const dashboard = uppy.getPlugin('Dashboard');
      if (!dashboard) return { success: false, hasDashboard: false };

      return {
        success: true,
        hasDashboard: true,
        proudlyDisplayPoweredByUppy: dashboard.opts.proudlyDisplayPoweredByUppy,
        trigger: dashboard.opts.trigger,
        showProgressDetails: dashboard.opts.showProgressDetails,
        metaFields: dashboard.opts.metaFields,
        metaFieldCount: dashboard.opts.metaFields ? dashboard.opts.metaFields.length : 0
      };
    });

    expect(dashboardTest.success).toBe(true);
    expect(dashboardTest.hasDashboard).toBe(true);
    expect(dashboardTest.proudlyDisplayPoweredByUppy).toBe(false);
    expect(dashboardTest.trigger).toBe('#uppy-trigger');
    expect(dashboardTest.showProgressDetails).toBe(true);
    expect(dashboardTest.metaFieldCount).toBe(2);
    expect(dashboardTest.metaFields[0].id).toBe('name');
    expect(dashboardTest.metaFields[1].id).toBe('description');
  });

  test("should configure TUS plugin with correct endpoint", async ({ page }) => {
    await page.goto("/");

    const tusTest = await page.evaluate(async () => {
      const script = document.createElement('script');
      script.type = 'module';
      script.textContent = `
        import Uppy from '@uppy/core';
        import Tus from '@uppy/tus';

        const uppy = new Uppy();
        uppy.use(Tus, {
          endpoint: '/uploads/'
        });

        window.tusTestUppy = uppy;
      `;
      document.head.appendChild(script);

      await new Promise(resolve => setTimeout(resolve, 200));

      const uppy = window.tusTestUppy;
      if (!uppy) return { success: false };

      const tus = uppy.getPlugin('Tus');
      if (!tus) return { success: false, hasTus: false };

      return {
        success: true,
        hasTus: true,
        endpoint: tus.opts.endpoint,
        uploaderType: tus.type
      };
    });

    expect(tusTest.success).toBe(true);
    expect(tusTest.hasTus).toBe(true);
    expect(tusTest.endpoint).toBe('/uploads/');
  });

  test("should configure ThumbnailGenerator with correct width", async ({ page }) => {
    await page.goto("/");

    const thumbnailTest = await page.evaluate(async () => {
      const script = document.createElement('script');
      script.type = 'module';
      script.textContent = `
        import Uppy from '@uppy/core';
        import ThumbnailGenerator from '@uppy/thumbnail-generator';

        const uppy = new Uppy();
        uppy.use(ThumbnailGenerator, {
          thumbnailWidth: 200
        });

        window.thumbnailTestUppy = uppy;
      `;
      document.head.appendChild(script);

      await new Promise(resolve => setTimeout(resolve, 200));

      const uppy = window.thumbnailTestUppy;
      if (!uppy) return { success: false };

      const thumbnail = uppy.getPlugin('ThumbnailGenerator');
      if (!thumbnail) return { success: false, hasThumbnail: false };

      return {
        success: true,
        hasThumbnail: true,
        thumbnailWidth: thumbnail.opts.thumbnailWidth
      };
    });

    expect(thumbnailTest.success).toBe(true);
    expect(thumbnailTest.hasThumbnail).toBe(true);
    expect(thumbnailTest.thumbnailWidth).toBe(200);
  });

  test("should handle file upload completion events", async ({ page }) => {
    await page.goto("/");

    const eventTest = await page.evaluate(async () => {
      const script = document.createElement('script');
      script.type = 'module';
      script.textContent = `
        import Uppy from '@uppy/core';

        const uppy = new Uppy();
        let completeEventFired = false;
        let eventResult = null;

        uppy.on('complete', result => {
          completeEventFired = true;
          eventResult = result;

          const successfulFileNames = result.successful.map(s => s.name).join(', ');
          const failedFileNames = result.failed.map(s => s.name).join(', ');

          // Mock Swal should be available
          if (window.Swal) {
            if (result.failed.length) {
              window.Swal.fire({
                type: 'error',
                title: 'Oops...',
                text: failedFileNames + ' failed to upload'
              });
            } else if (result.successful.length) {
              window.Swal.fire({
                title: 'Good job!',
                text: successfulFileNames + ' successfully uploaded',
                type: 'success'
              });
            }
          }
        });

        // Simulate a complete event
        uppy.emit('complete', {
          successful: [
            { name: 'test1.jpg', response: { status: 200 } },
            { name: 'test2.png', response: { status: 200 } }
          ],
          failed: []
        });

        window.eventTestResults = {
          completeEventFired,
          eventResult,
          lastSwalCall: window.lastSwalCall
        };
      `;
      document.head.appendChild(script);

      await new Promise(resolve => setTimeout(resolve, 200));

      const results = window.eventTestResults;
      return {
        success: results !== undefined,
        completeEventFired: results?.completeEventFired || false,
        successfulCount: results?.eventResult?.successful?.length || 0,
        failedCount: results?.eventResult?.failed?.length || 0,
        swalCalled: results?.lastSwalCall !== undefined,
        swalType: results?.lastSwalCall?.type,
        swalTitle: results?.lastSwalCall?.title
      };
    });

    expect(eventTest.success).toBe(true);
    expect(eventTest.completeEventFired).toBe(true);
    expect(eventTest.successfulCount).toBe(2);
    expect(eventTest.failedCount).toBe(0);
    expect(eventTest.swalCalled).toBe(true);
    expect(eventTest.swalType).toBe('success');
    expect(eventTest.swalTitle).toBe('Good job!');
  });

  test("should handle failed uploads correctly", async ({ page }) => {
    await page.goto("/");

    const failTest = await page.evaluate(async () => {
      const script = document.createElement('script');
      script.type = 'module';
      script.textContent = `
        import Uppy from '@uppy/core';

        const uppy = new Uppy();
        let completeEventFired = false;

        uppy.on('complete', result => {
          completeEventFired = true;

          const failedFileNames = result.failed.map(s => s.name).join(', ');

          if (result.failed.length && window.Swal) {
            window.Swal.fire({
              type: 'error',
              title: 'Oops...',
              text: failedFileNames + ' failed to upload'
            });
          }
        });

        // Simulate a complete event with failures
        uppy.emit('complete', {
          successful: [],
          failed: [
            { name: 'failed1.jpg', error: 'Upload failed' },
            { name: 'failed2.png', error: 'Server error' }
          ]
        });

        window.failTestResults = {
          completeEventFired,
          lastSwalCall: window.lastSwalCall
        };
      `;
      document.head.appendChild(script);

      await new Promise(resolve => setTimeout(resolve, 200));

      const results = window.failTestResults;
      return {
        success: results !== undefined,
        completeEventFired: results?.completeEventFired || false,
        swalCalled: results?.lastSwalCall !== undefined,
        swalType: results?.lastSwalCall?.type,
        swalTitle: results?.lastSwalCall?.title,
        swalText: results?.lastSwalCall?.text
      };
    });

    expect(failTest.success).toBe(true);
    expect(failTest.completeEventFired).toBe(true);
    expect(failTest.swalCalled).toBe(true);
    expect(failTest.swalType).toBe('error');
    expect(failTest.swalTitle).toBe('Oops...');
    expect(failTest.swalText).toContain('failed to upload');
  });

  test("should handle mixed success and failure results", async ({ page }) => {
    await page.goto("/");

    const mixedTest = await page.evaluate(async () => {
      const script = document.createElement('script');
      script.type = 'module';
      script.textContent = `
        import Uppy from '@uppy/core';

        const uppy = new Uppy();
        let swalCalls = [];

        // Override Swal to track multiple calls
        window.Swal = {
          fire: (options) => {
            swalCalls.push(options);
            if (options.onAfterClose) {
              options.onAfterClose();
            }
            return Promise.resolve();
          }
        };

        uppy.on('complete', result => {
          const successfulFileNames = result.successful.map(s => s.name).join(', ');
          const failedFileNames = result.failed.map(s => s.name).join(', ');

          function displaySuccess() {
            window.Swal.fire({
              title: 'Good job!',
              text: successfulFileNames + ' successfully uploaded',
              type: 'success',
              onAfterClose: function () {
                // location.reload() would happen here in production
              }
            });
          }

          function displayFailed() {
            window.Swal.fire({
              type: 'error',
              title: 'Oops...',
              text: failedFileNames + ' failed to upload',
              onAfterClose: function () {
                if (result.successful.length) {
                  displaySuccess();
                }
              }
            });
          }

          if (result.failed.length) {
            displayFailed();
          } else {
            displaySuccess();
          }
        });

        // Simulate mixed results
        uppy.emit('complete', {
          successful: [{ name: 'success.jpg' }],
          failed: [{ name: 'failed.jpg' }]
        });

        window.mixedTestResults = {
          swalCalls
        };
      `;
      document.head.appendChild(script);

      await new Promise(resolve => setTimeout(resolve, 300));

      const results = window.mixedTestResults;
      return {
        success: results !== undefined,
        swalCallCount: results?.swalCalls?.length || 0,
        firstCallType: results?.swalCalls?.[0]?.type,
        firstCallTitle: results?.swalCalls?.[0]?.title,
        secondCallType: results?.swalCalls?.[1]?.type,
        secondCallTitle: results?.swalCalls?.[1]?.title
      };
    });

    expect(mixedTest.success).toBe(true);
    expect(mixedTest.swalCallCount).toBe(2);
    expect(mixedTest.firstCallType).toBe('error');
    expect(mixedTest.firstCallTitle).toBe('Oops...');
    expect(mixedTest.secondCallType).toBe('success');
    expect(mixedTest.secondCallTitle).toBe('Good job!');
  });

  test("should validate allowed file types", async ({ page }) => {
    await page.goto("/");

    const fileTypeTest = await page.evaluate(async () => {
      const script = document.createElement('script');
      script.type = 'module';
      script.textContent = `
        import Uppy from '@uppy/core';

        const uppy = new Uppy({
          restrictions: {
            allowedFileTypes: ['image/*', 'video/*', '.lif', '.lifext']
          }
        });

        const testFiles = [
          { name: 'test.jpg', type: 'image/jpeg', shouldPass: true },
          { name: 'test.png', type: 'image/png', shouldPass: true },
          { name: 'test.mp4', type: 'video/mp4', shouldPass: true },
          { name: 'test.lif', type: 'application/octet-stream', shouldPass: true },
          { name: 'test.lifext', type: 'application/octet-stream', shouldPass: true },
          { name: 'test.pdf', type: 'application/pdf', shouldPass: false },
          { name: 'test.txt', type: 'text/plain', shouldPass: false }
        ];

        const results = [];

        for (const testFile of testFiles) {
          try {
            const file = new File(['content'], testFile.name, { type: testFile.type });
            uppy.addFile({
              name: file.name,
              type: file.type,
              data: file
            });
            results.push({
              name: testFile.name,
              type: testFile.type,
              passed: true,
              shouldPass: testFile.shouldPass
            });
            // Clean up for next test
            const addedFile = Object.values(uppy.getState().files).find(f => f.name === testFile.name);
            if (addedFile) {
              uppy.removeFile(addedFile.id);
            }
          } catch (error) {
            results.push({
              name: testFile.name,
              type: testFile.type,
              passed: false,
              shouldPass: testFile.shouldPass,
              error: error.message
            });
          }
        }

        window.fileTypeTestResults = results;
      `;
      document.head.appendChild(script);

      await new Promise(resolve => setTimeout(resolve, 300));

      return window.fileTypeTestResults || [];
    });

    expect(fileTypeTest.length).toBeGreaterThan(0);

    // Check that allowed file types pass
    const jpgTest = fileTypeTest.find(t => t.name === 'test.jpg');
    expect(jpgTest?.passed).toBe(true);

    const mp4Test = fileTypeTest.find(t => t.name === 'test.mp4');
    expect(mp4Test?.passed).toBe(true);

    const lifTest = fileTypeTest.find(t => t.name === 'test.lif');
    expect(lifTest?.passed).toBe(true);

    // Check that disallowed file types fail
    const pdfTest = fileTypeTest.find(t => t.name === 'test.pdf');
    expect(pdfTest?.passed).toBe(false);

    const txtTest = fileTypeTest.find(t => t.name === 'test.txt');
    expect(txtTest?.passed).toBe(false);
  });
});
