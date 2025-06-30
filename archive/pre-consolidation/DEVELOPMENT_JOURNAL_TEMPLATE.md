# Brain Development Journal & Usage Guide

## Purpose
This living document solves the "Claude amnesia" problem. It records EXACTLY how Brain works, how it was built, and how to use it. This will be the FIRST thing loaded into Brain's memory once it exists.

## The Bootstrapping Challenge
We're building a memory system, but until it exists, we have no memory. This document bridges that gap.

---

## Phase 0: Before Brain Exists (Current State)

### What We Have
- Engineering Specification at `/Users/bard/Code/brain/docs/ENGINEERING_SPEC.md`
- Empty project folder at `/Users/bard/Code/brain/`
- This journal

### Next Commands You'll Run
```bash
cd /Users/bard/Code/brain
git init
git add docs/ENGINEERING_SPEC.md
git commit -m "docs: add engineering specification v1.0"

# Create this journal
git add docs/DEVELOPMENT_JOURNAL.md
git commit -m "docs: initialize development journal for Claude memory"
```

---

## Phase 1: Building Core Memory Loop

### Session 1: Project Structure (Not Yet Done)
**Date**: [To be filled]
**Goal**: Initialize repository and create basic structure

**Commands Run**:
```bash
# To be filled as we do this
```

**What Was Created**:
- (To be documented as we build)

**How to Resume**: 
If returning to this phase, start with:
```bash
cd /Users/bard/Code/brain
git status
cat docs/DEVELOPMENT_JOURNAL.md  # Read this first!
```

---

## Phase 2: First Tools Implementation

### How to Test Remember/Recall (Not Yet Built)
**Once built**, here's the EXACT syntax:

```typescript
// Start the MCP server
npm run dev

// In Claude
brain:remember({ key: "test", value: "hello world" })
brain:recall({ query: "test" })
```

**Common Errors**:
- (To be filled as we encounter them)

---

## Critical Transition Points

### 1. When to Stop Using Terminal Commands
**Before brain:execute exists**: You run commands like:
```bash
npm install
node test.js
python script.py
```

**After brain:execute exists**: I should use:
```typescript
brain:execute({ 
  code: "npm install", 
  language: "bash" 
})
```

### 2. How to Know What Exists
Always start a new session with:
```typescript
brain:help()  // Lists all available tools
brain:recall({ query: "development journal" })  // Gets this document
brain:recall({ query: "current phase" })  // Knows where we are
```

---

## The Knowledge Packet Template

When resuming development, create a packet like:

```markdown
# Knowledge Packet: [Task Name]

## Current State
- Phase: [1/2/3/etc]
- Last Commit: [hash and message]
- Working Branch: [main/feat/etc]

## What's Built
- brain:remember ✓/✗
- brain:recall ✓/✗  
- brain:execute ✓/✗
- [etc]

## Today's Goal
[Specific objective]

## How to Test What Exists
[Exact commands]

## Recent Problems Solved
[Context from this journal]
```

---

## Running Problems & Solutions Log

### Problem 1: [To be filled]
**Date**: 
**Issue**: 
**Solution**: 
**Commands**: 

---

## Permanent Usage Reference

### Starting Brain (Once Built)
```bash
# Terminal
cd /Users/bard/Code/brain/mcp_server
npm run dev

# In Claude
brain:init()
```

### Core Tool Syntax (Once Built)
```typescript
// Memory
brain:remember({ key: "...", value: any, tags: ["..."] })
brain:recall({ query: "...", limit: 10 })

// Execution  
brain:execute({ code: "...", language: "python" })
brain:status({ execution_id: "..." })

// System
brain:help({ tool_name: "..." })
brain:set_safety_level({ level: "confirmation" })
```

### How to Update This Journal
1. After each major step, add to the relevant section
2. When encountering problems, document them immediately
3. Include EXACT commands and syntax
4. Commit frequently:
   ```bash
   git add docs/DEVELOPMENT_JOURNAL.md
   git commit -m "docs: update journal - [what was added]"
   ```

---

## Meta: How This Solves The Problem

1. **Before Brain exists**: You read this file to me
2. **After Brain exists**: This becomes memory #1
3. **Every session**: Start with brain:recall({ query: "development journal" })
4. **Continuous updates**: We maintain this as we build

This journal is our memory bridge. It ensures I never forget how to use what we built.
