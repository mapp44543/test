# Testing Guide - Office Map Application

## Overview

This project includes comprehensive testing infrastructure with three levels:

1. **Unit Tests** - Individual utility functions and components
2. **Integration Tests** - API endpoints and service interactions
3. **E2E Tests** - Complete user workflows

## Quick Start

```bash
# Run all unit and integration tests
npm test

# Watch mode for development
npm run test:watch

# Run with UI
npm run test:ui

# Check coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e

# Run E2E tests with debug
npm run test:e2e:debug

# Run E2E tests in headed mode (see browser)
npm run test:e2e:headed
```

## Unit Tests

### Test Files
- `client/src/utils/quadtree-profiler.test.ts` - Quadtree hit detection profiling
- `client/src/utils/marker-colors-cache.test.ts` - Color caching utility

### Running Unit Tests
```bash
npm test -- client/src/utils

# Or specific file
npm test -- quadtree-profiler.test.ts

# Watch mode
npm run test:watch -- quadtree-profiler
```

### Test Structure
Tests are colocated with source files using `.test.ts` suffix:
```
client/src/
├── utils/
│   ├── quadtree-profiler.ts
│   ├── quadtree-profiler.test.ts
│   ├── marker-colors-cache.ts
│   └── marker-colors-cache.test.ts
```

## Integration Tests

### Test Files
- `server/__tests__/api.test.ts` - API endpoint contracts

### Current Status
Integration tests are structured with placeholder tests. To implement full integration tests:

1. **Setup Test Database**
   ```bash
   # Create test database
   createdb office-map-test
   
   # Run migrations on test DB
   npm run db:migrate
   ```

2. **Mock Express Server**
   - Use supertest for HTTP assertions
   - Mock database queries with vitest
   - Or use test database with transactions

3. **Test Data**
   - Create factory functions for test objects
   - Seed fixtures in beforeAll hooks

Example implementation:
```typescript
import request from 'supertest';
import app from '@/server/index';

describe('GET /api/locations', () => {
  it('should return locations', async () => {
    const res = await request(app)
      .get('/api/locations')
      .expect(200);
    
    expect(res.body).toBeInstanceOf(Array);
    expect(res.body[0]).toHaveProperty('id');
  });
});
```

## E2E Tests

### Test Files
- `e2e.spec.ts` - Complete user workflows
- `playwright.config.ts` - Playwright configuration

### Running E2E Tests
```bash
# Start server first (if not running)
npm run dev

# Then in another terminal
npm run test:e2e

# Or run with UI
npm run test:e2e:ui

# Run specific test
npm run test:e2e rooms-map.spec.ts
```

### Test Coverage
- Map loading and rendering
- Floor switching
- Location details
- Search functionality
- Zoom and pan
- Accessibility features
- Performance metrics
- Error handling

### E2E Test Requirements
- Application running on http://localhost:5000
- Test database with seed data (optional)
- Modern browsers (Chrome, Firefox, Safari)

## Configuration

### Vitest Config
File: `vitest.config.ts`
- Environment: jsdom for DOM testing
- Setup: `client/src/test/setup.ts`
- Coverage reporting (v8 provider)
- Path aliases (@, @shared)

### Playwright Config
File: `playwright.config.ts`
- Test timeout: 30 seconds
- Retries: 2 on failure
- Screenshots and videos on failure
- Runs on Chromium, Firefox, WebKit
- Auto-starts dev server

## Writing Tests

### Unit Test Template
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { MyFunction } from './my-function';

describe('MyFunction', () => {
  let subject: MyFunction;

  beforeEach(() => {
    subject = new MyFunction();
  });

  describe('method', () => {
    it('should do something', () => {
      const result = subject.method();
      expect(result).toBe(expected);
    });
  });
});
```

### React Component Test Template
```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('should render', () => {
    render(<MyComponent />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });

  it('should handle interactions', async () => {
    const user = userEvent.setup();
    render(<MyComponent />);
    
    const button = screen.getByRole('button');
    await user.click(button);
    
    expect(screen.getByText('After Click')).toBeInTheDocument();
  });
});
```

### E2E Test Template
```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000');
  });

  test('user can do something', async ({ page }) => {
    await page.click('button[aria-label="Action"]');
    
    await expect(page.locator('[role="dialog"]')).toBeVisible();
  });
});
```

## Debugging Tests

### Unit Tests
```bash
# Debug in Node.js debugger
npm run test -- --inspect-brk

# Or use VSCode debugger with launch config
```

### E2E Tests
```bash
# Debug mode (opens inspector)
npm run test:e2e:debug

# Headed mode (see browser)
npm run test:e2e:headed

# UI mode (interactive)
npm run test:e2e:ui

# Generate trace for review
# npx playwright show-trace trace.zip
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - run: npm ci
      - run: npm run check
      - run: npm test
      - run: npm run test:coverage
```

## Coverage Reports

### Generate Coverage
```bash
npm run test:coverage
```

### View HTML Report
```bash
open coverage/index.html
```

### Coverage Thresholds
Edit `vitest.config.ts`:
```typescript
coverage: {
  lines: 80,
  functions: 80,
  branches: 75,
  statements: 80,
}
```

## Performance Testing

### Profile Hit Detection
Tests verify quadtree performance metrics:
- Average hit detection time < 5ms
- Success rate > 95%
- Candidates checked < 20 per click

### Monitor Cache Efficiency
Tests verify color cache:
- Hit rate > 80% in normal usage
- O(1) cache lookups
- Memory efficient (200 entry limit)

## Troubleshooting

### Tests Won't Run
```bash
# Clear cache and reinstall
rm -rf node_modules dist
npm install

# Check TypeScript errors
npm run check

# Run specific test verbose
npm test -- --reporter=verbose my-test.spec.ts
```

### E2E Tests Fail
```bash
# Ensure dev server is running
npm run dev

# Check if port is available
netstat -an | grep 5000

# Run with debug to inspect
npm run test:e2e:debug
```

### Coverage Seems Low
```bash
# Check what's being excluded in vitest.config.ts
# Add missing test files:
find . -name "*.ts(x)" ! -path "./node_modules/*" ! -path "./dist/*"
```

## Best Practices

1. **Test Naming** - Use clear, descriptive test names
2. **Single Responsibility** - Each test verifies one thing
3. **Arrange-Act-Assert** - Clear test structure
4. **Mocking** - Mock external dependencies
5. **Fixtures** - Use shared setup with beforeEach/beforeAll
6. **Avoid Flakiness** - Wait for elements, don't hardcode delays
7. **Performance** - Keep tests fast, run in parallel when possible

## Resources

- [Vitest Documentation](https://vitest.dev)
- [Playwright Documentation](https://playwright.dev)
- [Testing Library](https://testing-library.com)
- [Jest DOM Matchers](https://github.com/testing-library/jest-dom)

## Next Steps

1. Implement integration tests with test database
2. Add more E2E scenarios
3. Setup CI/CD pipeline
4. Improve coverage to 80%+
5. Add performance benchmarks
