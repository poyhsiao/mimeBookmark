# Logging Setup Guide

This document describes how to set up and use the Loki/Grafana logging system for mimeBookmark.

## Overview

The logging system consists of:
- **Loki**: Log aggregation system
- **Grafana**: Visualization and dashboards
- **Promtail**: Log collector

## Quick Start

### 1. Start the Logging Stack

```bash
docker-compose -f docker-compose.logging.yml up -d
```

### 2. Access Services

| Service | URL | Credentials |
|---------|-----|-------------|
| Grafana | http://localhost:3000 | admin / admin123 |
| Loki API | http://localhost:3100 | - |

### 3. Verify Loki is Running

```bash
curl http://localhost:3100/ready
```

Should return `ready`.

## Environment Variables

Add these to your `.env.local` for development:

```bash
LOKI_URL=http://localhost:3100
LOKI_USERNAME=admin
LOKI_PASSWORD=admin123
LOKI_TENANT_ID=mimebookmark
LOG_LEVEL=INFO
NEXT_PUBLIC_LOG_LEVEL=INFO
```

## Production Configuration

For production, update the Loki URL:

```bash
LOKI_URL=https://loki.your-domain.com
```

## Using the Logger

### Server-side (Node.js)

```typescript
import { getServerLogger, logRequest, logError, logInfo } from '@/lib/logging';

// Get the server logger
const logger = await getServerLogger();

// Log messages
await logger.info('User logged in', { userId: '123' });
await logger.error('Failed to fetch data', { error: err.message });

// Use convenience functions
await logInfo('Application started');
await logError(error, { context: 'auth' });

// Log HTTP requests
await logRequest('GET', '/api/bookmarks', 200, 150, 'user-123');
```

### Client-side (Browser)

```typescript
import { logClientInfo, logClientError, logClientDebug } from '@/lib/logging';

// Log from client components
logClientInfo('Page viewed', { page: '/dashboard' });
logClientError('Failed to submit form', { field: 'email' });
logClientDebug('Component rendered', { props: sanitizedProps });
```

### Setting Log Level

```typescript
import { setClientLogLevel } from '@/lib/logging';

// Set client log level
setClientLogLevel('DEBUG'); // 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'TRACE'
```

## Log Levels

| Level | Description | Numeric Value |
|-------|-------------|---------------|
| ERROR | Error conditions | 0 |
| WARN | Warning conditions | 1 |
| INFO | Informational messages | 2 |
| DEBUG | Debug messages | 3 |
| TRACE | Trace messages | 4 |

Logs are filtered based on the configured level. For example, setting level to `INFO` will only show `ERROR`, `WARN`, and `INFO` logs.

## Querying Logs in Grafana

### Basic Query

```
{job="mimebookmark"}
```

### Filter by Level

```
{job="mimebookmark"} | level="ERROR"
```

### Filter by Time Range

Use the time selector in Grafana to filter logs by time range.

### Parse JSON Context

```
{job="mimebookmark"} | json | line_format "{{.timestamp}} {{.level}} {{.message}}"
```

## Log Retention

Logs are retained for 90 days by default. This can be configured in `docker/loki-config.yaml`:

```yaml
limits_config:
  retention_period: 2160h  # 90 days = 2160 hours
```

## Available Dashboards

After starting the stack, import the following dashboards in Grafana:

1. **Loki Logs**: View all application logs
2. **Error Dashboard**: Filter for error-level logs only
3. **Request Dashboard**: HTTP request logs with timing information

## Troubleshooting

### Loki not receiving logs

1. Check if Loki container is running:
   ```bash
   docker-compose -f docker-compose.logging.yml ps
   ```

2. Check Loki logs:
   ```bash
   docker-compose -f docker-compose.logging.yml logs loki
   ```

3. Verify network connectivity:
   ```bash
   docker-compose -f docker-compose.logging.yml exec promtail wget -qO- http://loki:3100/ready
   ```

### Grafana not showing Loki data source

1. Check Loki is healthy: `http://localhost:3100/ready`
2. Verify datasource configuration in `docker/grafana/provisioning/datasources/loki.yaml`
3. Restart Grafana container if needed

## Stopping the Stack

```bash
docker-compose -f docker-compose.logging.yml down
```

To remove all data volumes:

```bash
docker-compose -f docker-compose.logging.yml down -v
```

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Application   │────▶│     Promtail    │────▶│      Loki       │
│   (Next.js)     │     │  (Log Collector)│     │  (Storage)      │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
                                                ┌─────────────────┐
                                                │     Grafana     │
                                                │  (Visualization)│
                                                └─────────────────┘
```

## Adding Custom Log Labels

To add custom labels to your logs, modify the logger configuration in `src/lib/logging/server.ts`:

```typescript
const lokiTransport = createLokiTransport({
  url: process.env.LOKI_URL!,
  tenantId: 'mimebookmark',
});
```

## Integration with Sentry

The logging system can be used alongside Sentry for comprehensive observability:

- **Sentry**: Error tracking and performance monitoring
- **Loki/Grafana**: Log aggregation and visualization

Both systems can be configured independently and used together.
