const { test, expect } = require("@playwright/test");
const { spawn } = require("child_process");
const path = require("path");

test.describe("Thinky v1.15.1 ORM Tests", () => {
  // Helper function to run Node.js code in a subprocess
  async function runNodeScript(scriptContent) {
    return new Promise((resolve, reject) => {
      const nodeProcess = spawn("node", ["-e", scriptContent], {
        cwd: path.resolve(__dirname, ".."),
        env: { ...process.env, NODE_PATH: path.resolve(__dirname, "../node_modules") }
      });

      let output = "";
      let errorOutput = "";

      nodeProcess.stdout.on("data", (data) => {
        output += data.toString();
      });

      nodeProcess.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });

      nodeProcess.on("close", (code) => {
        if (code === 0) {
          resolve({ output, error: null });
        } else {
          resolve({ output, error: errorOutput || "Process exited with code " + code });
        }
      });

      nodeProcess.on("error", (err) => {
        reject(err);
      });
    });
  }

  test("should initialize Thinky with configuration", async () => {
    const script = `
      try {
        const thinkyFactory = require('thinky');
        const thinky = thinkyFactory({
          host: 'localhost',
          port: 28015,
          db: 'test_db'
        });

        console.log(JSON.stringify({
          success: true,
          hasR: typeof thinky.r !== 'undefined',
          hasType: typeof thinky.type !== 'undefined',
          hasCreateModel: typeof thinky.createModel === 'function'
        }));
      } catch (err) {
        console.log(JSON.stringify({
          success: false,
          error: err.message
        }));
      }
    `;

    const result = await runNodeScript(script);
    const data = JSON.parse(result.output);

    expect(data.success).toBe(true);
    expect(data.hasR).toBe(true);
    expect(data.hasType).toBe(true);
    expect(data.hasCreateModel).toBe(true);
  });

  test("should create models with schema validation", async () => {
    const script = `
      try {
        const thinkyFactory = require('thinky');
        const thinky = thinkyFactory({
          host: 'localhost',
          port: 28015,
          db: 'test_db'
        });

        const TestModel = thinky.createModel('TestModel', {
          id: thinky.type.string(),
          name: thinky.type.string().required(),
          email: thinky.type.string().email(),
          age: thinky.type.number().min(0).max(150),
          active: thinky.type.boolean().default(true),
          createdAt: thinky.type.date().default(thinky.r.now()),
          tags: thinky.type.array().schema(thinky.type.string()),
          metadata: thinky.type.object().schema({
            key: thinky.type.string(),
            value: thinky.type.any()
          })
        });

        console.log(JSON.stringify({
          success: true,
          modelName: TestModel.getTableName(),
          hasSchema: typeof TestModel._schema !== 'undefined',
          hasSave: typeof TestModel.prototype.save === 'function',
          hasDelete: typeof TestModel.prototype.delete === 'function',
          hasValidate: typeof TestModel.prototype.validate === 'function'
        }));
      } catch (err) {
        console.log(JSON.stringify({
          success: false,
          error: err.message
        }));
      }
    `;

    const result = await runNodeScript(script);
    const data = JSON.parse(result.output);

    expect(data.success).toBe(true);
    expect(data.modelName).toBe('TestModel');
    expect(data.hasSchema).toBe(true);
    expect(data.hasSave).toBe(true);
    expect(data.hasDelete).toBe(true);
    expect(data.hasValidate).toBe(true);
  });

  test("should validate model fields correctly", async () => {
    const script = `
      try {
        const thinkyFactory = require('thinky');
        const thinky = thinkyFactory({
          host: 'localhost',
          port: 28015,
          db: 'test_db'
        });

        const User = thinky.createModel('User', {
          id: thinky.type.string(),
          username: thinky.type.string().required().min(3).max(20),
          email: thinky.type.string().email().required(),
          age: thinky.type.number().integer().min(13),
          isActive: thinky.type.boolean().default(true)
        });

        // Test valid instance
        const validUser = new User({
          username: 'testuser',
          email: 'test@example.com',
          age: 25
        });

        let validationResults = {
          validUser: false,
          invalidUsername: false,
          invalidEmail: false,
          invalidAge: false
        };

        // Try to validate valid user
        try {
          validUser.validate();
          validationResults.validUser = true;
        } catch (e) {}

        // Test invalid username (too short)
        try {
          const invalidUser1 = new User({
            username: 'ab',
            email: 'test@example.com',
            age: 25
          });
          invalidUser1.validate();
        } catch (e) {
          validationResults.invalidUsername = true;
        }

        // Test invalid email
        try {
          const invalidUser2 = new User({
            username: 'testuser',
            email: 'not-an-email',
            age: 25
          });
          invalidUser2.validate();
        } catch (e) {
          validationResults.invalidEmail = true;
        }

        // Test invalid age
        try {
          const invalidUser3 = new User({
            username: 'testuser',
            email: 'test@example.com',
            age: 10
          });
          invalidUser3.validate();
        } catch (e) {
          validationResults.invalidAge = true;
        }

        console.log(JSON.stringify({
          success: true,
          validationResults: validationResults
        }));
      } catch (err) {
        console.log(JSON.stringify({
          success: false,
          error: err.message
        }));
      }
    `;

    const result = await runNodeScript(script);
    const data = JSON.parse(result.output);

    expect(data.success).toBe(true);
    expect(data.validationResults.validUser).toBe(true);
    expect(data.validationResults.invalidUsername).toBe(true);
    expect(data.validationResults.invalidEmail).toBe(true);
    expect(data.validationResults.invalidAge).toBe(true);
  });

  test("should handle model relationships", async () => {
    const script = `
      try {
        const thinkyFactory = require('thinky');
        const thinky = thinkyFactory({
          host: 'localhost',
          port: 28015,
          db: 'test_db'
        });

        // Create Author model
        const Author = thinky.createModel('Author', {
          id: thinky.type.string(),
          name: thinky.type.string().required(),
          email: thinky.type.string().email()
        });

        // Create Book model
        const Book = thinky.createModel('Book', {
          id: thinky.type.string(),
          title: thinky.type.string().required(),
          authorId: thinky.type.string(),
          publishedYear: thinky.type.number()
        });

        // Create relationships
        Book.belongsTo(Author, 'author', 'authorId', 'id');
        Author.hasMany(Book, 'books', 'id', 'authorId');

        console.log(JSON.stringify({
          success: true,
          hasAuthorRelation: typeof Book.getJoin === 'function',
          hasBooksRelation: typeof Author.getJoin === 'function',
          authorModelName: Author.getTableName(),
          bookModelName: Book.getTableName()
        }));
      } catch (err) {
        console.log(JSON.stringify({
          success: false,
          error: err.message
        }));
      }
    `;

    const result = await runNodeScript(script);
    const data = JSON.parse(result.output);

    expect(data.success).toBe(true);
    expect(data.hasAuthorRelation).toBe(true);
    expect(data.hasBooksRelation).toBe(true);
    expect(data.authorModelName).toBe('Author');
    expect(data.bookModelName).toBe('Book');
  });

  test("should support virtual fields", async () => {
    const script = `
      try {
        const thinkyFactory = require('thinky');
        const thinky = thinkyFactory({
          host: 'localhost',
          port: 28015,
          db: 'test_db'
        });

        const Person = thinky.createModel('Person', {
          id: thinky.type.string(),
          firstName: thinky.type.string().required(),
          lastName: thinky.type.string().required(),
          birthYear: thinky.type.number()
        });

        // Add virtual fields
        Person.virtual('fullName').get(function() {
          return this.firstName + ' ' + this.lastName;
        });

        Person.virtual('age').get(function() {
          const currentYear = new Date().getFullYear();
          return this.birthYear ? currentYear - this.birthYear : null;
        });

        // Create instance
        const person = new Person({
          firstName: 'John',
          lastName: 'Doe',
          birthYear: 1990
        });

        console.log(JSON.stringify({
          success: true,
          fullName: person.fullName,
          hasAge: person.age !== null && typeof person.age === 'number',
          firstName: person.firstName,
          lastName: person.lastName
        }));
      } catch (err) {
        console.log(JSON.stringify({
          success: false,
          error: err.message
        }));
      }
    `;

    const result = await runNodeScript(script);
    const data = JSON.parse(result.output);

    expect(data.success).toBe(true);
    expect(data.fullName).toBe('John Doe');
    expect(data.hasAge).toBe(true);
    expect(data.firstName).toBe('John');
    expect(data.lastName).toBe('Doe');
  });

  test("should handle model hooks and events", async () => {
    const script = `
      try {
        const thinkyFactory = require('thinky');
        const thinky = thinkyFactory({
          host: 'localhost',
          port: 28015,
          db: 'test_db'
        });

        const hooks = {
          preInit: false,
          postInit: false,
          preValidate: false,
          postValidate: false,
          preSave: false,
          postSave: false,
          preDelete: false,
          postDelete: false
        };

        const Event = thinky.createModel('Event', {
          id: thinky.type.string(),
          name: thinky.type.string().required(),
          timestamp: thinky.type.date()
        });

        // Register hooks
        Event.pre('init', function(next) {
          hooks.preInit = true;
          next();
        });

        Event.post('init', function(next) {
          hooks.postInit = true;
          next();
        });

        Event.pre('validate', function(next) {
          hooks.preValidate = true;
          next();
        });

        Event.post('validate', function(next) {
          hooks.postValidate = true;
          next();
        });

        Event.pre('save', function(next) {
          hooks.preSave = true;
          next();
        });

        Event.post('save', function(next) {
          hooks.postSave = true;
          next();
        });

        Event.pre('delete', function(next) {
          hooks.preDelete = true;
          next();
        });

        Event.post('delete', function(next) {
          hooks.postDelete = true;
          next();
        });

        // Create and validate an instance
        const event = new Event({
          name: 'Test Event',
          timestamp: new Date()
        });

        event.validate();

        console.log(JSON.stringify({
          success: true,
          hooks: hooks,
          hasPreHook: typeof Event.pre === 'function',
          hasPostHook: typeof Event.post === 'function'
        }));
      } catch (err) {
        console.log(JSON.stringify({
          success: false,
          error: err.message
        }));
      }
    `;

    const result = await runNodeScript(script);
    const data = JSON.parse(result.output);

    expect(data.success).toBe(true);
    expect(data.hasPreHook).toBe(true);
    expect(data.hasPostHook).toBe(true);
    expect(data.hooks.preValidate).toBe(true);
    expect(data.hooks.postValidate).toBe(true);
  });

  test("should handle custom validators", async () => {
    const script = `
      try {
        const thinkyFactory = require('thinky');
        const thinky = thinkyFactory({
          host: 'localhost',
          port: 28015,
          db: 'test_db'
        });

        const Product = thinky.createModel('Product', {
          id: thinky.type.string(),
          name: thinky.type.string().required(),
          price: thinky.type.number().min(0),
          sku: thinky.type.string().validator(function(sku) {
            // Custom validator: SKU must start with 'PRD-'
            if (!sku || !sku.startsWith('PRD-')) {
              throw new Error('SKU must start with PRD-');
            }
            return true;
          }),
          category: thinky.type.string().enum(['electronics', 'clothing', 'food', 'other'])
        });

        let validationTests = {
          validSKU: false,
          invalidSKU: false,
          validCategory: false,
          invalidCategory: false
        };

        // Test valid SKU
        try {
          const validProduct = new Product({
            name: 'Test Product',
            price: 99.99,
            sku: 'PRD-12345',
            category: 'electronics'
          });
          validProduct.validate();
          validationTests.validSKU = true;
          validationTests.validCategory = true;
        } catch (e) {}

        // Test invalid SKU
        try {
          const invalidProduct = new Product({
            name: 'Test Product',
            price: 99.99,
            sku: 'INVALID-123',
            category: 'electronics'
          });
          invalidProduct.validate();
        } catch (e) {
          validationTests.invalidSKU = true;
        }

        // Test invalid category
        try {
          const invalidCategory = new Product({
            name: 'Test Product',
            price: 99.99,
            sku: 'PRD-12345',
            category: 'invalid_category'
          });
          invalidCategory.validate();
        } catch (e) {
          validationTests.invalidCategory = true;
        }

        console.log(JSON.stringify({
          success: true,
          validationTests: validationTests
        }));
      } catch (err) {
        console.log(JSON.stringify({
          success: false,
          error: err.message
        }));
      }
    `;

    const result = await runNodeScript(script);
    const data = JSON.parse(result.output);

    expect(data.success).toBe(true);
    expect(data.validationTests.validSKU).toBe(true);
    expect(data.validationTests.invalidSKU).toBe(true);
    expect(data.validationTests.validCategory).toBe(true);
    expect(data.validationTests.invalidCategory).toBe(true);
  });

  test("should handle nested objects and arrays", async () => {
    const script = `
      try {
        const thinkyFactory = require('thinky');
        const thinky = thinkyFactory({
          host: 'localhost',
          port: 28015,
          db: 'test_db'
        });

        const Order = thinky.createModel('Order', {
          id: thinky.type.string(),
          orderNumber: thinky.type.string().required(),
          customer: thinky.type.object().schema({
            name: thinky.type.string().required(),
            email: thinky.type.string().email(),
            address: thinky.type.object().schema({
              street: thinky.type.string(),
              city: thinky.type.string(),
              zipCode: thinky.type.string(),
              country: thinky.type.string()
            })
          }),
          items: thinky.type.array().schema(
            thinky.type.object().schema({
              productId: thinky.type.string(),
              name: thinky.type.string(),
              quantity: thinky.type.number().integer().min(1),
              price: thinky.type.number().min(0)
            })
          ),
          tags: thinky.type.array().schema(thinky.type.string()),
          metadata: thinky.type.object()
        });

        // Create complex order instance
        const order = new Order({
          orderNumber: 'ORD-2024-001',
          customer: {
            name: 'Jane Smith',
            email: 'jane@example.com',
            address: {
              street: '123 Main St',
              city: 'New York',
              zipCode: '10001',
              country: 'USA'
            }
          },
          items: [
            {
              productId: 'prod-1',
              name: 'Widget A',
              quantity: 2,
              price: 19.99
            },
            {
              productId: 'prod-2',
              name: 'Widget B',
              quantity: 1,
              price: 29.99
            }
          ],
          tags: ['urgent', 'premium', 'tracked'],
          metadata: {
            source: 'web',
            campaign: 'summer-sale'
          }
        });

        // Validate the complex structure
        let isValid = false;
        try {
          order.validate();
          isValid = true;
        } catch (e) {
          console.error(e);
        }

        console.log(JSON.stringify({
          success: true,
          isValid: isValid,
          hasCustomerEmail: order.customer.email === 'jane@example.com',
          itemCount: order.items.length,
          tagCount: order.tags.length,
          hasMetadata: order.metadata && order.metadata.source === 'web'
        }));
      } catch (err) {
        console.log(JSON.stringify({
          success: false,
          error: err.message
        }));
      }
    `;

    const result = await runNodeScript(script);
    const data = JSON.parse(result.output);

    expect(data.success).toBe(true);
    expect(data.isValid).toBe(true);
    expect(data.hasCustomerEmail).toBe(true);
    expect(data.itemCount).toBe(2);
    expect(data.tagCount).toBe(3);
    expect(data.hasMetadata).toBe(true);
  });

  test("should verify actual project models work", async () => {
    const script = `
      try {
        const path = require('path');

        // Load the actual thinky configuration
        const thinky = require('./lib/thinky');

        // Check that thinky is properly configured
        const config = {
          hasR: typeof thinky.r !== 'undefined',
          hasType: typeof thinky.type !== 'undefined',
          hasCreateModel: typeof thinky.createModel === 'function'
        };

        // Try to load actual models
        let models = {};
        let modelLoadErrors = {};

        try {
          const Capture = require('./models/capture');
          models.capture = true;
        } catch (e) {
          modelLoadErrors.capture = e.message;
        }

        try {
          const Experiment = require('./models/experiment');
          models.experiment = true;
        } catch (e) {
          modelLoadErrors.experiment = e.message;
        }

        try {
          const File = require('./models/file');
          models.file = true;
        } catch (e) {
          modelLoadErrors.file = e.message;
        }

        try {
          const Group = require('./models/group');
          models.group = true;
        } catch (e) {
          modelLoadErrors.group = e.message;
        }

        try {
          const Project = require('./models/project');
          models.project = true;
        } catch (e) {
          modelLoadErrors.project = e.message;
        }

        try {
          const Sample = require('./models/sample');
          models.sample = true;
        } catch (e) {
          modelLoadErrors.sample = e.message;
        }

        console.log(JSON.stringify({
          success: true,
          thinkyConfig: config,
          modelsLoaded: models,
          modelErrors: modelLoadErrors,
          totalModelsLoaded: Object.keys(models).length
        }));
      } catch (err) {
        console.log(JSON.stringify({
          success: false,
          error: err.message
        }));
      }
    `;

    const result = await runNodeScript(script);
    const data = JSON.parse(result.output);

    expect(data.success).toBe(true);
    expect(data.thinkyConfig.hasR).toBe(true);
    expect(data.thinkyConfig.hasType).toBe(true);
    expect(data.thinkyConfig.hasCreateModel).toBe(true);
    // At least some models should load successfully
    expect(data.totalModelsLoaded).toBeGreaterThan(0);
  });
});
