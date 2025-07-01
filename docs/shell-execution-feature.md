# Shell Execution Feature Demo

The Brain system now supports automatic language detection and native shell execution!

## Examples of Auto-Detection

### Shell Commands (auto-detected)
- `ls -la` - List files
- `pwd` - Print working directory  
- `echo "Hello World"` - Echo text
- `cat file.txt | grep pattern` - Pipes work!
- `mkdir test && cd test` - Command chaining
- `mv old.txt new.txt` - File operations

### Python Code (auto-detected)
- `print("Hello")` - Python print
- `import os; os.getcwd()` - Python imports
- Multi-line Python with proper indentation

## Language Override
You can also explicitly specify the language:
- `brain_execute(code="echo test", language="shell")`
- `brain_execute(code="print('test')", language="python")`

## How It Works
The LanguageDetector class analyzes the code for:
1. Shell command patterns (ls, cd, mv, etc.)
2. Shell operators (|, >, &&, ||)
3. Python patterns (import, def, class, colons)
4. Syntax structures unique to each language

The system then routes to the appropriate executor:
- ShellExecutor for bash/shell commands
- PythonExecutor for Python code (maintains REPL state)

This makes the Brain system much more intuitive for quick file operations and system commands!
