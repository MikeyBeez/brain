# Brain System Deployment & Operations Guide

## Overview

This guide covers deployment, configuration, monitoring, and operational procedures for the Brain system in production.

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Claude                               │
│                    (MCP Client)                              │
└─────────────────────────┬───────────────────────────────────┘
                          │ MCP Protocol
┌─────────────────────────┴───────────────────────────────────┐
│                    Brain MCP Server                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  Core Process                        │   │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐    │   │
│  │  │Memory│ │Notes │ │Proj. │ │Exec. │ │Sess. │    │   │
│  │  │Module│ │Module│ │Module│ │Module│ │Module│    │   │
│  │  └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘    │   │
│  │     └────────┴────────┴────────┴────────┘         │   │
│  │                    SQLite DB                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Execution Worker Pool                   │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐      │   │
│  │  │Worker 1│ │Worker 2│ │Worker 3│ │Worker 4│      │   │
│  │  └────────┘ └────────┘ └────────┘ └────────┘      │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

## Pre-Deployment Checklist

### System Requirements

- **OS**: Ubuntu 20.04+ or macOS 12+
- **Node.js**: 18.0+ 
- **Python**: 3.10+ (for execution worker)
- **SQLite**: 3.35+ (with FTS5 support)
- **RAM**: Minimum 2GB, Recommended 4GB
- **Storage**: Minimum 10GB SSD
- **Security**: Firejail (Linux) or sandbox-exec (macOS)

### Security Hardening

```bash
# 1. Create dedicated user
sudo useradd -r -s /bin/false brain
sudo mkdir -p /opt/brain
sudo chown brain:brain /opt/brain

# 2. Set up directories with proper permissions
sudo mkdir -p /opt/brain/{data,logs,backups,executions}
sudo chmod 750 /opt/brain/*
sudo chown -R brain:brain /opt/brain

# 3. Install firejail for sandboxing
sudo apt-get update
sudo apt-get install -y firejail

# 4. Configure AppArmor/SELinux profile
sudo cp deployment/brain.apparmor /etc/apparmor.d/
sudo apparmor_parser -r /etc/apparmor.d/brain.apparmor
```

### Environment Configuration

```bash
# /opt/brain/.env
NODE_ENV=production
BRAIN_DB_PATH=/opt/brain/data/brain.db
BRAIN_BACKUP_PATH=/opt/brain/backups
BRAIN_LOG_PATH=/opt/brain/logs
BRAIN_EXECUTION_PATH=/opt/brain/executions
BRAIN_NOTES_PATH=/opt/brain/notes

# Security settings
BRAIN_MAX_MEMORY_MB=512
BRAIN_MAX_EXECUTION_TIME_MS=300000
BRAIN_MAX_OUTPUT_SIZE_MB=10

# Performance settings
BRAIN_WORKER_MIN=1
BRAIN_WORKER_MAX=4
BRAIN_CACHE_SIZE_MB=100
BRAIN_VACUUM_INTERVAL_HOURS=24

# Monitoring
BRAIN_METRICS_PORT=9090
BRAIN_HEALTH_CHECK_INTERVAL_MS=30000
```

## Deployment Process

### 1. Build and Package

```bash
# Clone repository
git clone https://github.com/your-org/brain.git
cd brain

# Install dependencies
npm ci --production

# Build TypeScript
npm run build

# Run tests
npm run test:all

# Create deployment package
npm run package
# Creates: dist/brain-1.0.0.tar.gz
```

### 2. Deploy to Server

```bash
# Copy to server
scp dist/brain-1.0.0.tar.gz server:/tmp/

# On server
cd /opt/brain
tar -xzf /tmp/brain-1.0.0.tar.gz

# Install production dependencies
npm ci --production

# Initialize database
sudo -u brain node scripts/init-db.js
```

### 3. Systemd Service Configuration

```ini
# /etc/systemd/system/brain-mcp.service
[Unit]
Description=Brain MCP Server
After=network.target

[Service]
Type=simple
User=brain
Group=brain
WorkingDirectory=/opt/brain
Environment="NODE_ENV=production"
EnvironmentFile=/opt/brain/.env
ExecStart=/usr/bin/node /opt/brain/dist/core/server.js
Restart=always
RestartSec=10

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/brain/data /opt/brain/logs /opt/brain/backups /opt/brain/notes

# Resource limits
LimitNOFILE=65536
LimitNPROC=512
MemoryLimit=2G
CPUQuota=80%

[Install]
WantedBy=multi-user.target
```

```ini
# /etc/systemd/system/brain-worker@.service
[Unit]
Description=Brain Execution Worker %i
After=brain-mcp.service
PartOf=brain-mcp.service

[Service]
Type=simple
User=brain
Group=brain
WorkingDirectory=/opt/brain
Environment="NODE_ENV=production"
Environment="WORKER_ID=%i"
EnvironmentFile=/opt/brain/.env
ExecStart=/usr/bin/node /opt/brain/dist/worker/index.js
Restart=always
RestartSec=5

# Security - More restrictive for workers
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/brain/data /opt/brain/executions
PrivateDevices=true
PrivateNetwork=true

# Resource limits
MemoryLimit=512M
CPUQuota=25%

[Install]
WantedBy=brain-mcp.service
```

### 4. Start Services

```bash
# Enable services
sudo systemctl enable brain-mcp.service
sudo systemctl enable brain-worker@{1..4}.service

# Start services
sudo systemctl start brain-mcp.service
sudo systemctl start brain-worker@{1..4}.service

# Check status
sudo systemctl status brain-mcp.service
sudo systemctl status brain-worker@*.service
```

## Claude Configuration

### MCP Configuration

```json
{
  "mcpServers": {
    "brain": {
      "command": "/opt/brain/scripts/start-mcp.sh",
      "args": [],
      "env": {
        "BRAIN_SESSION_MODE": "auto"
      }
    }
  }
}
```

### System Message Update

Add to Claude's system message:

```
You have access to the Brain system for persistent memory and code execution.
Always run brain:init at the start of each conversation to load context.
Use brain:remember to store important information for future conversations.
Use brain:execute to run Python code in a secure sandbox.
```

## Monitoring & Observability

### Prometheus Metrics

```yaml
# /opt/brain/prometheus/config.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'brain'
    static_configs:
      - targets: ['localhost:9090']
```

### Key Metrics to Monitor

```typescript
// Exported metrics
export const metrics = {
  // Response times
  mcp_request_duration_seconds: new Histogram({
    name: 'brain_mcp_request_duration_seconds',
    help: 'MCP request duration in seconds',
    labelNames: ['tool', 'status'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1]
  }),
  
  // Memory operations
  memory_operations_total: new Counter({
    name: 'brain_memory_operations_total',
    help: 'Total memory operations',
    labelNames: ['operation', 'tier']
  }),
  
  // Execution queue
  execution_queue_size: new Gauge({
    name: 'brain_execution_queue_size',
    help: 'Number of queued executions'
  }),
  
  // Database stats
  database_size_bytes: new Gauge({
    name: 'brain_database_size_bytes',
    help: 'SQLite database size in bytes'
  }),
  
  // Session stats
  active_sessions: new Gauge({
    name: 'brain_active_sessions',
    help: 'Number of active sessions'
  }),
  
  // Worker health
  worker_status: new Gauge({
    name: 'brain_worker_status',
    help: 'Worker status (1=healthy, 0=unhealthy)',
    labelNames: ['worker_id']
  })
};
```

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "Brain System Monitor",
    "panels": [
      {
        "title": "Request Latency",
        "targets": [{
          "expr": "histogram_quantile(0.95, brain_mcp_request_duration_seconds_bucket)"
        }]
      },
      {
        "title": "Memory Operations/sec",
        "targets": [{
          "expr": "rate(brain_memory_operations_total[1m])"
        }]
      },
      {
        "title": "Execution Queue",
        "targets": [{
          "expr": "brain_execution_queue_size"
        }]
      },
      {
        "title": "Database Size",
        "targets": [{
          "expr": "brain_database_size_bytes / 1024 / 1024"
        }]
      }
    ]
  }
}
```

### Logging Configuration

```typescript
// Winston logging configuration
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'brain' },
  transports: [
    new winston.transports.File({
      filename: path.join(process.env.BRAIN_LOG_PATH, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: path.join(process.env.BRAIN_LOG_PATH, 'combined.log'),
      maxsize: 10485760,
      maxFiles: 10
    }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Structured logging examples
logger.info('Memory operation', {
  operation: 'set',
  key: 'user_pref',
  size: 1024,
  tier: 'hot'
});

logger.error('Execution failed', {
  executionId: '123',
  error: error.message,
  stack: error.stack
});
```

### Health Check Endpoint

```typescript
// Health check implementation
app.get('/health', async (req, res) => {
  const health = await brain.checkHealth();
  
  const status = health.status === 'healthy' ? 200 : 503;
  
  res.status(status).json({
    status: health.status,
    timestamp: health.timestamp,
    checks: {
      database: health.database,
      workers: health.workers,
      memory: health.memory,
      disk: health.disk
    }
  });
});

// Kubernetes liveness probe
app.get('/health/live', (req, res) => {
  res.status(200).send('OK');
});

// Kubernetes readiness probe
app.get('/health/ready', async (req, res) => {
  const ready = await brain.isReady();
  res.status(ready ? 200 : 503).send(ready ? 'Ready' : 'Not Ready');
});
```

## Operational Procedures

### Daily Operations

#### 1. Morning Health Check
```bash
#!/bin/bash
# /opt/brain/scripts/daily-check.sh

echo "=== Brain System Daily Check ==="
echo "Date: $(date)"

# Check service status
echo -e "\n--- Service Status ---"
systemctl status brain-mcp.service --no-pager | grep "Active:"
systemctl status brain-worker@*.service --no-pager | grep "Active:" | sort

# Check database size
echo -e "\n--- Database Stats ---"
sqlite3 /opt/brain/data/brain.db "
  SELECT 
    'Total Memories' as metric, COUNT(*) as value 
  FROM memories
  UNION ALL
  SELECT 
    'Hot Tier Size', COUNT(*) 
  FROM memories 
  WHERE storage_tier = 'hot'
  UNION ALL
  SELECT 
    'Database Size MB', 
    ROUND(page_count * page_size / 1024.0 / 1024.0, 2)
  FROM pragma_page_count(), pragma_page_size();
"

# Check recent errors
echo -e "\n--- Recent Errors (last 24h) ---"
grep -c ERROR /opt/brain/logs/error.log || echo "No errors found"

# Check execution queue
echo -e "\n--- Execution Queue ---"
sqlite3 /opt/brain/data/brain.db "
  SELECT status, COUNT(*) 
  FROM executions 
  WHERE created_at > datetime('now', '-1 day')
  GROUP BY status;
"
```

#### 2. Memory Tier Rebalancing
```bash
# Triggered automatically, but can be run manually
curl -X POST http://localhost:9090/admin/rebalance-memory
```

#### 3. Database Maintenance
```bash
#!/bin/bash
# /opt/brain/scripts/db-maintenance.sh

# Run VACUUM (during low usage)
echo "Starting database vacuum..."
sqlite3 /opt/brain/data/brain.db "VACUUM;"

# Update statistics
sqlite3 /opt/brain/data/brain.db "ANALYZE;"

# Check integrity
sqlite3 /opt/brain/data/brain.db "PRAGMA integrity_check;"
```

### Weekly Operations

#### 1. Backup Rotation
```bash
#!/bin/bash
# /opt/brain/scripts/weekly-backup.sh

BACKUP_DIR="/opt/brain/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create backup
echo "Creating backup..."
sqlite3 /opt/brain/data/brain.db ".backup ${BACKUP_DIR}/brain_${TIMESTAMP}.db"

# Compress
gzip "${BACKUP_DIR}/brain_${TIMESTAMP}.db"

# Remove backups older than 30 days
find "${BACKUP_DIR}" -name "brain_*.db.gz" -mtime +30 -delete

# Upload to S3 (optional)
aws s3 cp "${BACKUP_DIR}/brain_${TIMESTAMP}.db.gz" \
  s3://your-backup-bucket/brain/
```

#### 2. Performance Analysis
```sql
-- Top memory access patterns
SELECT 
  key,
  access_count,
  memory_score,
  storage_tier,
  julianday('now') - julianday(accessed_at) as days_since_access
FROM memories
ORDER BY access_count DESC
LIMIT 20;

-- Slow queries
SELECT 
  sql,
  COUNT(*) as executions,
  AVG(elapsed_ms) as avg_ms,
  MAX(elapsed_ms) as max_ms
FROM query_log
WHERE elapsed_ms > 50
GROUP BY sql
ORDER BY avg_ms DESC;
```

### Incident Response

#### 1. High Memory Usage
```bash
#!/bin/bash
# Emergency memory cleanup

# Move excess hot memories to warm
sqlite3 /opt/brain/data/brain.db "
  UPDATE memories 
  SET storage_tier = 'warm'
  WHERE storage_tier = 'hot'
    AND type NOT IN ('user_preferences', 'system_critical')
    AND id IN (
      SELECT id FROM memories
      WHERE storage_tier = 'hot'
      ORDER BY 
        access_count ASC,
        accessed_at ASC
      LIMIT 100
    );
"

# Clear old sessions
sqlite3 /opt/brain/data/brain.db "
  DELETE FROM sessions
  WHERE expires_at < datetime('now');
"
```

#### 2. Worker Pool Issues
```bash
# Restart all workers
sudo systemctl restart brain-worker@*.service

# Scale workers up temporarily
sudo systemctl start brain-worker@{5..8}.service

# Check worker logs
journalctl -u brain-worker@* --since "1 hour ago"
```

#### 3. Database Corruption
```bash
#!/bin/bash
# Database recovery procedure

# Stop services
sudo systemctl stop brain-mcp.service brain-worker@*.service

# Attempt repair
cd /opt/brain/data
sqlite3 brain.db ".recover" | sqlite3 brain_recovered.db

# Verify recovered database
sqlite3 brain_recovered.db "PRAGMA integrity_check;"

# If successful, replace
mv brain.db brain_corrupted_$(date +%s).db
mv brain_recovered.db brain.db

# Restart services
sudo systemctl start brain-mcp.service brain-worker@{1..4}.service
```

### Scaling Operations

#### Horizontal Scaling (Workers)
```bash
# Add more workers for high load
for i in {5..10}; do
  sudo systemctl start brain-worker@${i}.service
done

# Remove workers during low load
for i in {5..10}; do
  sudo systemctl stop brain-worker@${i}.service
done
```

#### Vertical Scaling (Resources)
```bash
# Increase memory limit
sudo systemctl edit brain-mcp.service
# Add: MemoryLimit=4G

# Increase worker resources
sudo systemctl edit brain-worker@.service
# Add: MemoryLimit=1G
# Add: CPUQuota=50%
```

## Disaster Recovery

### Backup Strategy

1. **Local Backups**: Hourly SQLite backups retained for 7 days
2. **Remote Backups**: Daily backups to S3 retained for 30 days
3. **Archive Backups**: Weekly backups retained for 1 year

### Recovery Procedures

#### 1. Point-in-Time Recovery
```bash
#!/bin/bash
# Restore to specific timestamp

RESTORE_TIME="2024-01-15 14:30:00"
BACKUP_FILE=$(find /opt/brain/backups -name "*.db.gz" \
  -newermt "${RESTORE_TIME}" | head -1)

# Stop services
sudo systemctl stop brain-mcp.service brain-worker@*.service

# Restore backup
gunzip -c "${BACKUP_FILE}" > /opt/brain/data/brain_restore.db

# Apply WAL logs if available
sqlite3 /opt/brain/data/brain_restore.db "
  ATTACH DATABASE '/opt/brain/data/brain.db-wal' AS wal;
  -- Apply transactions
"

# Replace database
mv /opt/brain/data/brain.db /opt/brain/data/brain_old.db
mv /opt/brain/data/brain_restore.db /opt/brain/data/brain.db

# Restart services
sudo systemctl start brain-mcp.service brain-worker@{1..4}.service
```

#### 2. Full System Recovery
```bash
#!/bin/bash
# Complete system recovery from backup

# 1. Provision new server
# 2. Install Brain system
# 3. Restore latest backup
aws s3 cp s3://backup-bucket/brain/latest.db.gz /tmp/
gunzip /tmp/latest.db.gz

# 4. Initialize system
sudo -u brain cp /tmp/latest.db /opt/brain/data/brain.db

# 5. Start services
sudo systemctl start brain-mcp.service brain-worker@{1..4}.service

# 6. Verify functionality
curl http://localhost:9090/health
```

## Performance Tuning

### SQLite Optimizations

```sql
-- Set optimal pragmas
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -64000; -- 64MB cache
PRAGMA temp_store = MEMORY;
PRAGMA mmap_size = 268435456; -- 256MB memory map
PRAGMA page_size = 4096;
PRAGMA auto_vacuum = INCREMENTAL;
```

### Linux Kernel Tuning

```bash
# /etc/sysctl.d/brain-tuning.conf

# Increase file descriptors
fs.file-max = 65536

# Optimize memory
vm.swappiness = 10
vm.dirty_ratio = 15
vm.dirty_background_ratio = 5

# Network (if using remote monitoring)
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
```

## Security Operations

### Regular Security Audits

```bash
#!/bin/bash
# Monthly security audit script

echo "=== Brain Security Audit ==="

# Check file permissions
echo -e "\n--- File Permissions ---"
find /opt/brain -type f -perm /077 -ls

# Check for suspicious processes
echo -e "\n--- Process Audit ---"
ps aux | grep brain | grep -v grep

# Review recent authentications
echo -e "\n--- Recent Access ---"
grep "brain:init" /opt/brain/logs/combined.log | tail -20

# Check for large or unusual executions
echo -e "\n--- Execution Audit ---"
sqlite3 /opt/brain/data/brain.db "
  SELECT 
    id,
    created_at,
    LENGTH(code) as code_size,
    exit_code,
    cpu_time_ms
  FROM executions
  WHERE created_at > datetime('now', '-7 days')
    AND (
      LENGTH(code) > 10000 OR
      cpu_time_ms > 60000 OR
      exit_code != 0
    )
  ORDER BY created_at DESC;
"
```

### Security Updates

```bash
# Regular update procedure
npm audit
npm update --save

# Check for CVEs
npm audit fix
```

## Maintenance Windows

### Planned Maintenance Schedule

- **Daily**: 3:00 AM - 3:15 AM (automated cleanup)
- **Weekly**: Sunday 2:00 AM - 3:00 AM (backups, analysis)
- **Monthly**: First Sunday 1:00 AM - 4:00 AM (full maintenance)

### Maintenance Mode

```bash
# Enable maintenance mode
touch /opt/brain/MAINTENANCE_MODE

# Disable new sessions
sqlite3 /opt/brain/data/brain.db "
  UPDATE config 
  SET value = 'true' 
  WHERE key = 'maintenance_mode';
"

# Perform maintenance
# ...

# Exit maintenance mode
rm /opt/brain/MAINTENANCE_MODE
```

## Troubleshooting Guide

### Common Issues

#### 1. MCP Connection Failures
```bash
# Check if service is running
systemctl status brain-mcp.service

# Check logs
journalctl -u brain-mcp.service -n 100

# Test MCP endpoint
echo '{"method": "tools/list"}' | nc -U /tmp/brain-mcp.sock
```

#### 2. Database Lock Errors
```bash
# Check for locks
lsof /opt/brain/data/brain.db

# Force checkpoint
sqlite3 /opt/brain/data/brain.db "PRAGMA wal_checkpoint(TRUNCATE);"
```

#### 3. Memory Leak Detection
```bash
# Monitor memory usage
watch -n 5 'ps aux | grep brain | grep -v grep'

# Generate heap dump
kill -USR2 $(pgrep -f brain-mcp)
```

## Success Metrics

Monitor these KPIs to ensure Brain is meeting its autonomy goals:

1. **Uptime**: >99.9% availability
2. **Response Time**: p95 <100ms
3. **Memory Efficiency**: Hot tier utilization 80-95%
4. **Execution Success Rate**: >95%
5. **Pattern Effectiveness**: >70% accepted suggestions
6. **Self-Healing Events**: <5 per week requiring manual intervention
7. **User Satisfaction**: Measured through usage patterns

## Conclusion

This deployment and operations guide ensures Brain can run autonomously with minimal human intervention. The self-monitoring, self-healing, and self-optimizing capabilities mean that Brain should require less than 1 hour of manual maintenance per week while providing reliable service to Claude.

The key to successful operation is:
1. Proper initial configuration
2. Comprehensive monitoring
3. Automated recovery procedures
4. Regular but minimal maintenance

With these in place, Brain truly becomes an autonomous cognitive system.
