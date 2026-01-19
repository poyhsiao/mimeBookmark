import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger, createLogger, getLogger } from '../logger';
import type { LogLevel } from '@/types/logging';

describe('Logger', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = createLogger({
      level: 'INFO',
      service: 'test-service',
      transports: [],
    });
  });

  afterEach(async () => {
    await logger.close();
  });

  describe('log levels', () => {
    it('should log ERROR level', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      await logger.error('test error message', { key: 'value' });
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('test error message')
      );
      consoleSpy.mockRestore();
    });

    it('should log WARN level', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await logger.warn('test warning message', { key: 'value' });
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('test warning message')
      );
      consoleSpy.mockRestore();
    });

    it('should log INFO level', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await logger.info('test info message', { key: 'value' });
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('test info message')
      );
      consoleSpy.mockRestore();
    });

    it('should log DEBUG level when logger level is DEBUG', async () => {
      const debugLogger = createLogger({
        level: 'DEBUG',
        service: 'test',
        transports: [],
      });
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await debugLogger.debug('test debug message', { key: 'value' });
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('test debug message')
      );
      consoleSpy.mockRestore();
      await debugLogger.close();
    });

    it('should log TRACE level when logger level is TRACE', async () => {
      const traceLogger = createLogger({
        level: 'TRACE',
        service: 'test',
        transports: [],
      });
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await traceLogger.trace('test trace message', { key: 'value' });
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('test trace message')
      );
      consoleSpy.mockRestore();
      await traceLogger.close();
    });
  });

  describe('log filtering', () => {
    it('should not log DEBUG when level is INFO', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const infoLogger = createLogger({
        level: 'INFO',
        service: 'test',
        transports: [],
      });
      await infoLogger.debug('debug message');
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
      await infoLogger.close();
    });

    it('should not log TRACE when level is DEBUG', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const debugLogger = createLogger({
        level: 'DEBUG',
        service: 'test',
        transports: [],
      });
      await debugLogger.trace('trace message');
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
      await debugLogger.close();
    });

    it('should log all levels when level is TRACE', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const traceLogger = createLogger({
        level: 'TRACE',
        service: 'test',
        transports: [],
      });
      await traceLogger.error('error');
      await traceLogger.warn('warn');
      await traceLogger.info('info');
      await traceLogger.debug('debug');
      await traceLogger.trace('trace');
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledTimes(3);
      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
      await traceLogger.close();
    });

    it('should only log ERROR when level is ERROR', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const errorLogger = createLogger({
        level: 'ERROR',
        service: 'test',
        transports: [],
      });
      await errorLogger.error('error');
      await errorLogger.warn('warn');
      await errorLogger.info('info');
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
      await errorLogger.close();
    });
  });

  describe('setLevel', () => {
    it('should change log level dynamically', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      logger.setLevel('ERROR');
      await logger.debug('debug message');
      expect(consoleSpy).not.toHaveBeenCalled();

      logger.setLevel('DEBUG');
      await logger.debug('debug message');
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('getLevel', () => {
    it('should return current log level', () => {
      expect(logger.getLevel()).toBe('INFO');

      logger.setLevel('DEBUG');
      expect(logger.getLevel()).toBe('DEBUG');
    });
  });

  describe('getService', () => {
    it('should return service name', () => {
      expect(logger.getService()).toBe('test-service');
    });
  });

  describe('transport management', () => {
    it('should add transport', () => {
      const mockTransport = {
        name: 'mock',
        log: vi.fn(),
      };

      logger.addTransport(mockTransport);
    });

    it('should remove transport by name', () => {
      const mockTransport = {
        name: 'test-transport',
        log: vi.fn(),
      };

      logger.addTransport(mockTransport);
      logger.removeTransport('test-transport');
    });
  });

  describe('context handling', () => {
    it('should include context in log output', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await logger.info('test message', { userId: '123', action: 'login' });
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('userId')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('123')
      );
      consoleSpy.mockRestore();
    });

    it('should handle undefined context', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await logger.info('test message');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle empty context', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await logger.info('test message', {});
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});

describe('getLogger', () => {
  it('should return same instance on multiple calls', () => {
    const logger1 = getLogger();
    const logger2 = getLogger();
    expect(logger1).toBe(logger2);
  });
});
