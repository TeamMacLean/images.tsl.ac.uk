const { test, expect } = require("@playwright/test");

test.describe("Uppy v5 Functionality Tests", () => {
  // Test that Uppy core loads and initializes correctly
  test("should load Uppy core library and create instance", async ({ page }) => {
    await page.goto("/");

    // Inject Uppy test script into the page
    const uppyVersion = await page.evaluate(async () => {
      // Dynamically import Uppy modules
      const { default: Uppy } = await import('/js/dist/uploader.js').catch(() => ({}));

      // If module import fails, try checking global
      if (!Uppy && !window.Uppy) {
        // Try to load Uppy directly
        const script = document.createElement('script');
        script.type = 'module';
        script.textContent = `
          import Uppy from '@uppy/core';
          window.testUppy = Uppy;
        `;
        document.head.appendChild(script);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Create a test instance
      const testUppy = window.testUppy || Uppy || window.Uppy;
      if (testUppy) {
        const instance = new testUppy({
          id: 'test-uppy',
          debug: true,
          autoProceed: false,
          restrictions: {
            maxFileSize: 1024 * 1024 * 100, // 100MB
            allowedFileTypes: ['image/*', '.jpg', '.jpeg', '.png', '.gif']
          }
        });

        // Return version and state info
        return {
          version: instance.constructor.VERSION || 'v5.x',
          state: instance.getState(),
          id: instance.opts.id,
          hasCore: true
        };
      }
      return { hasCore: false };
    });

    expect(uppyVersion.hasCore).toBe(true);
    expect(uppyVersion.id).toBe('test-uppy');
    expect(uppyVersion.state).toBeDefined();
  });

  // Test Dashboard plugin functionality
  test("should initialize Dashboard plugin correctly", async ({ page }) => {
    await page.goto("/");

    const dashboardTest = await page.evaluate(async () => {
      const script = document.createElement('script');
      script.type = 'module';
      script.textContent = `
        import Uppy from '@uppy/core';
        import Dashboard from '@uppy/dashboard';

        const uppy = new Uppy({ id: 'dashboard-test' });
        const dashboard = uppy.use(Dashboard, {
          inline: true,
          target: 'body',
          hideUploadButton: false,
          height: 350,
          metaFields: [
            { id: 'name', name: 'Name', placeholder: 'file name' },
            { id: 'description', name: 'Description', placeholder: 'describe the file' }
          ]
        });

        window.dashboardUppy = uppy;
        window.dashboardPlugin = dashboard;
      `;
      document.head.appendChild(script);

      await new Promise(resolve => setTimeout(resolve, 200));

      const uppy = window.dashboardUppy;
      if (uppy) {
        const plugin = uppy.getPlugin('Dashboard');
        return {
          hasDashboard: plugin !== undefined,
          pluginType: plugin ? plugin.type : null,
          isReady: uppy.getState().info ? false : true
        };
      }
      return { hasDashboard: false };
    });

    expect(dashboardTest.hasDashboard).toBe(true);
    expect(dashboardTest.isReady).toBe(true);
  });

  // Test Thumbnail Generator plugin
  test("should initialize ThumbnailGenerator plugin", async ({ page }) => {
    await page.goto("/");

    const thumbnailTest = await page.evaluate(async () => {
      const script = document.createElement('script');
      script.type = 'module';
      script.textContent = `
        import Uppy from '@uppy/core';
        import ThumbnailGenerator from '@uppy/thumbnail-generator';

        const uppy = new Uppy({ id: 'thumbnail-test' });
        uppy.use(ThumbnailGenerator, {
          thumbnailWidth: 200,
          thumbnailHeight: 200,
          thumbnailType: 'image/jpeg',
          waitForThumbnailsBeforeUpload: true
        });

        window.thumbnailUppy = uppy;
      `;
      document.head.appendChild(script);

      await new Promise(resolve => setTimeout(resolve, 200));

      const uppy = window.thumbnailUppy;
      if (uppy) {
        const plugin = uppy.getPlugin('ThumbnailGenerator');
        return {
          hasThumbnailGenerator: plugin !== undefined,
          pluginOpts: plugin ? {
            width: plugin.opts.thumbnailWidth,
            height: plugin.opts.thumbnailHeight,
            type: plugin.opts.thumbnailType
          } : null
        };
      }
      return { hasThumbnailGenerator: false };
    });

    expect(thumbnailTest.hasThumbnailGenerator).toBe(true);
    expect(thumbnailTest.pluginOpts).toEqual({
      width: 200,
      height: 200,
      type: 'image/jpeg'
    });
  });

  // Test TUS upload plugin
  test("should initialize TUS plugin for resumable uploads", async ({ page }) => {
    await page.goto("/");

    const tusTest = await page.evaluate(async () => {
      const script = document.createElement('script');
      script.type = 'module';
      script.textContent = `
        import Uppy from '@uppy/core';
        import Tus from '@uppy/tus';

        const uppy = new Uppy({ id: 'tus-test' });
        uppy.use(Tus, {
          endpoint: '/api/upload',
          resume: true,
          autoRetry: true,
          retryDelays: [0, 1000, 3000, 5000]
        });

        window.tusUppy = uppy;
      `;
      document.head.appendChild(script);

      await new Promise(resolve => setTimeout(resolve, 200));

      const uppy = window.tusUppy;
      if (uppy) {
        const plugin = uppy.getPlugin('Tus');
        return {
          hasTus: plugin !== undefined,
          endpoint: plugin ? plugin.opts.endpoint : null,
          supportsResume: plugin ? plugin.opts.resume : false
        };
      }
      return { hasTus: false };
    });

    expect(tusTest.hasTus).toBe(true);
    expect(tusTest.endpoint).toBe('/api/upload');
    expect(tusTest.supportsResume).toBe(true);
  });

  // Test file addition and state management
  test("should handle file addition and state updates", async ({ page }) => {
    await page.goto("/");

    const fileTest = await page.evaluate(async () => {
      const script = document.createElement('script');
      script.type = 'module';
      script.textContent = `
        import Uppy from '@uppy/core';

        const uppy = new Uppy({
          id: 'file-test',
          restrictions: {
            maxNumberOfFiles: 3,
            minNumberOfFiles: 1,
            allowedFileTypes: ['image/*']
          }
        });

        // Create a mock file
        const mockFile = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });

        try {
          uppy.addFile({
            name: mockFile.name,
            type: mockFile.type,
            data: mockFile,
            source: 'test',
            isRemote: false
          });

          window.fileTestUppy = uppy;
          window.fileAdded = true;
        } catch (err) {
          window.fileError = err.message;
        }
      `;
      document.head.appendChild(script);

      await new Promise(resolve => setTimeout(resolve, 200));

      const uppy = window.fileTestUppy;
      if (uppy) {
        const state = uppy.getState();
        const files = Object.values(state.files);
        return {
          fileAdded: window.fileAdded || false,
          fileCount: files.length,
          fileName: files[0]?.name,
          fileType: files[0]?.type,
          error: window.fileError || null
        };
      }
      return { fileAdded: false, error: window.fileError || 'Uppy not initialized' };
    });

    expect(fileTest.fileAdded).toBe(true);
    expect(fileTest.fileCount).toBe(1);
    expect(fileTest.fileName).toBe('test.jpg');
    expect(fileTest.fileType).toBe('image/jpeg');
    expect(fileTest.error).toBeNull();
  });

  // Test event emitter functionality
  test("should handle events correctly", async ({ page }) => {
    await page.goto("/");

    const eventTest = await page.evaluate(async () => {
      const script = document.createElement('script');
      script.type = 'module';
      script.textContent = `
        import Uppy from '@uppy/core';

        const uppy = new Uppy({ id: 'event-test' });
        const events = [];

        // Register event listeners
        uppy.on('file-added', (file) => {
          events.push({ type: 'file-added', fileName: file.name });
        });

        uppy.on('file-removed', (file) => {
          events.push({ type: 'file-removed', fileName: file.name });
        });

        uppy.on('upload-progress', (file, progress) => {
          events.push({ type: 'upload-progress', fileName: file.name });
        });

        // Add and remove a file
        const mockFile = new File(['test'], 'event-test.jpg', { type: 'image/jpeg' });
        const fileId = uppy.addFile({
          name: mockFile.name,
          type: mockFile.type,
          data: mockFile
        });

        uppy.removeFile(fileId);

        window.eventTestResults = {
          events: events,
          eventCount: events.length
        };
      `;
      document.head.appendChild(script);

      await new Promise(resolve => setTimeout(resolve, 200));

      return window.eventTestResults || { events: [], eventCount: 0 };
    });

    expect(eventTest.eventCount).toBeGreaterThanOrEqual(2);
    expect(eventTest.events.some(e => e.type === 'file-added')).toBe(true);
    expect(eventTest.events.some(e => e.type === 'file-removed')).toBe(true);
  });

  // Test metadata and file modification
  test("should handle file metadata correctly", async ({ page }) => {
    await page.goto("/");

    const metaTest = await page.evaluate(async () => {
      const script = document.createElement('script');
      script.type = 'module';
      script.textContent = `
        import Uppy from '@uppy/core';

        const uppy = new Uppy({
          id: 'meta-test',
          meta: {
            username: 'testuser',
            uploadedFrom: 'test-suite'
          }
        });

        const mockFile = new File(['test'], 'meta-test.jpg', { type: 'image/jpeg' });
        const fileId = uppy.addFile({
          name: mockFile.name,
          type: mockFile.type,
          data: mockFile,
          meta: {
            description: 'Test file with metadata'
          }
        });

        // Update file metadata
        uppy.setFileMeta(fileId, {
          description: 'Updated description',
          tags: ['test', 'uppy']
        });

        const file = uppy.getFile(fileId);
        window.metaTestResults = {
          fileMeta: file.meta,
          globalMeta: uppy.getState().meta
        };
      `;
      document.head.appendChild(script);

      await new Promise(resolve => setTimeout(resolve, 200));

      return window.metaTestResults || { fileMeta: {}, globalMeta: {} };
    });

    expect(metaTest.fileMeta.description).toBe('Updated description');
    expect(metaTest.fileMeta.tags).toEqual(['test', 'uppy']);
    expect(metaTest.globalMeta.username).toBe('testuser');
    expect(metaTest.globalMeta.uploadedFrom).toBe('test-suite');
  });

  // Test plugin communication and integration
  test("should handle multiple plugins integration", async ({ page }) => {
    await page.goto("/");

    const integrationTest = await page.evaluate(async () => {
      const script = document.createElement('script');
      script.type = 'module';
      script.textContent = `
        import Uppy from '@uppy/core';
        import Dashboard from '@uppy/dashboard';
        import ThumbnailGenerator from '@uppy/thumbnail-generator';
        import Tus from '@uppy/tus';

        const uppy = new Uppy({
          id: 'integration-test',
          debug: false,
          restrictions: {
            maxFileSize: 10485760, // 10MB
            maxNumberOfFiles: 5,
            allowedFileTypes: ['image/*', 'video/*']
          }
        });

        // Add all plugins
        uppy.use(Dashboard, {
          inline: false,
          target: 'body',
          trigger: null
        });

        uppy.use(ThumbnailGenerator, {
          thumbnailWidth: 300
        });

        uppy.use(Tus, {
          endpoint: '/api/tus-upload',
          resume: true
        });

        const plugins = uppy.getState().plugins;
        const pluginList = Object.keys(plugins || {});

        window.integrationResults = {
          pluginCount: pluginList.length,
          hasAllPlugins: pluginList.includes('Dashboard') &&
                        pluginList.includes('ThumbnailGenerator') &&
                        pluginList.includes('Tus'),
          plugins: pluginList
        };
      `;
      document.head.appendChild(script);

      await new Promise(resolve => setTimeout(resolve, 300));

      return window.integrationResults || { pluginCount: 0, hasAllPlugins: false };
    });

    expect(integrationTest.pluginCount).toBeGreaterThanOrEqual(3);
    expect(integrationTest.hasAllPlugins).toBe(true);
  });
});
