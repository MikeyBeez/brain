#!/usr/bin/env python3
"""
Brain Execute Wrapper - Adds logging to brain_execute commands

This wrapper intercepts brain_execute calls and ensures they are logged
for Monitex to display.
"""

import json
import os
import sys
import subprocess
import datetime
import hashlib
import time

LOG_DIR = "/Users/bard/Code/brain/logs/execution"

def create_log_entry(code, language, description, status="running"):
    """Create a log entry for an execution"""
    timestamp = datetime.datetime.now()
    
    # Create unique ID
    hash_input = f"{timestamp.isoformat()}-{code[:50]}"
    exec_id = f"exec-{timestamp.strftime('%Y-%m-%d-%H%M%S')}-{hashlib.md5(hash_input.encode()).hexdigest()[:8]}"
    
    log_entry = {
        "id": exec_id,
        "timestamp": timestamp.isoformat(),
        "type": language,
        "description": description or f"Execute {language} code",
        "code": code,
        "status": status,
        "output": "",
        "error": "",
        "execution_time": 0
    }
    
    return exec_id, log_entry

def save_log(exec_id, log_entry):
    """Save log entry to file"""
    os.makedirs(LOG_DIR, exist_ok=True)
    log_file = os.path.join(LOG_DIR, f"{exec_id}.json")
    
    with open(log_file, 'w') as f:
        json.dump(log_entry, f, indent=2)
    
    return log_file

def execute_code(code, language='python'):
    """Execute code and return output/error"""
    start_time = time.time()
    
    try:
        if language == 'python':
            result = subprocess.run(
                ['python3', '-c', code],
                capture_output=True,
                text=True,
                timeout=30  # 30 second timeout
            )
        else:  # shell
            result = subprocess.run(
                code,
                shell=True,
                capture_output=True,
                text=True,
                timeout=30
            )
        
        execution_time = time.time() - start_time
        return result.stdout, result.stderr, "completed", execution_time
        
    except subprocess.TimeoutExpired:
        execution_time = time.time() - start_time
        return "", "Execution timed out after 30 seconds", "timeout", execution_time
    except Exception as e:
        execution_time = time.time() - start_time
        return "", str(e), "error", execution_time

def wrap_execute(code, language='auto', description=None):
    """Main wrapper function"""
    # Auto-detect language
    if language == 'auto':
        if 'import ' in code or 'def ' in code or 'print(' in code:
            language = 'python'
        else:
            language = 'shell'
    
    # Create initial log entry
    exec_id, log_entry = create_log_entry(code, language, description)
    log_file = save_log(exec_id, log_entry)
    
    # Execute the code
    output, error, status, exec_time = execute_code(code, language)
    
    # Update log entry
    log_entry['output'] = output
    log_entry['error'] = error
    log_entry['status'] = status
    log_entry['execution_time'] = exec_time * 1000  # Convert to ms
    
    # Save updated log
    save_log(exec_id, log_entry)
    
    # Return formatted output (similar to brain_execute)
    result = ""
    if language == 'python':
        result = f"🐍 Executing python code: {description or 'No description provided'}\n"
    else:
        result = f"🖥️ Executing shell command: {description or 'No description provided'}\n"
    
    if output:
        result += f"📤 Output:{output}"
    if error:
        result += f"⚠️ Errors:{error}"
    
    result += f"⏱️ Execution time: {int(exec_time * 1000)}ms"
    
    return result

if __name__ == "__main__":
    # Test the wrapper
    print("=== Testing Brain Execute Wrapper ===")
    
    test_code = '''
import datetime
print(f"Wrapper test at {datetime.datetime.now()}")
print("This should appear in Monitex!")
    '''
    
    result = wrap_execute(test_code, description="Test wrapper functionality")
    print(result)
    
    print("\n✅ Check Monitex to see if this execution appears!")
