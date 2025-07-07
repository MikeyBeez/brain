#!/usr/bin/env python3
"""
Brain Execution Monitor
Watches for brain_execute commands and creates logs for Monitex
"""

import os
import json
import time
import datetime
import hashlib
import subprocess
from pathlib import Path

LOG_DIR = Path("/Users/bard/Code/brain/logs/execution")
LOG_DIR.mkdir(parents=True, exist_ok=True)

def create_mock_logs():
    """Create some test logs to verify Monitex is working"""
    test_executions = [
        {
            "description": "Test execution from monitor script",
            "code": "print('Monitor script test')",
            "language": "python",
            "output": "Monitor script test\n",
            "status": "completed"
        },
        {
            "description": "Check Python version",
            "code": "import sys; print(sys.version)",
            "language": "python",
            "output": "3.11.6 (main, Nov  2 2023, 04:39:43) [Clang 14.0.3 (clang-1403.0.22.14.1)]\n",
            "status": "completed"
        },
        {
            "description": "List brain directory",
            "code": "ls -la /Users/bard/Code/brain | head -5",
            "language": "shell",
            "output": "total 32\ndrwxr-xr-x  13 bard  staff   416 Nov  7 10:16 .\ndrwxr-xr-x  47 bard  staff  1504 Nov  7 09:58 ..\n",
            "status": "completed"
        }
    ]
    
    for i, exec_data in enumerate(test_executions):
        timestamp = datetime.datetime.now() - datetime.timedelta(minutes=i*5)
        exec_id = f"exec-{timestamp.strftime('%Y-%m-%d-%H%M%S')}-test{i}"
        
        log_entry = {
            "id": exec_id,
            "timestamp": timestamp.isoformat(),
            "type": exec_data["language"],
            "description": exec_data["description"],
            "code": exec_data["code"],
            "status": exec_data["status"],
            "output": exec_data["output"],
            "error": "",
            "execution_time": 100 + i * 50
        }
        
        log_file = LOG_DIR / f"{exec_id}.json"
        with open(log_file, 'w') as f:
            json.dump(log_entry, f, indent=2)
        
        print(f"✅ Created test log: {exec_id}")

def clean_old_logs():
    """Clean up corrupted log files"""
    for log_file in LOG_DIR.glob("*.json"):
        try:
            with open(log_file, 'r') as f:
                json.load(f)  # Try to parse
        except json.JSONDecodeError:
            print(f"❌ Removing corrupted log: {log_file.name}")
            log_file.unlink()

if __name__ == "__main__":
    print("🧠 Brain Execution Monitor")
    print("=" * 50)
    
    # Clean up old corrupted logs
    print("\nCleaning corrupted logs...")
    clean_old_logs()
    
    # Create some test logs
    print("\nCreating test execution logs...")
    create_mock_logs()
    
    print("\n✅ Monitor setup complete!")
    print("📊 Check Monitex at: http://localhost:9996/execution-monitor.html")
    print("   You should now see the test executions")
    
    # Show current log count
    log_count = len(list(LOG_DIR.glob("*.json")))
    print(f"\n📁 Total execution logs: {log_count}")
