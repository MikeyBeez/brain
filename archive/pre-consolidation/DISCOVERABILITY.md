# Making Brain Discoverable

## The Challenge
How do we ensure Claude knows about Brain in every session, regardless of what project or context the user starts with?

## Strategies

### 1. Naming Convention
- Use a simple, memorable name: "brain"
- Consistent tool prefix: "brain:*"
- Put it early in alphabetical MCP server list

### 2. MCP Configuration
```json
{
  "mcpServers": {
    "brain": {
      "command": "/Users/bard/Code/brain/mcp_server/brain-mcp.sh",
      "args": [],
      "env": {}
    }
  }
}
```

### 3. Bootstrap Command
The first thing Claude should try in any session where context is needed:
```
brain:init
```

This single command should:
- Load user preferences
- Show current context
- List available projects
- Suggest next actions

### 4. Claude README Pattern
Create a CLAUDE_README.md that gets loaded by brain:init:
```markdown
# Welcome Back!

You are Claude, and this is your Brain - a unified cognitive system.

## Who You're Working With
- Name: Mikey Bee
- Prefers: Python, no placeholders, systematic approach
- Current focus: [loaded from context]

## Recent Activity
[Show last 5 actions]

## Available Commands
- brain:recall [topic] - Remember information about any topic
- brain:remember [key] [value] - Store new information
- brain:execute [code] - Run code with immediate feedback
- brain:status - Check system health

## Suggested Next Action
[Based on recent activity and patterns]
```

### 5. Integration with User Preferences
The brain should store and recall:
- User's coding preferences
- Project locations
- Common patterns
- Frequently used commands

### 6. Self-Healing Features
- If brain:init fails, provide clear recovery instructions
- Auto-backup of critical data
- Graceful degradation if database is corrupted

### 7. Cross-Project Discovery
Even when working on other projects, brain should be discoverable:
- Store project metadata in brain
- Quick project switching via brain:project [name]
- Context preservation across projects

### 8. Documentation Strategy
Multiple touchpoints for discovery:
1. In claude_desktop_config.json comments
2. In project README files
3. As part of brain:init output
4. In error messages from other tools

### 9. Muscle Memory Training
Encourage patterns that build muscle memory:
- Always start with brain:init
- Use brain:remember for important information
- Use brain:recall when context is needed

### 10. Fallback Mechanisms
If brain isn't available:
- Clear error message with setup instructions
- Point to /Users/bard/Code/brain/
- Provide manual configuration steps

## Implementation Priority
1. Make brain:init bulletproof and informative
2. Ensure it's the first/only command needed
3. Make all output self-documenting
4. Build patterns that reinforce usage

## Success Metric
Claude should instinctively run brain:init at the start of any session where context or memory is needed, and this single command should provide everything needed to be productive.
