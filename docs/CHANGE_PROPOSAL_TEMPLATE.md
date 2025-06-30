# Change Proposal Template

Copy this template to `docs/changes/YYYY-MM-DD-module-change.md` when proposing a breaking change.

---

# Change Proposal: [Module Name] [Brief Description]

**Date**: YYYY-MM-DD  
**Author**: [Your Name]  
**Status**: Pending | Approved | Rejected  
**Module**: memory | notes | projects | execution | sessions  

## Current State

### Interface
```typescript
// Current interface signature
methodName(param: Type): ReturnType;
```

### Behavior
Describe current behavior in detail.

## Proposed Change

### New Interface
```typescript
// Proposed interface signature
methodName(param: NewType, options?: Options): NewReturnType;
```

### New Behavior
Describe new behavior in detail.

## Justification

Why is this change necessary? What problems does it solve?

- Problem 1: Description
- Problem 2: Description

## Impact Analysis

### Breaking Changes
- [ ] Which methods are affected?
- [ ] Which tools will break?
- [ ] Which modules depend on this?

### User Impact
- [ ] Will MCP tools need updates?
- [ ] Will existing brain:commands change?

## Migration Plan

### Step 1: Preparation
- What needs to be done first?

### Step 2: Implementation
- How will the change be implemented?

### Step 3: Migration
- How will existing data/code migrate?

### Backward Compatibility
- [ ] Is backward compatibility possible?
- [ ] If yes, how long will it be maintained?
- [ ] If no, why not?

### Timeline
- Preparation: X days
- Implementation: Y days
- Migration period: Z days

## Alternatives Considered

What other approaches were considered and why were they rejected?

1. Alternative 1: Why rejected
2. Alternative 2: Why rejected

## Decision

**Status**: [ ] Approved [ ] Rejected [ ] Needs revision

**Decision Date**: YYYY-MM-DD

**Approver**: [Name]

**Comments**: 
[Any additional notes about the decision]

## Post-Implementation Review

(To be filled after implementation)

- [ ] Was the migration successful?
- [ ] Any unexpected issues?
- [ ] Lessons learned?
