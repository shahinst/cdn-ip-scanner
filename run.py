#!/usr/bin/env python3
"""
CDN IP Scanner V2.0 - Web Server (Linux Edition)
Author: shahinst

Starts the Flask web application on a configurable port.
Optimized for Linux server deployment.
"""

import os
import sys
import signal

# Load .env from app directory first (so DB/settings work when run on server)
try:
    from pathlib import Path
    from dotenv import load_dotenv
    _root = Path(__file__).resolve().parent
    load_dotenv(_root / ".env")
except Exception:
    pass

import argparse


def main():
    # Graceful shutdown on SIGTERM (systemd sends this)
    def _sigterm_handler(signum, frame):
        sys.exit(0)
    signal.signal(signal.SIGTERM, _sigterm_handler)

    parser = argparse.ArgumentParser(description='CDN IP Scanner V2.0 Web Server')
    parser.add_argument('--host', default='127.0.0.1',
                        help='Host to bind (default: 127.0.0.1 for reverse proxy)')
    parser.add_argument('--port', type=int, default=int(os.environ.get('PORT', 8080)),
                        help='Port to run on (default: 8080)')
    parser.add_argument('--debug', action='store_true', help='Enable debug mode')
    parser.add_argument('--no-browser', action='store_true', default=True,
                        help='Do not auto-open browser (default on Linux)')
    args = parser.parse_args()

    from app import create_app, socketio
    app = create_app()

    url = f"http://{args.host}:{args.port}"
    print("")
    print("=" * 48)
    print("  CDN IP Scanner V 2.0 (Linux)")
    print("  Author: shahinst")
    print("-" * 48)
    print(f"  URL:    {url}")
    print(f"  Debug:  {args.debug}")
    print("=" * 48)
    print("", flush=True)

    # Run with Flask-SocketIO + gevent
    socketio.run(app, host=args.host, port=args.port, debug=args.debug,
                 allow_unsafe_werkzeug=True, use_reloader=False, log_output=True)


if __name__ == '__main__':
    main()
