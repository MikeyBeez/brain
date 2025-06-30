# Brain Boot Process Design

## The Problem We're Solving
- No more scattered initialization files
- No more "read this, then that" in system messages
- Single source of truth: the knowledge graph

## Boot Process Flow

```
System Message (minimal)
    ↓
"Run brain:init"
    ↓
Brain reads initialization node from knowledge graph
    ↓
Knowledge graph says "read CENTRAL_INDEX.md for project"
    ↓
Claude now has context
```

## System Message (Simplified)

The system message becomes just:
```
At the start of each session, run brain:init to load context.
```

That's it. No file paths, no complex instructions.

## Knowledge Graph Structure

```json
{
  "nodes": [
    {
      "id": "claude_initialization",
      "type": "system",
      "properties": {
        "description": "Boot process for Claude sessions",
        "instructions": [
          "Load user preferences",
          "Check current project context",
          "Read CENTRAL_INDEX.md if in brain project directory"
        ],
        "user_preferences": {
          "preferred_language": "Python",
          "interests": ["AI", "ML"],
          "coding_style": "no_placeholders",
          "author_name": "Mikey Bee"
        }
      }
    },
    {
      "id": "brain_project",
      "type": "project",
      "properties": {
        "name": "Brain",
        "path": "/Users/bard/Code/brain",
        "central_index": "CENTRAL_INDEX.md",
        "status": "planning",
        "description": "Unified cognitive system"
      }
    }
  ],
  "edges": [
    {
      "source": "claude_initialization",
      "target": "brain_project",
      "type": "current_focus"
    }
  ]
}
```

## How brain:init Works

```python
def brain_init(session_id):
    # 1. Check if already initialized for this session
    if is_initialized(session_id):
        return cached_context(session_id)
    
    # 2. Load initialization node
    init_node = graph.get_node("claude_initialization")
    
    # 3. Follow edges to find current project
    current_project = graph.follow_edges(init_node, "current_focus")
    
    # 4. Load project-specific context
    if current_project and current_project.central_index:
        project_context = read_file(current_project.central_index)
    
    # 5. Assemble and return context
    return {
        "user_preferences": init_node.user_preferences,
        "current_project": current_project,
        "project_context": project_context,
        "available_tools": list_brain_tools()
    }
```

## Benefits

1. **Single Entry Point**: Just run brain:init
2. **Dynamic**: Can change focus by updating graph edges
3. **Clean System Message**: One line instead of paragraphs
4. **Extensible**: Add new projects as nodes
5. **Self-Documenting**: Graph structure is the documentation

## Migration Path

1. Brain stores initialization node on first run
2. System message updated to just reference brain:init
3. All project metadata moves to knowledge graph
4. Central indices remain for detailed project documentation
5. Notes/preferences/context all flow through the graph

## Key Principle

The knowledge graph is not just storage - it's the boot loader, the context manager, and the source of truth. Everything else (including CENTRAL_INDEX.md) is just content that the graph points to.
