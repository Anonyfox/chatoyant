/**
 * Tests for local provider module public API.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createLocalClient, isLocalError, LocalClient, LocalError } from './index.js';

describe('providers/local/index', () => {
  it('should export LocalClient', () => {
    assert.equal(typeof LocalClient, 'function');
  });

  it('should export createLocalClient', () => {
    assert.equal(typeof createLocalClient, 'function');
  });

  it('should export LocalError', () => {
    assert.equal(typeof LocalError, 'function');
  });

  it('should export isLocalError', () => {
    assert.equal(typeof isLocalError, 'function');
  });

  it('createLocalClient should produce a LocalClient', () => {
    const client = createLocalClient({ baseUrl: 'http://localhost:8765/v1' });
    assert.ok(client instanceof LocalClient);
  });
});
