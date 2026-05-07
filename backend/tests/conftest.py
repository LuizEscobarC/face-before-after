from __future__ import annotations

import sys
from pathlib import Path

# Ensure backend/ is on sys.path so `app.*` imports resolve
sys.path.insert(0, str(Path(__file__).parents[1]))
