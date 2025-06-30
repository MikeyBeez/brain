# Universal Tool Knowledge for Brain

## brain:remember
```typescript
brain:remember({
  key: string,        // Unique identifier
  value: any,         // Can be string, object, array, etc.
  type?: string,      // Optional categorization
  tags?: string[]     // Optional tags for search
})
```

## brain:recall
```typescript
brain:recall({
  query: string,      // Search term
  type?: string,      // Filter by type
  tags?: string[],    // Filter by tags
  limit?: number      // Max results (default: 10)
})
```

## brain:execute
```typescript
brain:execute({
  code: string,       // Code or command to run
  language?: string,  // "python" (default), "bash", "node"
  timeout?: number,   // Max seconds to run
  description?: string // For monitoring
})
```

## brain:init
```typescript
brain:init({
  session_id?: string  // Optional, for resuming
})
// Always run this first in a new chat
// Loads max 300 most relevant memories
```

## brain:status
```typescript
brain:status({
  session_id?: string,    // Check session
  execution_id?: string   // Check specific execution
})
```

## brain:help
```typescript
brain:help({
  tool_name?: string  // Omit for list of all tools
})
```

## brain:set_safety_level
```typescript
brain:set_safety_level({
  level: "confirmation" | "autonomous"
})
```

## Common Patterns

### Check and Initialize
```typescript
// Start of every session
const status = await brain:status();
if (status.status === 'not_initialized') {
  await brain:init();
}
```

### Store and Retrieve
```typescript
// Store
await brain:remember({
  key: "api_keys",
  value: { openai: "...", anthropic: "..." },
  type: "credentials",
  tags: ["sensitive", "api"]
});

// Retrieve
const result = await brain:recall({
  query: "api_keys",
  type: "credentials"
});
```

### Execute with Safety Check
```typescript
// In confirmation mode
const safety = await brain:recall({ query: "system.safety_level" });
if (safety === "confirmation") {
  // Ask user before executing
  console.log("About to run: npm install");
  // Wait for user confirmation
}
await brain:execute({ code: "npm install", language: "bash" });
```
