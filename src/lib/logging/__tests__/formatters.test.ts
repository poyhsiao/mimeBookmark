import { describe, it, expect } from 'vitest';
import {
  formatAsJson,
  formatAsHuman,
  formatAsColoredHuman,
  formatForLoki,
  parseLogLevel,
  getLevelPriority,
} from '../formatters';
import type { LogEntry, LogLevel } from '@/types/logging';

describe('Formatters', () => {
  const mockLogEntry: LogEntry = {
    timestamp: '2024-01-15T10:30:00.000Z',
    level: 'INFO',
    message: 'Test message',
    service: 'test-service',
    context: { userId: '123' },
  };

  const minimalLogEntry: LogEntry = {
    timestamp: '2024-01-15T10:30:00.000Z',
    level: 'ERROR',
    message: 'Error occurred',
    service: 'test-service',
  };

  describe('formatAsJson', () => {
    it('should format log entry as JSON', () => {
      const result = formatAsJson(mockLogEntry);
      const parsed = JSON.parse(result);

      expect(parsed.timestamp).toBe(mockLogEntry.timestamp);
      expect(parsed.level).toBe(mockLogEntry.level);
      expect(parsed.message).toBe(mockLogEntry.message);
      expect(parsed.service).toBe(mockLogEntry.service);
      expect(parsed.context).toEqual(mockLogEntry.context);
    });

    it('should format minimal log entry as JSON', () => {
      const result = formatAsJson(minimalLogEntry);
      const parsed = JSON.parse(result);

      expect(parsed.timestamp).toBe(minimalLogEntry.timestamp);
      expect(parsed.level).toBe(minimalLogEntry.level);
      expect(parsed.message).toBe(minimalLogEntry.message);
      expect(parsed.service).toBe(minimalLogEntry.service);
      expect(parsed.context).toBeUndefined();
    });
  });

  describe('formatAsHuman', () => {
    it('should format log entry in human readable format', () => {
      const result = formatAsHuman(mockLogEntry);

      expect(result).toContain('[2024-01-15T10:30:00.000Z]');
      expect(result).toContain('[INFO]');
      expect(result).toContain('[test-service]');
      expect(result).toContain('Test message');
      expect(result).toContain('userId');
      expect(result).toContain('123');
    });

    it('should format minimal log entry without context', () => {
      const result = formatAsHuman(minimalLogEntry);

      expect(result).toContain('[2024-01-15T10:30:00.000Z]');
      expect(result).toContain('[ERROR]');
      expect(result).toContain('[test-service]');
      expect(result).toContain('Error occurred');
      expect(result).not.toContain('userId');
    });
  });

  describe('formatAsColoredHuman', () => {
    it('should format ERROR level with red color', () => {
      const errorEntry: LogEntry = { ...minimalLogEntry, level: 'ERROR' };
      const result = formatAsColoredHuman(errorEntry);

      expect(result).toContain('\x1b[31m'); // Red color code
    });

    it('should format WARN level with yellow color', () => {
      const warnEntry: LogEntry = { ...minimalLogEntry, level: 'WARN' };
      const result = formatAsColoredHuman(warnEntry);

      expect(result).toContain('\x1b[33m'); // Yellow color code
    });

    it('should format INFO level with cyan color', () => {
      const infoEntry: LogEntry = { ...mockLogEntry, level: 'INFO' };
      const result = formatAsColoredHuman(infoEntry);

      expect(result).toContain('\x1b[36m'); // Cyan color code
    });

    it('should format DEBUG level with gray color', () => {
      const debugEntry: LogEntry = { ...mockLogEntry, level: 'DEBUG' };
      const result = formatAsColoredHuman(debugEntry);

      expect(result).toContain('\x1b[90m'); // Gray color code
    });

    it('should format TRACE level with white color', () => {
      const traceEntry: LogEntry = { ...mockLogEntry, level: 'TRACE' };
      const result = formatAsColoredHuman(traceEntry);

      expect(result).toContain('\x1b[37m'); // White color code
    });

    it('should end with reset color code', () => {
      const result = formatAsColoredHuman(mockLogEntry);
      expect(result).toContain('\x1b[0m'); // Reset color code
    });
  });

  describe('formatForLoki', () => {
    it('should use entry service name for Loki', () => {
      const result = formatForLoki(mockLogEntry);

      expect(result.stream).toBeDefined();
      expect(result.stream.service).toBe('test-service');
      expect(result.stream.level).toBe('INFO');
      expect(result.values).toBeInstanceOf(Array);
      expect(result.values.length).toBe(1);
      expect(result.values[0]).toContain('INFO');
      expect(result.values[0]).toContain('Test message');
    });

    it('should include trace ID when present', () => {
      const entryWithTrace: LogEntry = {
        ...mockLogEntry,
        traceId: 'trace-123',
      };
      const result = formatForLoki(entryWithTrace);

      expect(result.stream.trace_id).toBe('trace-123');
    });

    it('should include span ID when present', () => {
      const entryWithSpan: LogEntry = {
        ...mockLogEntry,
        spanId: 'span-456',
      };
      const result = formatForLoki(entryWithSpan);

      expect(result.stream.span_id).toBe('span-456');
    });

    it('should include user ID when present', () => {
      const entryWithUser: LogEntry = {
        ...mockLogEntry,
        userId: 'user-789',
      };
      const result = formatForLoki(entryWithUser);

      expect(result.stream.user_id).toBe('user-789');
    });

    it('should include context in log line', () => {
      const result = formatForLoki(mockLogEntry);

      expect(result.values[0]).toContain('userId');
      expect(result.values[0]).toContain('123');
    });

    it('should use entry service name when present', () => {
      const entryWithCustomService: LogEntry = {
        ...mockLogEntry,
        service: 'custom-service',
      };
      const result = formatForLoki(entryWithCustomService);

      expect(result.stream.service).toBe('custom-service');
    });

    it('should use mimebookmark as default service name', () => {
      const entryWithoutService: LogEntry = {
        timestamp: '2024-01-15T10:30:00.000Z',
        level: 'INFO',
        message: 'Test message',
      };
      const result = formatForLoki(entryWithoutService);

      expect(result.stream.service).toBe('mimebookmark');
    });

    it('should generate nanosecond timestamp', () => {
      const result = formatForLoki(mockLogEntry);
      const [timestampStr] = result.values[0].split('\t');

      expect(timestampStr.length).toBe(19); // Nanoseconds are long
      expect(Number(timestampStr)).toBeGreaterThan(0);
    });
  });

  describe('parseLogLevel', () => {
    it('should parse valid log levels', () => {
      expect(parseLogLevel('ERROR')).toBe('ERROR');
      expect(parseLogLevel('WARN')).toBe('WARN');
      expect(parseLogLevel('INFO')).toBe('INFO');
      expect(parseLogLevel('DEBUG')).toBe('DEBUG');
      expect(parseLogLevel('TRACE')).toBe('TRACE');
    });

    it('should parse lowercase log levels', () => {
      expect(parseLogLevel('error')).toBe('ERROR');
      expect(parseLogLevel('warn')).toBe('WARN');
      expect(parseLogLevel('info')).toBe('INFO');
      expect(parseLogLevel('debug')).toBe('DEBUG');
      expect(parseLogLevel('trace')).toBe('TRACE');
    });

    it('should return null for invalid log levels', () => {
      expect(parseLogLevel('INVALID')).toBeNull();
      expect(parseLogLevel('LOG')).toBeNull();
      expect(parseLogLevel('')).toBeNull();
    });
  });

  describe('getLevelPriority', () => {
    it('should return correct priority values', () => {
      expect(getLevelPriority('ERROR')).toBe(0);
      expect(getLevelPriority('WARN')).toBe(1);
      expect(getLevelPriority('INFO')).toBe(2);
      expect(getLevelPriority('DEBUG')).toBe(3);
      expect(getLevelPriority('TRACE')).toBe(4);
    });

    it('should return higher values for higher log levels', () => {
      const levels: LogLevel[] = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'];

      for (let i = 0; i < levels.length - 1; i++) {
        expect(getLevelPriority(levels[i])).toBeLessThan(
          getLevelPriority(levels[i + 1])
        );
      }
    });
  });
});
