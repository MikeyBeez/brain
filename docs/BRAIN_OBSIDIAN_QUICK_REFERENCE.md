# Brain + Obsidian Integration: Quick Reference Guide

## Project Goal
Transform Brain from a simple key-value store into an intelligent knowledge management system by integrating with Obsidian.

## Key Architecture Decisions
- **Obsidian**: Source of truth (permanent markdown files)
- **Brain**: Intelligent index & context cache (300-node LRU)
- **Sync**: Bidirectional with automatic failover
- **Isolation**: Complete separation from execution tools

## Development Timeline
- **Week 1**: Core tools + sync infrastructure
- **Week 2**: Intelligence + automation
- **Week 3**: Polish + optimization
- **Week 4+**: Advanced features

## Critical Paths
```
/Users/bard/BrainVault/          # Obsidian vault location
/Users/bard/Code/brain/          # Existing Brain (protected)
/Users/bard/Code/brain-notes/    # New development (isolated)
```

## Core Tools to Build

### Week 1
1. `obsidian_note` - CRUD operations for notes
2. `unified_search` - Combined Brain + Obsidian search
3. File sync system - Bidirectional synchronization

### Week 2
4. `brain_analyze` - AI-powered analysis
5. System daemons - Automated maintenance
6. Conflict resolution - Handle sync conflicts

### Week 3
7. Performance optimization
8. Monitoring dashboard
9. Documentation

## Emergency Contacts
- Execution API: http://localhost:9998
- Monitor UI: http://localhost:9996
- Emergency rollback: `/brain/docs/scripts/emergency_rollback.sh`

## Daily Checklist
- [ ] Execution tool health check
- [ ] Monitor UI accessible
- [ ] No database locks
- [ ] Backup created
- [ ] Tests passing

## Key Commands
```bash
# Check execution health
curl http://localhost:9998/health

# Run tests
python3 /brain-notes/tests/run_all_tests.py

# Emergency stop
/brain/docs/scripts/emergency_rollback.sh
```

## Success Metrics
- Sync accuracy: 99.9%
- Search speed: <200ms
- Zero execution tool downtime
- 10+ permanent notes/week

## Questions?
Check the master document: `/brain/docs/NOTE_SYSTEM_UPGRADE_MASTER.md`
