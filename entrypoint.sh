#!/bin/bash
export LD_LIBRARY_PATH=/app/site-packages/dlib:$LD_LIBRARY_PATH
exec /usr/local/bin/python3 /app/start_api.py
