#!/usr/bin/env python
"""Reset demo database."""

import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db import reset_db

if __name__ == "__main__":
    reset_db()
    print("Demo database reset successfully!")
