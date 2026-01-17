import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LokiTransport, createLokiTransport } from '../loki-transport';
import type { LogEntry, LokiConfig } from '@/types/logging';

describe('LokiTransport', () => {
  let transport: LokiTransport;

  const createMockLogEntry = (overrides: Partial<LogEntry> = {}): LogEntry => ({
    timestamp: '2024-01-15T10:30:00.000Z',
    level: 'INFO',
    message: 'Test log message',
    service: 'test-service',
    context: { key: 'value' },
    ...overrides,
  });

  beforeEach(() => {
    const config: LokiConfig = {
      url: 'http://localhost:3100/loki/api/v1/push',
      tenantId: 'test-tenant',
      batchSize: 10,
      flushInterval: 60000, // Long interval to prevent auto-flush during tests
      timeout: 5000,
      retryAttempts: 1,
      retryDelay: 100,
    };

    transport = new LokiTransport(config);
  });

  afterEach(async () => {
    await transport.close();
  });

  describe('constructor', () => {
    it('should create transport with default values', () => {
      const simpleTransport = new LokiTransport({
        url: 'http://localhost:3100',
      });

      expect(simpleTransport).toBeInstanceOf(LokiTransport);
    });

    it('should use custom configuration', () => {
      const customConfig: LokiConfig = {
        url: 'http://custom:3100',
        username: 'user',
        password: 'pass',
        tenantId: 'custom-tenant',
        batchSize: 100,
        flushInterval: 1000,
        timeout: 10000,
        retryAttempts: 5,
        retryDelay: 500,
      };

      const customTransport = new LokiTransport(customConfig);
      expect(customTransport).toBeInstanceOf(LokiTransport);
    });
  });

  describe('name', () => {
    it('should have correct name', () => {
      expect(transport.name).toBe('loki');
    });
  });

  describe('log method', () => {
    it('should accept log entries without throwing', async () => {
      const entry = createMockLogEntry();
      await expect(transport.log(entry)).resolves.not.toThrow();
    });

    it('should buffer log entries', async () => {
      const entries = Array(5)
        .fill(null)
        .map((_, i) => createMockLogEntry({ message: `Message ${i}` }));

      for (const entry of entries) {
        await transport.log(entry);
      }

      // Entries are buffered, no exception thrown
      await expect(transport.flush()).resolves.not.toThrow();
    });

    it('should handle entries with minimal fields', async () => {
      const minimalEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        message: 'Error',
      };

      await expect(transport.log(minimalEntry)).resolves.not.toThrow();
    });

    it('should handle entries with complex context', async () => {
      const complexEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'DEBUG',
        message: 'Complex context',
        service: 'test',
        context: {
          nested: { deep: { value: 123 } },
          array: [1, 2, 3],
          string: 'test',
        },
      };

      await expect(transport.log(complexEntry)).resolves.not.toThrow();
    });
  });

  describe('flush method', () => {
    it('should flush without entries without throwing', async () => {
      await expect(transport.flush()).resolves.not.toThrow();
    });

    it('should flush buffered entries', async () => {
      await transport.log(createMockLogEntry());
      await expect(transport.flush()).resolves.not.toThrow();
    });
  });

  describe('close method', () => {
    it('should close without throwing', async () => {
      await transport.log(createMockLogEntry());
      await expect(transport.close()).resolves.not.toThrow();
    });

    it('should flush remaining entries on close', async () => {
      await transport.log(createMockLogEntry());
      await transport.close();
    });
  });

  describe('createLokiTransport', () => {
    it('should create and initialize transport', () => {
      const createdTransport = createLokiTransport({
        url: 'http://localhost:3100',
      });

      expect(createdTransport).toBeInstanceOf(LokiTransport);
      expect(createdTransport.name).toBe('loki');
    });
  });
});

describe('LokiTransport integration tests', () => {
  it('should format Loki push request correctly', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'success' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const transport = new LokiTransport({
      url: 'http://localhost:3100/loki/api/v1/push',
      tenantId: 'test-tenant',
      batchSize: 1,
      flushInterval: 60000,
      timeout: 5000,
    });

    const entry: LogEntry = {
      timestamp: '2024-01-15T10:30:00.000Z',
      level: 'INFO',
      message: 'Test message',
      service: 'test-service',
      context: { key: 'value' },
    };

    await transport.log(entry);
    await transport.flush();

    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const callArgs = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(callArgs[0]).toBe('http://localhost:3100/loki/api/v1/push');
    expect(callArgs[1].method).toBe('POST');

    const headers = callArgs[1].headers as Headers;
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('X-Scope-OrgID')).toBe('test-tenant');

    const body = JSON.parse(callArgs[1].body as string);
    expect(body.streams).toBeInstanceOf(Array);
    expect(body.streams.length).toBe(1);
    expect(body.streams[0].stream.service).toBe('mimebookmark');
    expect(body.streams[0].stream.tenant).toBe('test-tenant');

    fetchSpy.mockRestore();
  });

  it('should handle API errors gracefully', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('Bad Request', { status: 400 })
    );

    const transport = new LokiTransport({
      url: 'http://localhost:3100/loki/api/v1/push',
      batchSize: 100,
      flushInterval: 60000,
      timeout: 5000,
      retryAttempts: 1,
    });

    await transport.log(createMockLogEntry({ message: 'test' }));

    fetchSpy.mockRestore();
  });

  it('should retry on failure', async () => {
    let callCount = 0;
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve(new Response('Error', { status: 500 }));
      }
      return Promise.resolve(
        new Response(JSON.stringify({ status: 'success' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    const transport = new LokiTransport({
      url: 'http://localhost:3100/loki/api/v1/push',
      batchSize: 1,
      flushInterval: 60000,
      timeout: 5000,
      retryAttempts: 3,
      retryDelay: 10,
    });

    await transport.log(createMockLogEntry({ message: 'test' }));

    expect(callCount).toBe(2);

    fetchSpy.mockRestore();
  });
});

function createMockLogEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    timestamp: '2024-01-15T10:30:00.000Z',
    level: 'INFO',
    message: 'Test log message',
    service: 'test-service',
    context: { key: 'value' },
    ...overrides,
  };
}
