#!/usr/bin/env python3
"""
Build the standalone desktop app with PyInstaller and pack it for release.

    pip install -r requirements-desktop.txt
    python packaging/build.py

Output (in ./release):
    CDN-IP-Scanner-<version>-<platform>.zip|.tar.gz  + .sha256
and ./release/executable.txt with the path of the built executable (used by CI).
"""

import hashlib
import os
import platform
import shutil
import subprocess
import sys
import tarfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NAME = 'CDN-IP-Scanner'
SEP = ';' if sys.platform == 'win32' else ':'

HIDDEN_IMPORTS = [
    # Socket.IO picks its async driver and SQLAlchemy its dialects dynamically
    'engineio.async_drivers.gevent',
    'engineio.async_drivers.threading',
    'geventwebsocket.handler',
    'gevent.monkey',
    'sqlalchemy.dialects.sqlite',
    'sqlalchemy.dialects.mysql',
    'pymysql',
    'run',
    'app.config',  # loaded by name via app.config.from_object()
]


def platform_tag():
    machine = platform.machine().lower()
    arch = 'arm64' if machine in ('arm64', 'aarch64') else 'x64'
    osname = {'win32': 'windows', 'darwin': 'macos'}.get(sys.platform, 'linux')
    return f'{osname}-{arch}'


def read_version():
    with open(os.path.join(ROOT, 'version'), encoding='utf-8') as f:
        return f.read().strip()


def run_pyinstaller():
    args = [
        sys.executable, '-m', 'PyInstaller', os.path.join(ROOT, 'desktop.py'),
        '--name', NAME, '--noconfirm', '--clean', '--onedir',
        '--distpath', os.path.join(ROOT, 'dist'),
        '--workpath', os.path.join(ROOT, 'build'),
        '--specpath', os.path.join(ROOT, 'build'),
        '--paths', ROOT,
        '--add-data', f'{os.path.join(ROOT, "app", "templates")}{SEP}app/templates',
        '--add-data', f'{os.path.join(ROOT, "app", "static")}{SEP}app/static',
        '--add-data', f'{os.path.join(ROOT, "version")}{SEP}.',
        '--icon', os.path.join(ROOT, 'app', 'static', 'img', 'logo.png'),
    ]
    for mod in HIDDEN_IMPORTS:
        args += ['--hidden-import', mod]
    args += ['--collect-submodules', 'app']
    if sys.platform in ('win32', 'darwin'):
        args.append('--windowed')  # no console window; the server logs to scanner.log
    if sys.platform == 'darwin':
        args += ['--osx-bundle-identifier', 'com.shahinst.cdnipscanner']
    print('+', ' '.join(args), flush=True)
    subprocess.check_call(args, cwd=ROOT)


def executable_path():
    dist = os.path.join(ROOT, 'dist')
    if sys.platform == 'darwin':
        return os.path.join(dist, f'{NAME}.app', 'Contents', 'MacOS', NAME)
    exe = NAME + ('.exe' if sys.platform == 'win32' else '')
    return os.path.join(dist, NAME, exe)


def package(version):
    out_dir = os.path.join(ROOT, 'release')
    os.makedirs(out_dir, exist_ok=True)
    base = os.path.join(out_dir, f'{NAME}-{version}-{platform_tag()}')
    dist = os.path.join(ROOT, 'dist')
    if sys.platform == 'darwin':
        archive = base + '.zip'
        # ditto keeps the .app bundle's symlinks and permissions intact
        subprocess.check_call(['ditto', '-c', '-k', '--keepParent',
                               os.path.join(dist, f'{NAME}.app'), archive])
    elif sys.platform == 'win32':
        archive = shutil.make_archive(base, 'zip', dist, NAME)
    else:
        archive = base + '.tar.gz'
        with tarfile.open(archive, 'w:gz') as tar:
            tar.add(os.path.join(dist, NAME), arcname=NAME)

    h = hashlib.sha256()
    with open(archive, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    with open(archive + '.sha256', 'w', encoding='utf-8') as f:
        f.write(f'{h.hexdigest()}  {os.path.basename(archive)}\n')
    with open(os.path.join(out_dir, 'executable.txt'), 'w', encoding='utf-8') as f:
        f.write(executable_path())
    return archive


def main():
    version = read_version()
    run_pyinstaller()
    if not os.path.exists(executable_path()):
        sys.exit(f'Build failed: {executable_path()} not found')
    archive = package(version)
    print(f'Built {archive}')


if __name__ == '__main__':
    main()
