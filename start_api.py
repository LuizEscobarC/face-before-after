#!/usr/bin/env python3
import sys
sys.path.insert(0, '/app/site-packages')

import uvicorn
import api_server

if __name__ == '__main__':
    uvicorn.run(api_server.app, host='0.0.0.0', port=8000)
