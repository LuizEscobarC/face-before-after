#!/bin/bash
exec /usr/local/bin/python3 -m uvicorn main:app --host 0.0.0.0 --port 8000
