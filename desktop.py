#!/usr/bin/env python3
"""
CDN IP Scanner - Desktop launcher (Windows / macOS / Linux)
Author: shahinst

Runs the scanner web server in a child process on 127.0.0.1 and shows it in a
native window (pywebview). Without a GUI backend it opens the default browser.

The server runs in its own process because it monkey-patches the standard
library with gevent, which does not mix with native GUI event loops.

Usage:
    python desktop.py              # native window (or browser fallback)
    python desktop.py --browser    # always use the default browser
"""

# Only lightweight stdlib modules at import time: the server child must apply
# gevent's monkey-patching before socket/ssl/threading are imported.
import os
import sys

APP_TITLE = 'CDN IP Scanner'
# A fixed port keeps subscription links (http://127.0.0.1:<port>/api/v2ray/subscription/..)
# valid across restarts; another free port is used if it is taken.
DEFAULT_PORT = int(os.environ.get('CDN_SCANNER_PORT', 8765))


def _data_dir():
    """Same location as app.config uses for packaged apps (kept free of app imports)."""
    if os.environ.get('CDN_SCANNER_DATA_DIR'):
        return os.environ['CDN_SCANNER_DATA_DIR']
    if not getattr(sys, 'frozen', False):
        return os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
    if sys.platform == 'win32':
        return os.path.join(os.environ.get('APPDATA') or os.path.expanduser('~'), 'CDN-IP-Scanner')
    if sys.platform == 'darwin':
        return os.path.expanduser('~/Library/Application Support/CDN-IP-Scanner')
    root = os.environ.get('XDG_DATA_HOME') or os.path.expanduser('~/.local/share')
    return os.path.join(root, 'cdn-ip-scanner')


def _port_is_free(port):
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(('127.0.0.1', port))
            return True
        except OSError:
            return False


def _pick_port():
    import socket
    if _port_is_free(DEFAULT_PORT):
        return DEFAULT_PORT
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


def _server_command(port):
    args = ['--server', '--parent-pid', str(os.getpid()), '--port', str(port)]
    if getattr(sys, 'frozen', False):
        return [sys.executable] + args
    return [sys.executable, os.path.abspath(__file__)] + args


def _wait_until_ready(url, proc, timeout=60):
    import time
    import urllib.request
    deadline = time.time() + timeout
    while time.time() < deadline:
        if proc.poll() is not None:
            return False
        try:
            with urllib.request.urlopen(url + '/api/info', timeout=2) as r:
                if r.status == 200:
                    return True
        except OSError:
            time.sleep(0.3)
    return False


def _show_error(message):
    print(message, file=sys.stderr)
    if sys.platform == 'win32':
        try:
            import ctypes
            ctypes.windll.user32.MessageBoxW(None, message, APP_TITLE, 0x10)
        except Exception:
            pass


def _wait_for_parent_exit(pid):
    """Block until process `pid` exits (runs in a real OS thread)."""
    import time
    if sys.platform == 'win32':
        import ctypes
        kernel32 = ctypes.windll.kernel32
        handle = kernel32.OpenProcess(0x00100000, False, pid)  # SYNCHRONIZE
        if handle:
            kernel32.WaitForSingleObject(handle, 0xFFFFFFFF)  # INFINITE
            kernel32.CloseHandle(handle)
            return
    while os.getppid() == pid:  # POSIX: re-parented once the launcher is gone
        time.sleep(1)


def run_server():
    """Child process: run the Flask/Socket.IO server until the launcher goes away."""
    from gevent import monkey
    monkey.patch_all()

    data_dir = _data_dir()
    os.makedirs(data_dir, exist_ok=True)
    os.environ.setdefault('CDN_SCANNER_DATA_DIR', data_dir)
    if getattr(sys, 'frozen', False) or sys.stdout is None:
        # Windowed builds have no console: keep a log file for troubleshooting.
        log = open(os.path.join(data_dir, 'scanner.log'), 'a', buffering=1, encoding='utf-8')
        sys.stdout = sys.stderr = log

    parent_pid = None
    if '--parent-pid' in sys.argv:
        i = sys.argv.index('--parent-pid')
        parent_pid = int(sys.argv[i + 1])
        del sys.argv[i:i + 2]
    if parent_pid:
        # Exit together with the launcher, even if it crashed. A real OS thread is
        # needed because the wait blocks (gevent has patched `threading`).
        start_thread = monkey.get_original('_thread', 'start_new_thread')

        def _watch():
            _wait_for_parent_exit(parent_pid)
            os._exit(0)
        start_thread(_watch, ())

    import run  # noqa: E402
    sys.argv = [sys.argv[0], '--host', '127.0.0.1'] + sys.argv[1:]
    run.main()


def main():
    if '--server' in sys.argv:
        sys.argv.remove('--server')
        run_server()
        return

    import subprocess
    import webbrowser

    force_browser = '--browser' in sys.argv
    port = _pick_port()
    url = f'http://127.0.0.1:{port}'

    data_dir = _data_dir()
    os.makedirs(data_dir, exist_ok=True)
    env = dict(os.environ, CDN_SCANNER_DATA_DIR=data_dir, PYTHONUNBUFFERED='1')
    kwargs = {}
    if sys.platform == 'win32':
        kwargs['creationflags'] = 0x08000000  # CREATE_NO_WINDOW
    proc = subprocess.Popen(_server_command(port), env=env, **kwargs)

    try:
        if not _wait_until_ready(url, proc):
            _show_error('CDN IP Scanner could not start.\nSee the log file in:\n' + data_dir)
            return 1

        opened_window = False
        if not force_browser:
            try:
                import webview
                webview.create_window(APP_TITLE, url + '/', width=1280, height=880, min_size=(900, 600))
                webview.start()
                opened_window = True
            except Exception as e:  # no GUI backend (e.g. Linux without GTK/Qt, missing WebView2)
                print(f'Native window unavailable ({e}); opening the browser instead.', file=sys.stderr)

        if not opened_window:
            webbrowser.open(url + '/')
            print(f'CDN IP Scanner is running at {url}  (press Ctrl+C to quit)')
            try:
                proc.wait()
            except KeyboardInterrupt:
                pass
        return 0
    finally:
        if proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()


if __name__ == '__main__':
    sys.exit(main())
