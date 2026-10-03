#!/usr/bin/env python3
"""
Start a built executable in server mode and check that the app answers.

    python packaging/smoke_test.py [path/to/executable]

Without an argument the path is read from release/executable.txt (written by build.py).
"""

import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 18765


def get(path):
    with urllib.request.urlopen(f'http://127.0.0.1:{PORT}{path}', timeout=5) as r:
        return r.status, r.read()


def main():
    if len(sys.argv) > 1:
        exe = sys.argv[1]
    else:
        with open(os.path.join(ROOT, 'release', 'executable.txt'), encoding='utf-8') as f:
            exe = f.read().strip()
    data_dir = tempfile.mkdtemp(prefix='cdn-scanner-smoke-')
    env = dict(os.environ, CDN_SCANNER_DATA_DIR=data_dir)
    proc = subprocess.Popen([exe, '--server', '--port', str(PORT)], env=env)
    try:
        deadline = time.time() + 90
        while True:
            if proc.poll() is not None:
                raise SystemExit(f'Executable exited early with code {proc.returncode}')
            try:
                status, body = get('/api/info')
                break
            except OSError:
                if time.time() > deadline:
                    raise SystemExit('Server did not start within 90s')
                time.sleep(1)
        info = json.loads(body)
        print('api/info:', info)
        assert status == 200 and info['version']
        status, body = get('/scanner/en')
        assert status == 200 and b'resultsTable' in body, 'scanner page missing'
        status, body = get('/static/vendor/socket.io.min.js')
        assert status == 200 and b'Socket.IO' in body, 'bundled static files missing'
        status, _ = get('/socket.io/?EIO=4&transport=polling')
        assert status == 200, 'Socket.IO endpoint not working'
        status, body = get('/api/xray/status')
        xray = json.loads(body)
        print('xray:', xray)
        assert xray['available'], 'bundled Xray-core not found'
        print('Smoke test passed')
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
        log = os.path.join(data_dir, 'scanner.log')
        if os.path.exists(log):
            with open(log, encoding='utf-8', errors='replace') as f:
                tail = f.read()[-3000:]
            print('--- scanner.log (tail) ---\n' + tail)


if __name__ == '__main__':
    main()
