"""Daily backup scheduler — runs backup.py at 02:00 every day."""
import time
import subprocess
import datetime
import sys

print("Backup scheduler started", flush=True)

ran_today = None
while True:
    now = datetime.datetime.now()
    today = now.date()
    if now.hour == 2 and now.minute == 0 and ran_today != today:
        print(f"Running backup at {now}", flush=True)
        subprocess.run([sys.executable, "scripts/backup.py"])
        ran_today = today
    time.sleep(30)
