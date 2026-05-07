#!/bin/bash
export LD_LIBRARY_PATH=/app/site-packages/dlib:$LD_LIBRARY_PATH
exec /usr/local/bin/python3 -m uvicorn main:app --host 0.0.0.0 --port 8000
