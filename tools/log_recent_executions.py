#!/usr/bin/env python3
"""
Brain Execute Logger - Manual logging for brain_execute commands
Run this after executing commands to create logs for Monitex
"""

import json
import os
import datetime
import hashlib
import sys

LOG_DIR = "/Users/bard/Code/brain/logs/execution"

def log_execution(description, code, output, language="auto", error="", exec_time_ms=100):
    """Manually create a log entry for an execution"""
    
    # Auto-detect language
    if language == "auto":
        if 'import ' in code or 'def ' in code or 'print(' in code:
            language = "python"
        else:
            language = "shell"
    
    timestamp = datetime.datetime.now()
    exec_id = f"exec-{timestamp.strftime('%Y-%m-%d-%H%M%S')}-{hashlib.md5(code.encode()).hexdigest()[:8]}"
    
    log_entry = {
        "id": exec_id,
        "timestamp": timestamp.isoformat(),
        "type": language,
        "description": description,
        "code": code,
        "status": "completed" if not error else "error",
        "output": output,
        "error": error,
        "execution_time": exec_time_ms
    }
    
    os.makedirs(LOG_DIR, exist_ok=True)
    log_file = os.path.join(LOG_DIR, f"{exec_id}.json")
    
    with open(log_file, 'w') as f:
        json.dump(log_entry, f, indent=2)
    
    print(f"✅ Logged execution: {exec_id}")
    print(f"   Description: {description}")
    print(f"   Check Monitex to see this execution!")
    
    return exec_id

# Log our recent executions
if __name__ == "__main__":
    print("🧠 Logging recent brain_execute commands...\n")
    
    # Log the directory listing
    log_execution(
        description="List contents of brain tools directory",
        code="ls -la /Users/bard/Code/brain/tools/",
        output="""total 16
drwxr-xr-x@  4 bard  staff   128 Jul  7 10:20 .
drwxr-xr-x@ 71 bard  staff  2272 Jul  7 10:18 ..
-rw-r--r--@  1 bard  staff  4061 Jul  7 10:19 brain_execute_wrapper.py
-rw-r--r--@  1 bard  staff  3101 Jul  7 10:20 execution_monitor.py""",
        language="shell",
        exec_time_ms=22
    )
    
    # Log the log checking execution
    log_execution(
        description="Check if recent execution was logged",
        code="""import os
import json
from datetime import datetime

log_dir = "/Users/bard/Code/brain/logs/execution"
log_files = sorted([f for f in os.listdir(log_dir) if f.endswith('.json')], reverse=True)
# ... rest of code ...""",
        output="=== Checking execution logs (Total: 3) ===\n[truncated]",
        language="python",
        exec_time_ms=29
    )
    
    print("\n✅ Recent executions have been logged!")
    print("📊 Refresh Monitex to see them: http://localhost:9996/execution-monitor.html")
