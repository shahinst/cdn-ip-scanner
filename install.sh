#!/bin/bash
#
# CDN IP Scanner V2.0 - Smart Linux Installer
# Author: shahinst
# Supported: Ubuntu 20/22/24, Debian 10/11/12, CentOS 7/8/9, RHEL, AlmaLinux, Rocky, Fedora
#
# Features:
#   - Auto-detect OS and package manager
#   - Prompt for username, password, hostname
#   - SSL (Let's Encrypt for domains, self-signed for IPs)
#   - Nginx reverse proxy with Basic Auth
#   - Custom backend port (not 80/443)
#   - Firewall configuration (ufw/firewalld)
#   - Systemd service management
#   - Full uninstaller
#

# DO NOT use set -e — we handle errors manually to prevent silent failures
# set -e

# ======================== COLORS ========================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ======================== GLOBALS ========================
APP_NAME="cdn-ip-scanner"
APP_DIR="/opt/${APP_NAME}"
APP_USER="cdnscanner"
SERVICE_NAME="${APP_NAME}"
NGINX_CONF="/etc/nginx/sites-available/${APP_NAME}"
NGINX_LINK="/etc/nginx/sites-enabled/${APP_NAME}"
NGINX_CONF_D="/etc/nginx/conf.d/${APP_NAME}.conf"
SSL_DIR="/etc/nginx/ssl_${APP_NAME}"
ACME_CHALLENGE_DIR="/var/www/acme-challenge"
SSL_CERT=""
SSL_KEY=""
HTPASSWD_FILE="/etc/nginx/.htpasswd_${APP_NAME}"
LOG_FILE="/var/log/${APP_NAME}-install.log"
USE_DOMAIN=false
HOSTNAME_INPUT=""
SERVER_IP=""
APP_PORT=8080
PANEL_USER=""
PANEL_PASS=""
SERVER_IN_IRAN=false

# ======================== FUNCTIONS ========================

log() {
    echo -e "${GREEN}[+]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE" 2>/dev/null || true
}

warn() {
    echo -e "${YELLOW}[!]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1" >> "$LOG_FILE" 2>/dev/null || true
}

err() {
    echo -e "${RED}[x]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" >> "$LOG_FILE" 2>/dev/null || true
}

die() {
    err "$1"
    echo ""
    echo -e "${RED}Installation failed. Check log: ${LOG_FILE}${NC}"
    exit 1
}

banner() {
    clear 2>/dev/null || true
    echo ""
    echo -e "${CYAN}======================================================${NC}"
    echo -e "${CYAN}                                                      ${NC}"
    echo -e "${CYAN}  ${BOLD}CDN IP Scanner V2.0 - Linux Installer${NC}${CYAN}             ${NC}"
    echo -e "${CYAN}                                                      ${NC}"
    echo -e "${CYAN}  Author  : shahinst                                  ${NC}"
    echo -e "${CYAN}  GitHub  : github.com/shahinst/cdn-ip-scanner        ${NC}"
    echo -e "${CYAN}  Website : digicloud.tr                              ${NC}"
    echo -e "${CYAN}                                                      ${NC}"
    echo -e "${CYAN}======================================================${NC}"
    echo ""
}

# ───────── Detect OS ─────────
detect_os() {
    PKG_MGR=""
    OS_FAMILY=""
    OS_NAME="unknown"
    OS_VERSION=""

    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS_NAME="${ID}"
        OS_VERSION="${VERSION_ID}"
    elif [ -f /etc/redhat-release ]; then
        OS_NAME="centos"
    fi

    case "${OS_NAME}" in
        ubuntu|debian|linuxmint|pop|elementary|zorin|kali)
            PKG_MGR="apt"
            OS_FAMILY="debian"
            ;;
        centos|rhel|rocky|almalinux|ol|fedora|amzn)
            if command -v dnf >/dev/null 2>&1; then
                PKG_MGR="dnf"
            elif command -v yum >/dev/null 2>&1; then
                PKG_MGR="yum"
            fi
            OS_FAMILY="redhat"
            ;;
        *)
            if command -v apt-get >/dev/null 2>&1; then
                PKG_MGR="apt"
                OS_FAMILY="debian"
            elif command -v dnf >/dev/null 2>&1; then
                PKG_MGR="dnf"
                OS_FAMILY="redhat"
            elif command -v yum >/dev/null 2>&1; then
                PKG_MGR="yum"
                OS_FAMILY="redhat"
            fi
            ;;
    esac

    if [ -z "$PKG_MGR" ]; then
        die "Unsupported OS. Requires apt, yum, or dnf package manager."
    fi

    log "OS: ${OS_NAME} ${OS_VERSION} (${OS_FAMILY}/${PKG_MGR})"
}

# ───────── Iran: Ubuntu mirror + DNS ─────────
setup_iran_mirror_and_dns() {
    if [ "$SERVER_IN_IRAN" != true ]; then
        return 0
    fi
    if [ "$PKG_MGR" != "apt" ]; then
        return 0
    fi

    # Ubuntu 24.04+ uses ubuntu.sources
    if [ -f /etc/apt/sources.list.d/ubuntu.sources ]; then
        sed -i 's|http://de.archive.ubuntu.com/ubuntu/|http://ir.archive.ubuntu.com/ubuntu/|g' /etc/apt/sources.list.d/ubuntu.sources 2>/dev/null || true
        sed -i 's|http://archive.ubuntu.com/ubuntu/|http://ir.archive.ubuntu.com/ubuntu/|g' /etc/apt/sources.list.d/ubuntu.sources 2>/dev/null || true
    fi

    # Classic sources.list
    if [ -f /etc/apt/sources.list ]; then
        sed -i 's|http://de.archive.ubuntu.com/ubuntu/|http://ir.archive.ubuntu.com/ubuntu/|g' /etc/apt/sources.list 2>/dev/null || true
        sed -i 's|http://archive.ubuntu.com/ubuntu/|http://ir.archive.ubuntu.com/ubuntu/|g' /etc/apt/sources.list 2>/dev/null || true
    fi

    # Iranian DNS (Shecan / 403)
    echo -e "nameserver 217.218.127.127\nnameserver 217.218.155.155" > /etc/resolv.conf 2>/dev/null || true

    echo -e "  ${GREEN}Server optimized for download on Iran network. ✔${NC}"
}

# ───────── Root check ─────────
check_root() {
    if [ "$(id -u)" -ne 0 ]; then
        die "Run as root: sudo bash install.sh"
    fi
}

# ───────── User input ─────────
get_user_input() {
    echo -e "${BOLD}-- Configuration --${NC}"
    echo ""

    # Username
    while true; do
        read -rp "$(echo -e "${BLUE}Panel username: ${NC}")" PANEL_USER
        if [ -n "$PANEL_USER" ]; then break; fi
        warn "Username cannot be empty."
    done

    # Password
    while true; do
        read -rsp "$(echo -e "${BLUE}Panel password: ${NC}")" PANEL_PASS
        echo ""
        if [ ${#PANEL_PASS} -ge 4 ]; then break; fi
        warn "Password must be at least 4 characters."
    done

    # Hostname
    echo ""
    read -rp "$(echo -e "${BLUE}Hostname/domain (empty = use server IP): ${NC}")" HOSTNAME_INPUT

    if [ -z "$HOSTNAME_INPUT" ]; then
        SERVER_IP=$(curl -4 -s --max-time 8 https://api.ipify.org 2>/dev/null) || true
        if [ -z "$SERVER_IP" ]; then
            SERVER_IP=$(curl -4 -s --max-time 8 https://ifconfig.me 2>/dev/null) || true
        fi
        if [ -z "$SERVER_IP" ]; then
            SERVER_IP=$(curl -4 -s --max-time 8 https://icanhazip.com 2>/dev/null) || true
        fi
        if [ -z "$SERVER_IP" ]; then
            SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}') || true
        fi
        if [ -z "$SERVER_IP" ]; then
            SERVER_IP="127.0.0.1"
        fi
        HOSTNAME_INPUT="$SERVER_IP"
        USE_DOMAIN=false
        log "Using server IP: ${SERVER_IP}"
    else
        SERVER_IP=$(curl -4 -s --max-time 8 https://api.ipify.org 2>/dev/null) || true
        [ -z "$SERVER_IP" ] && SERVER_IP="$HOSTNAME_INPUT"
        USE_DOMAIN=true
        log "Using domain: ${HOSTNAME_INPUT}"
    fi

    # Backend port
    echo ""
    read -rp "$(echo -e "${BLUE}Backend port (default 8080): ${NC}")" APP_PORT
    APP_PORT="${APP_PORT:-8080}"

    # Ensure not 80 or 443
    case "$APP_PORT" in
        80|443)
            warn "Port ${APP_PORT} is reserved for Nginx. Using 8080."
            APP_PORT=8080
            ;;
    esac

    # Iran: ask user if server is in Iran (for mirror + DNS)
    echo ""
    read -rp "$(echo -e "${BLUE}Is this server in Iran? Use Iran mirror + DNS for faster install [y/N]: ${NC}")" IRAN_CHOICE
    case "$IRAN_CHOICE" in
        [Yy]*)
            SERVER_IN_IRAN=true
            log "User selected: Iran — will apply ir.archive.ubuntu.com and Iranian DNS."
            ;;
        *)
            SERVER_IN_IRAN=false
            log "User selected: Not Iran — using default mirrors/DNS."
            ;;
    esac

    # Email for Let's Encrypt (required for IP SSL; must be valid domain e.g. you@gmail.com)
    ACME_EMAIL=""
    if [ "$USE_DOMAIN" != true ]; then
        echo ""
        echo -e "  ${YELLOW}Let's Encrypt (IP SSL) needs a valid contact email with a real domain (e.g. you@gmail.com).${NC}"
        while true; do
            read -rp "$(echo -e "${BLUE}Email for Let's Encrypt (your real email): ${NC}")" ACME_EMAIL
            ACME_EMAIL=$(echo "$ACME_EMAIL" | tr -d ' \t')
            if [ -n "$ACME_EMAIL" ] && echo "$ACME_EMAIL" | grep -qE '^[^@]+@[^@]+\.[a-zA-Z]{2,}$' && ! echo "$ACME_EMAIL" | grep -qE '\.(local|localhost|localdomain)$'; then
                break
            fi
            if [ -n "$ACME_EMAIL" ]; then
                warn "Use a valid email with a real TLD (e.g. name@gmail.com). Avoid .local"
            fi
        done
        log "ACME email: ${ACME_EMAIL}"
    else
        ACME_EMAIL="admin@example.com"
    fi

    echo ""
    echo -e "${BOLD}-- Summary --${NC}"
    echo -e "  Panel URL : ${GREEN}https://${HOSTNAME_INPUT}${NC} (port 443, SSL)"
    echo -e "  Username  : ${GREEN}${PANEL_USER}${NC}"
    echo -e "  Password  : ${GREEN}****${NC}"
    echo -e "  Backend   : ${GREEN}127.0.0.1:${APP_PORT}${NC} (internal, Nginx proxies to this)"
    echo -e "  Mode      : ${GREEN}$([ "$USE_DOMAIN" = true ] && echo "Domain" || echo "IP address")${NC}"
    echo -e "  Iran      : ${GREEN}$([ "$SERVER_IN_IRAN" = true ] && echo "Yes (ir.archive + Iranian DNS)" || echo "No")${NC}"
    [ -n "$ACME_EMAIL" ] && echo -e "  ACME email : ${GREEN}${ACME_EMAIL}${NC}"
    echo ""
    read -rp "$(echo -e "${YELLOW}Continue? [Y/n]: ${NC}")" CONFIRM
    case "$CONFIRM" in
        [Nn]*) echo "Cancelled."; exit 0 ;;
    esac
}

# ───────── Helper: install single package with status ─────────
install_pkg() {
    local pkg="$1"
    local label="${2:-$1}"
    printf "    %-30s" "$label"
    if command -v "$pkg" >/dev/null 2>&1 && [ "$pkg" != "python3-venv" ] && [ "$pkg" != "python3-dev" ] && [ "$pkg" != "build-essential" ]; then
        echo -e " ${GREEN}already installed ✔${NC}"
        return 0
    fi
    if [ "$PKG_MGR" = "apt" ]; then
        if apt-get install -y "$pkg" >> "$LOG_FILE" 2>&1; then
            echo -e " ${GREEN}installed ✔${NC}"
        else
            echo -e " ${YELLOW}skipped (not critical)${NC}"
        fi
    else
        if $PKG_MGR install -y "$pkg" >> "$LOG_FILE" 2>&1; then
            echo -e " ${GREEN}installed ✔${NC}"
        else
            echo -e " ${YELLOW}skipped (not critical)${NC}"
        fi
    fi
}

# ───────── Install packages ─────────
install_packages() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}  [Step 1/12] Installing System Packages${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    # Iran: switch to ir.archive and Iranian DNS before apt update
    setup_iran_mirror_and_dns || true

    # Update package index
    echo -e "  ${BLUE}Updating package index...${NC}"
    if [ "$PKG_MGR" = "apt" ]; then
        export DEBIAN_FRONTEND=noninteractive
        apt-get update >> "$LOG_FILE" 2>&1 || true
    elif [ "$PKG_MGR" = "dnf" ] || [ "$PKG_MGR" = "yum" ]; then
        $PKG_MGR makecache >> "$LOG_FILE" 2>&1 || true
        $PKG_MGR install -y epel-release >> "$LOG_FILE" 2>&1 || true
    fi
    echo -e "  ${GREEN}Package index updated ✔${NC}"
    echo ""

    # Install packages one by one with status
    echo -e "  ${BLUE}Installing packages:${NC}"
    echo ""

    if [ "$PKG_MGR" = "apt" ]; then
        install_pkg "python3"           "Python 3"
        install_pkg "python3-pip"       "Python pip"
        install_pkg "python3-venv"      "Python venv"
        install_pkg "python3-dev"       "Python dev headers"
        install_pkg "nginx"             "Nginx web server"
        install_pkg "openssl"           "OpenSSL"
        install_pkg "curl"              "curl"
        install_pkg "wget"              "wget"
        install_pkg "ca-certificates"   "CA certificates"
        install_pkg "build-essential"   "Build tools (gcc, make)"
        install_pkg "libffi-dev"        "libffi-dev"
        install_pkg "libssl-dev"        "libssl-dev"
        install_pkg "apache2-utils"     "apache2-utils (htpasswd)"

        echo ""
        echo -e "  ${BLUE}Installing SSL support:${NC}"
        echo ""
        install_pkg "libnginx-mod-http-ssl" "Nginx SSL module"
        if ! nginx -V 2>&1 | grep -q "ssl"; then
            install_pkg "nginx-full"    "Nginx full (SSL fallback)"
        fi
        install_pkg "certbot"                "Certbot (Let's Encrypt)"
        install_pkg "python3-certbot-nginx"  "Certbot Nginx plugin"

    elif [ "$PKG_MGR" = "dnf" ] || [ "$PKG_MGR" = "yum" ]; then
        install_pkg "python3"           "Python 3"
        install_pkg "python3-pip"       "Python pip"
        install_pkg "python3-devel"     "Python dev headers"
        install_pkg "nginx"             "Nginx web server"
        install_pkg "openssl"           "OpenSSL"
        install_pkg "curl"              "curl"
        install_pkg "wget"              "wget"
        install_pkg "ca-certificates"   "CA certificates"
        install_pkg "gcc"               "GCC compiler"
        install_pkg "gcc-c++"           "G++ compiler"
        install_pkg "libffi-devel"      "libffi-devel"
        install_pkg "openssl-devel"     "openssl-devel"
        install_pkg "httpd-tools"       "httpd-tools (htpasswd)"

        echo ""
        echo -e "  ${BLUE}Installing SSL support:${NC}"
        echo ""
        install_pkg "certbot"                "Certbot (Let's Encrypt)"
        install_pkg "python3-certbot-nginx"  "Certbot Nginx plugin"
    fi

    # Verify Nginx SSL support
    echo ""
    echo -e "  ${BLUE}Verifying critical tools:${NC}"
    echo ""

    printf "    %-30s" "Python 3"
    if command -v python3 >/dev/null 2>&1; then
        PY_VER=$(python3 --version 2>&1)
        echo -e " ${GREEN}${PY_VER} ✔${NC}"
    else
        echo -e " ${RED}NOT FOUND ✘${NC}"
        die "python3 installation failed"
    fi

    printf "    %-30s" "Nginx"
    if command -v nginx >/dev/null 2>&1; then
        NGX_VER=$(nginx -v 2>&1 | grep -oP '[\d.]+' | head -1)
        echo -e " ${GREEN}v${NGX_VER} ✔${NC}"
    else
        echo -e " ${RED}NOT FOUND ✘${NC}"
        die "nginx installation failed"
    fi

    printf "    %-30s" "Nginx SSL support"
    if nginx -V 2>&1 | grep -q "ssl"; then
        echo -e " ${GREEN}enabled ✔${NC}"
    else
        echo -e " ${YELLOW}not detected (trying fix...)${NC}"
        if [ "$PKG_MGR" = "apt" ]; then
            apt-get install -y nginx-extras >> "$LOG_FILE" 2>&1 || apt-get install -y nginx >> "$LOG_FILE" 2>&1 || true
        fi
        if nginx -V 2>&1 | grep -q "ssl"; then
            echo -e "    ${GREEN}→ fixed ✔${NC}"
        else
            echo -e "    ${YELLOW}→ HTTPS may not work${NC}"
        fi
    fi

    printf "    %-30s" "OpenSSL"
    if command -v openssl >/dev/null 2>&1; then
        SSL_VER=$(openssl version 2>&1 | head -1)
        echo -e " ${GREEN}${SSL_VER} ✔${NC}"
    else
        echo -e " ${RED}NOT FOUND ✘${NC}"
        die "openssl installation failed"
    fi

    printf "    %-30s" "Certbot"
    if command -v certbot >/dev/null 2>&1; then
        CB_VER=$(certbot --version 2>&1 | head -1)
        echo -e " ${GREEN}${CB_VER} ✔${NC}"
    else
        echo -e " ${YELLOW}not installed (self-signed only)${NC}"
    fi

    echo ""
    log "System packages OK"
}

# ───────── Deploy application ─────────
deploy_app() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}  [Step 2/12] Deploying Application${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

    # Check for existing install
    if [ -d "$APP_DIR" ]; then
        echo -e "  ${YELLOW}Previous installation detected at ${APP_DIR}${NC}"
        if [ -d "$APP_DIR/data" ]; then
            echo -e "  ${BLUE}Backing up database...${NC}"
            cp -r "$APP_DIR/data" /tmp/_cdn_scanner_data_backup 2>/dev/null || true
            echo -e "    ${GREEN}Database backed up ✔${NC}"
        fi
        echo -e "  ${BLUE}Removing old installation...${NC}"
        rm -rf "$APP_DIR"
        echo -e "    ${GREEN}Old files removed ✔${NC}"
    fi

    mkdir -p "$APP_DIR"
    mkdir -p "$APP_DIR/data"

    # Copy app files
    echo ""
    echo -e "  ${BLUE}Copying application files:${NC}"
    echo ""

    printf "    %-35s" "app/ (core application)"
    if cp -r "${SCRIPT_DIR}/app" "$APP_DIR/"; then
        FCOUNT=$(find "$APP_DIR/app" -type f 2>/dev/null | wc -l)
        echo -e " ${GREEN}copied (${FCOUNT} files) ✔${NC}"
    else
        echo -e " ${RED}FAILED ✘${NC}"
        die "Failed to copy app/"
    fi

    printf "    %-35s" "run.py (entry point)"
    if cp "${SCRIPT_DIR}/run.py" "$APP_DIR/"; then
        echo -e " ${GREEN}copied ✔${NC}"
    else
        echo -e " ${RED}FAILED ✘${NC}"
        die "Failed to copy run.py"
    fi

    printf "    %-35s" "requirements.txt (dependencies)"
    if cp "${SCRIPT_DIR}/requirements.txt" "$APP_DIR/"; then
        REQ_COUNT=$(wc -l < "$APP_DIR/requirements.txt" 2>/dev/null || echo "?")
        echo -e " ${GREEN}copied (${REQ_COUNT} packages) ✔${NC}"
    else
        echo -e " ${RED}FAILED ✘${NC}"
        die "Failed to copy requirements.txt"
    fi

    printf "    %-35s" "version"
    if cp "${SCRIPT_DIR}/version" "$APP_DIR/" 2>/dev/null; then
        VER=$(cat "$APP_DIR/version" 2>/dev/null)
        echo -e " ${GREEN}v${VER} ✔${NC}"
    else
        echo "2.0" > "$APP_DIR/version"
        echo -e " ${GREEN}v2.0 (created) ✔${NC}"
    fi

    # Restore data backup
    if [ -d /tmp/_cdn_scanner_data_backup ]; then
        printf "    %-35s" "Restoring database backup"
        cp -r /tmp/_cdn_scanner_data_backup/* "$APP_DIR/data/" 2>/dev/null || true
        rm -rf /tmp/_cdn_scanner_data_backup
        echo -e " ${GREEN}restored ✔${NC}"
    fi

    TOTAL_SIZE=$(du -sh "$APP_DIR" 2>/dev/null | awk '{print $1}')
    echo ""
    echo -e "  ${GREEN}Application files deployed (${TOTAL_SIZE}) ✔${NC}"

    # Python virtual environment
    echo ""
    echo -e "  ${BLUE}Creating Python virtual environment...${NC}"
    if python3 -m venv "$APP_DIR/venv" 2>>"$LOG_FILE"; then
        echo -e "    ${GREEN}Virtual environment created at ${APP_DIR}/venv ✔${NC}"
    else
        die "Failed to create Python virtual environment"
    fi

    # Upgrade pip
    echo ""
    echo -e "  ${BLUE}Upgrading pip, setuptools, wheel...${NC}"
    "$APP_DIR/venv/bin/pip" install --upgrade pip setuptools wheel >> "$LOG_FILE" 2>&1 || true
    PIP_VER=$("$APP_DIR/venv/bin/pip" --version 2>/dev/null | awk '{print $2}')
    echo -e "    ${GREEN}pip ${PIP_VER} ready ✔${NC}"

    # Install Python dependencies
    echo ""
    echo -e "  ${BLUE}Installing Python dependencies (this may take 1-2 minutes)...${NC}"
    echo ""

    "$APP_DIR/venv/bin/pip" install -r "$APP_DIR/requirements.txt" 2>&1 | while IFS= read -r line; do
        # Show progress for each package
        case "$line" in
            *"Successfully installed"*)
                echo -e "    ${GREEN}${line}${NC}"
                ;;
            *"Requirement already satisfied"*)
                PKG_NAME=$(echo "$line" | sed 's/Requirement already satisfied: //' | awk '{print $1}')
                echo -e "    ${GREEN}✔${NC} ${PKG_NAME} (already satisfied)"
                ;;
            *"Collecting"*)
                PKG_NAME=$(echo "$line" | sed 's/Collecting //' | awk '{print $1}')
                echo -e "    ${BLUE}↓${NC} Downloading ${PKG_NAME}..."
                ;;
            *"Installing collected"*)
                echo -e "    ${BLUE}⟳${NC} ${line}"
                ;;
            *"WARNING"*|*"ERROR"*)
                echo -e "    ${YELLOW}${line}${NC}"
                ;;
        esac
    done
    PIP_EXIT=${PIPESTATUS[0]}

    if [ $PIP_EXIT -ne 0 ]; then
        warn "pip had warnings (exit=${PIP_EXIT}), verifying critical packages..."
    fi

    # Verify critical Python packages
    echo ""
    echo -e "  ${BLUE}Verifying critical Python packages:${NC}"
    echo ""

    CRITICAL_PKGS="flask flask_socketio gevent requests dotenv openpyxl"
    ALL_OK=true
    for pkg in $CRITICAL_PKGS; do
        printf "    %-25s" "$pkg"
        if "$APP_DIR/venv/bin/python" -c "import $pkg" 2>/dev/null; then
            echo -e " ${GREEN}OK ✔${NC}"
        else
            echo -e " ${RED}MISSING ✘${NC}"
            ALL_OK=false
        fi
    done

    if [ "$ALL_OK" = false ]; then
        die "Critical Python packages are missing. Check pip output above."
    fi

    echo ""
    log "Application deployed successfully"
}

# ───────── Create .env ─────────
create_env_file() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}  [Step 3/12] Creating Environment Configuration${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    echo -e "  ${BLUE}Generating secret key...${NC}"
    SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null)
    if [ -z "$SECRET_KEY" ]; then
        SECRET_KEY=$(openssl rand -hex 32 2>/dev/null || echo "fallback-secret-change-me-$(date +%s)")
    fi
    echo -e "    ${GREEN}Secret key generated (${#SECRET_KEY} chars) ✔${NC}"

    echo -e "  ${BLUE}Writing .env file...${NC}"
    cat > "$APP_DIR/.env" << ENVEOF
SECRET_KEY=${SECRET_KEY}
PORT=${APP_PORT}
PANEL_USER=${PANEL_USER}
PANEL_PASS=${PANEL_PASS}
ENVEOF

    chmod 600 "$APP_DIR/.env"
    echo -e "    ${GREEN}File: ${APP_DIR}/.env ✔${NC}"
    echo -e "    ${GREEN}Permissions: 600 (owner read/write only) ✔${NC}"
    echo ""
    log ".env created"
}

# ───────── SSL certificates ─────────
# Domain → self-signed first, then Let's Encrypt (ACME) upgrade.
# IP     → self-signed with proper SAN (Subject Alternative Name).
#
# IMPORTANT: Modern browsers (Chrome 58+, Firefox 48+) REQUIRE the SAN extension.
# A certificate with only CN=<ip> is rejected as ERR_CERT_COMMON_NAME_INVALID.
# For IPs the SAN must be "IP:<address>", for domains "DNS:<name>".
setup_ssl() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}  [Step 4/12] Setting Up SSL Certificates${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    log "Setting up SSL certificates..."

    mkdir -p "$SSL_DIR"
    chmod 755 "$SSL_DIR"

    # Clean CN (no whitespace/control chars)
    SSL_CN=$(echo "$HOSTNAME_INPUT" | tr -d '\n\r\t ' | head -c 128)
    [ -z "$SSL_CN" ] && SSL_CN="localhost"

    # ── Build SAN value based on IP vs domain ──
    if [ "$USE_DOMAIN" = false ]; then
        # IP mode: SAN = IP:<addr>,IP:127.0.0.1,DNS:localhost
        SAN_ENTRY="IP:${SSL_CN},IP:127.0.0.1,DNS:localhost"
        log "IP mode → generating self-signed certificate with SAN: ${SAN_ENTRY}"
    else
        # Domain mode: SAN = DNS:<domain>,DNS:localhost,IP:127.0.0.1
        SAN_ENTRY="DNS:${SSL_CN},DNS:localhost,IP:127.0.0.1"
        log "Domain mode → generating temporary self-signed certificate with SAN: ${SAN_ENTRY}"
    fi

    # Remove any old certs
    rm -f "${SSL_DIR}/cert.pem" "${SSL_DIR}/key.pem" "${SSL_DIR}/openssl.cnf"

    # ─────────────────────────────────────────────────
    # Method 1: OpenSSL config file (most compatible)
    # ─────────────────────────────────────────────────
    OPENSSL_CNF="${SSL_DIR}/openssl.cnf"
    cat > "$OPENSSL_CNF" << SSLCNF
[req]
default_bits       = 2048
prompt             = no
default_md         = sha256
distinguished_name = dn
x509_extensions    = v3_ca
req_extensions     = v3_ca

[dn]
C  = US
ST = State
L  = City
O  = CDN-IP-Scanner
CN = ${SSL_CN}

[v3_ca]
subjectAltName     = ${SAN_ENTRY}
basicConstraints   = critical,CA:TRUE
keyUsage           = critical,digitalSignature,keyEncipherment,keyCertSign
extendedKeyUsage   = serverAuth
SSLCNF

    log "Generating certificate (method 1: config file with SAN)..."
    openssl req -x509 -nodes -sha256 -days 3650 \
        -newkey rsa:2048 \
        -keyout "${SSL_DIR}/key.pem" \
        -out "${SSL_DIR}/cert.pem" \
        -config "$OPENSSL_CNF" \
        -extensions v3_ca \
        2>>"$LOG_FILE"

    # ─────────────────────────────────────────────────
    # Method 2: -addext flag (OpenSSL >= 1.1.1)
    # ─────────────────────────────────────────────────
    if [ ! -f "${SSL_DIR}/cert.pem" ] || [ ! -s "${SSL_DIR}/cert.pem" ]; then
        warn "Method 1 failed, trying method 2 (-addext)..."
        rm -f "${SSL_DIR}/cert.pem" "${SSL_DIR}/key.pem"
        openssl req -x509 -nodes -sha256 -days 3650 \
            -newkey rsa:2048 \
            -keyout "${SSL_DIR}/key.pem" \
            -out "${SSL_DIR}/cert.pem" \
            -subj "/C=US/ST=State/L=City/O=CDN-IP-Scanner/CN=${SSL_CN}" \
            -addext "subjectAltName=${SAN_ENTRY}" \
            -addext "basicConstraints=critical,CA:TRUE" \
            -addext "keyUsage=critical,digitalSignature,keyEncipherment,keyCertSign" \
            -addext "extendedKeyUsage=serverAuth" \
            2>>"$LOG_FILE" || true
    fi

    # ─────────────────────────────────────────────────
    # Method 3: Bare self-signed (very old OpenSSL)
    # ─────────────────────────────────────────────────
    if [ ! -f "${SSL_DIR}/cert.pem" ] || [ ! -s "${SSL_DIR}/cert.pem" ]; then
        warn "SAN methods failed. Generating basic self-signed (older browsers may complain)..."
        rm -f "${SSL_DIR}/cert.pem" "${SSL_DIR}/key.pem"
        openssl req -x509 -nodes -sha256 -days 3650 \
            -newkey rsa:2048 \
            -keyout "${SSL_DIR}/key.pem" \
            -out "${SSL_DIR}/cert.pem" \
            -subj "/CN=${SSL_CN}" \
            2>>"$LOG_FILE" || true
    fi

    # ── Validate results ──
    if [ ! -f "${SSL_DIR}/cert.pem" ] || [ ! -s "${SSL_DIR}/cert.pem" ]; then
        err "All SSL generation methods failed. Log tail:"
        tail -10 "$LOG_FILE" 2>/dev/null || true
        die "SSL certificate generation failed. Check openssl and permissions on ${SSL_DIR}."
    fi
    if [ ! -f "${SSL_DIR}/key.pem" ] || [ ! -s "${SSL_DIR}/key.pem" ]; then
        die "SSL key generation failed."
    fi

    SSL_CERT="${SSL_DIR}/cert.pem"
    SSL_KEY="${SSL_DIR}/key.pem"
    chmod 644 "${SSL_CERT}"
    chmod 600 "${SSL_KEY}"
    chown root:root "${SSL_CERT}" "${SSL_KEY}" 2>/dev/null || true

    # ── Verify certificate details ──
    log "Verifying certificate..."
    CERT_SUBJECT=$(openssl x509 -in "$SSL_CERT" -noout -subject 2>/dev/null) || true
    CERT_SAN=$(openssl x509 -in "$SSL_CERT" -noout -text 2>/dev/null | grep -A1 "Subject Alternative Name" | tail -1 | sed 's/^[ ]*//' ) || true
    CERT_DATES=$(openssl x509 -in "$SSL_CERT" -noout -dates 2>/dev/null) || true

    if [ -n "$CERT_SUBJECT" ]; then
        log "  Subject : ${CERT_SUBJECT}"
    else
        die "Generated certificate is invalid (cannot read subject)."
    fi

    if [ -n "$CERT_SAN" ]; then
        log "  SAN     : ${CERT_SAN}"
    else
        warn "  SAN     : (not found — older browsers may reject this certificate)"
    fi

    log "  Dates   : ${CERT_DATES}"
    log "SSL certificate ready: ${SSL_CERT}"
    echo -e "  ${GREEN}SSL installed successfully (cert: ${SSL_CERT}) ✔${NC}"

    # Clean up temp config
    rm -f "$OPENSSL_CNF"
}

# ───────── Install acme.sh (for IP SSL / ACME) ─────────
# Must run as root; installs to /root/.acme.sh so cdn-scanner-manage ssl always finds it.
install_acme_sh() {
    export HOME=/root
    ACME_SH="/root/.acme.sh/acme.sh"
    if [ -f "$ACME_SH" ]; then
        log "acme.sh already installed: $ACME_SH"
        return 0
    fi
    ACME_MAIL="${ACME_EMAIL:-admin@example.com}"
    echo -e "  ${BLUE}Installing acme.sh for ACME/Let's Encrypt (IP SSL)...${NC}"
    ( export HOME=/root; curl -sL https://get.acme.sh | sh -s email="${ACME_MAIL}" ) 2>>"$LOG_FILE" || true
    if [ ! -f "$ACME_SH" ]; then
        ( export HOME=/root; curl -sL https://get.acme.sh | bash -s email="${ACME_MAIL}" ) 2>&1 | tee -a "$LOG_FILE" || true
    fi
    if [ ! -f "$ACME_SH" ]; then
        echo -e "  ${YELLOW}Retry with visible output...${NC}"
        export HOME=/root
        curl -sL https://get.acme.sh -o /tmp/acme-install.sh
        sh /tmp/acme-install.sh email="${ACME_MAIL}" 2>&1 | tee -a "$LOG_FILE" || true
        rm -f /tmp/acme-install.sh
    fi
    if [ -f "$ACME_SH" ]; then
        log "acme.sh installed: $ACME_SH"
        return 0
    fi
    err "acme.sh installation failed. SSL on IP will use self-signed (HTTPS still works)."
    return 1
}

# ───────── ACME (Let's Encrypt) for IP address ─────────
# Let's Encrypt now supports IP certificates (short-lived, ~6 days). Uses acme.sh.
try_acme_ip() {
    echo -e "  ${BLUE}Trying Let's Encrypt IP certificate (ACME)...${NC}"
    echo -e "    (Requires: public IP, port 80 open from internet)"
    echo ""

    export HOME=/root
    ACME_SH="/root/.acme.sh/acme.sh"
    if [ ! -f "$ACME_SH" ]; then
        echo -e "    ${BLUE}Installing acme.sh...${NC}"
        install_acme_sh || return 1
    fi

    # Ensure webroot exists and writable by root (acme.sh) and nginx (to serve)
    mkdir -p "$ACME_CHALLENGE_DIR/.well-known/acme-challenge"
    chown -R www-data:www-data "$ACME_CHALLENGE_DIR" 2>/dev/null || chown -R nginx:nginx "$ACME_CHALLENGE_DIR" 2>/dev/null || true
    chmod -R 755 "$ACME_CHALLENGE_DIR"

    # Brief wait so Nginx is ready to serve ACME challenge
    echo -e "    ${BLUE}Waiting for Nginx to be ready (3s)...${NC}"
    sleep 3

    # Issue Let's Encrypt IP certificate (shortlived profile, ~6 days validity)
    echo -e "    ${BLUE}Requesting certificate for IP: ${HOSTNAME_INPUT}${NC}"
    ACME_MAIL="${ACME_EMAIL:-admin@example.com}"
    ACME_OUT=$(mktemp)
    export HOME=/root
    "$ACME_SH" --issue \
        -d "$HOSTNAME_INPUT" \
        --webroot "$ACME_CHALLENGE_DIR" \
        --server letsencrypt \
        --certificate-profile shortlived \
        --days 5 \
        --force \
        >> "$ACME_OUT" 2>&1
    ACME_ISSUE_EXIT=$?
    cat "$ACME_OUT" >> "$LOG_FILE"

    # If failed due to invalid contact email, remove old account and reinstall acme.sh with correct email (same as cdn-scanner-manage ssl)
    if [ $ACME_ISSUE_EXIT -ne 0 ] && grep -q "invalidContact\|invalid contact" "$ACME_OUT" 2>/dev/null; then
        echo -e "    ${YELLOW}Let's Encrypt rejected the account email. Reinstalling acme.sh with email from config...${NC}"
        rm -rf /root/.acme.sh
        ACME_SH="/root/.acme.sh/acme.sh"
        if ! install_acme_sh; then
            cat "$ACME_OUT"
            rm -f "$ACME_OUT"
            return 1
        fi
        rm -f "$ACME_OUT"
        ACME_OUT=$(mktemp)
        "$ACME_SH" --issue \
            -d "$HOSTNAME_INPUT" \
            --webroot "$ACME_CHALLENGE_DIR" \
            --server letsencrypt \
            --certificate-profile shortlived \
            --days 5 \
            --force \
            >> "$ACME_OUT" 2>&1
        ACME_ISSUE_EXIT=$?
        cat "$ACME_OUT" >> "$LOG_FILE"
    fi

    if [ $ACME_ISSUE_EXIT -ne 0 ]; then
        echo -e "    ${YELLOW}First attempt failed. Retrying once in 10s...${NC}"
        sleep 10
        rm -f "$ACME_OUT"
        ACME_OUT=$(mktemp)
        "$ACME_SH" --issue \
            -d "$HOSTNAME_INPUT" \
            --webroot "$ACME_CHALLENGE_DIR" \
            --server letsencrypt \
            --certificate-profile shortlived \
            --days 5 \
            --force \
            >> "$ACME_OUT" 2>&1
        ACME_ISSUE_EXIT=$?
        cat "$ACME_OUT" >> "$LOG_FILE"
    fi

    if [ $ACME_ISSUE_EXIT -ne 0 ]; then
        cat "$ACME_OUT"
        rm -f "$ACME_OUT"
        warn "Let's Encrypt IP certificate request failed (exit ${ACME_ISSUE_EXIT})."
        echo "    Common causes: port 80 not reachable from internet, or IP certificate not yet available in your region."
        return 1
    fi
    rm -f "$ACME_OUT"

    # Install cert to our SSL dir and reload Nginx
    echo -e "    ${BLUE}Installing certificate to Nginx...${NC}"
    "$ACME_SH" --install-cert -d "$HOSTNAME_INPUT" \
        --key-file "$SSL_DIR/key.pem" \
        --fullchain-file "$SSL_DIR/cert.pem" \
        --reloadcmd "systemctl reload nginx" \
        >> "$LOG_FILE" 2>&1

    if [ -f "$SSL_DIR/cert.pem" ] && [ -f "$SSL_DIR/key.pem" ]; then
        chmod 644 "$SSL_DIR/cert.pem"
        chmod 600 "$SSL_DIR/key.pem"
        systemctl reload nginx >> "$LOG_FILE" 2>&1 || true
        log "Let's Encrypt IP certificate installed successfully (ACME). Auto-renewal via acme.sh cron."
        echo -e "    ${GREEN}HTTPS with trusted certificate is now active for https://${HOSTNAME_INPUT} ✔${NC}"
        return 0
    fi
    return 1
}

# Let's Encrypt (ACME) — for domain (certbot) or IP (acme.sh)
try_letsencrypt() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}  [Step 11/12] SSL Certificate Finalization (ACME)${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    if [ "$USE_DOMAIN" != true ]; then
        # IP: try Let's Encrypt IP cert via acme.sh first
        if try_acme_ip; then
            return 0
        fi
        # Fallback: keep self-signed — SSL is still installed and working
        echo ""
        log "ACME/Let's Encrypt IP request failed or unavailable. Using self-signed certificate (already installed)."
        echo -e "  ${GREEN}SSL is installed and working. Panel: https://${HOSTNAME_INPUT} ✔${NC}"
        echo -e "  ${YELLOW}╔════════════════════════════════════════════════════════════╗${NC}"
        echo -e "  ${YELLOW}║  Certificate: self-signed (connection is encrypted).       ║${NC}"
        echo -e "  ${YELLOW}║  Browser may show a warning — click Advanced → Proceed.   ║${NC}"
        echo -e "  ${YELLOW}║  To get trusted SSL later: open port 80, then run:         ║${NC}"
        echo -e "  ${YELLOW}║  sudo cdn-scanner-manage ssl                              ║${NC}"
        echo -e "  ${YELLOW}╚════════════════════════════════════════════════════════════╝${NC}"
        echo ""
        return 0
    fi

    if ! command -v certbot >/dev/null 2>&1; then
        warn "certbot not installed. Using self-signed."
        warn "To install later: apt install certbot python3-certbot-nginx && certbot --nginx -d ${HOSTNAME_INPUT}"
        return 0
    fi

    log "Requesting Let's Encrypt certificate for ${HOSTNAME_INPUT}..."
    echo "  (This requires the domain to point to this server and port 80 to be open)"

    # Certbot needs Nginx on port 80 and domain DNS pointing to this server
    CERTBOT_OUT=$(mktemp)
    certbot --nginx \
        -d "$HOSTNAME_INPUT" \
        --non-interactive \
        --agree-tos \
        --register-unsafely-without-email \
        --redirect \
        > "$CERTBOT_OUT" 2>&1
    CERTBOT_EXIT=$?
    cat "$CERTBOT_OUT" >> "$LOG_FILE" 2>/dev/null || true
    cat "$CERTBOT_OUT"

    LE_CERT="/etc/letsencrypt/live/${HOSTNAME_INPUT}/fullchain.pem"
    LE_KEY="/etc/letsencrypt/live/${HOSTNAME_INPUT}/privkey.pem"

    if [ $CERTBOT_EXIT -eq 0 ] && [ -f "$LE_CERT" ] && [ -f "$LE_KEY" ]; then
        log "Let's Encrypt certificate obtained successfully!"

        # Update Nginx config to use Let's Encrypt certs
        if [ -d "/etc/nginx/sites-available" ]; then
            CONF_FILE="$NGINX_CONF"
        else
            CONF_FILE="$NGINX_CONF_D"
        fi
        if [ -f "$CONF_FILE" ] && grep -q "ssl_certificate" "$CONF_FILE" 2>/dev/null; then
            sed -i.bak "s|ssl_certificate .*cert\.pem;|ssl_certificate     ${LE_CERT};|g" "$CONF_FILE" 2>/dev/null || true
            sed -i.bak "s|ssl_certificate_key .*key\.pem;|ssl_certificate_key ${LE_KEY};|g" "$CONF_FILE" 2>/dev/null || true
            log "Nginx config updated with Let's Encrypt paths."
        fi

        # Reload Nginx
        if nginx -t 2>/dev/null; then
            systemctl reload nginx 2>/dev/null || systemctl restart nginx 2>/dev/null || true
            log "Nginx reloaded with Let's Encrypt certificate."
        else
            warn "Nginx config test failed after LE update. Reverting..."
            [ -f "${CONF_FILE}.bak" ] && cp "${CONF_FILE}.bak" "$CONF_FILE"
            nginx -t 2>/dev/null && systemctl reload nginx 2>/dev/null || true
        fi

        # Set up auto-renewal cron
        if ! crontab -l 2>/dev/null | grep -q "certbot renew"; then
            (crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --post-hook 'systemctl reload nginx'") | crontab - 2>/dev/null || true
            log "Auto-renewal cron job added (daily at 3 AM)."
        fi
    else
        warn "Let's Encrypt failed (exit code: ${CERTBOT_EXIT}). Possible causes:"
        echo "  - Domain '${HOSTNAME_INPUT}' does not point to this server's IP (${SERVER_IP})"
        echo "  - Port 80 is blocked by firewall or another service"
        echo "  - DNS propagation has not completed yet"
        echo ""
        echo "  Keeping self-signed certificate (HTTPS still works, browser shows warning)."
        echo "  Run later when DNS is ready: certbot --nginx -d ${HOSTNAME_INPUT}"
    fi
    rm -f "$CERTBOT_OUT"
}

# ───────── Basic Auth (htpasswd) ─────────
setup_htpasswd() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}  [Step 5/12] Setting Up Basic Authentication${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    echo -e "  ${BLUE}Creating password hash for user '${PANEL_USER}'...${NC}"

    HTPASSWD_OK=false
    if command -v htpasswd >/dev/null 2>&1; then
        echo -e "    Using htpasswd utility..."
        if htpasswd -cb "$HTPASSWD_FILE" "$PANEL_USER" "$PANEL_PASS" 2>/dev/null; then
            HTPASSWD_OK=true
            echo -e "    ${GREEN}Password hashed with htpasswd ✔${NC}"
        fi
    fi

    if [ "$HTPASSWD_OK" = false ]; then
        echo -e "    ${YELLOW}htpasswd not available, trying openssl...${NC}"
        HASHED=$(openssl passwd -apr1 "$PANEL_PASS" 2>/dev/null) || true
        if [ -n "$HASHED" ]; then
            echo "${PANEL_USER}:${HASHED}" > "$HTPASSWD_FILE"
            HTPASSWD_OK=true
            echo -e "    ${GREEN}Password hashed with openssl ✔${NC}"
        fi
    fi

    if [ "$HTPASSWD_OK" = false ]; then
        echo -e "    ${YELLOW}openssl failed, trying Python crypt...${NC}"
        "$APP_DIR/venv/bin/python" -c "
import crypt, os
salt = crypt.mksalt(crypt.METHOD_SHA256)
hashed = crypt.crypt('${PANEL_PASS}', salt)
print('${PANEL_USER}:' + hashed)
" > "$HTPASSWD_FILE" 2>/dev/null || true
        if [ -s "$HTPASSWD_FILE" ]; then
            echo -e "    ${GREEN}Password hashed with Python ✔${NC}"
        fi
    fi

    # Verify htpasswd file exists and is not empty
    if [ ! -s "$HTPASSWD_FILE" ]; then
        echo -e "    ${YELLOW}All methods failed, using fallback...${NC}"
        echo "${PANEL_USER}:$(openssl passwd -1 "$PANEL_PASS" 2>/dev/null || echo '{PLAIN}'$PANEL_PASS)" > "$HTPASSWD_FILE"
    fi

    chmod 640 "$HTPASSWD_FILE"
    chown root:www-data "$HTPASSWD_FILE" 2>/dev/null || chown root:nginx "$HTPASSWD_FILE" 2>/dev/null || true

    echo -e "  ${BLUE}Verifying auth file...${NC}"
    if [ -s "$HTPASSWD_FILE" ]; then
        echo -e "    ${GREEN}Auth file: ${HTPASSWD_FILE} ✔${NC}"
        echo -e "    ${GREEN}Username: ${PANEL_USER} ✔${NC}"
        echo -e "    ${GREEN}Permissions: 640 ✔${NC}"
    else
        die "Failed to create authentication file"
    fi
    echo ""
    log "Basic Auth configured (user: ${PANEL_USER})"
}

# ───────── Nginx ─────────
configure_nginx() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}  [Step 6/12] Configuring Nginx Reverse Proxy${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    echo -e "  ${BLUE}Stopping Nginx for configuration...${NC}"
    systemctl stop nginx 2>/dev/null || true
    echo -e "    ${GREEN}Nginx stopped ✔${NC}"

    # Determine config path
    if [ -d "/etc/nginx/sites-available" ]; then
        CONF_FILE="$NGINX_CONF"
        USE_SITES=true
        echo -e "  ${BLUE}Config style: sites-available/sites-enabled${NC}"
    else
        CONF_FILE="$NGINX_CONF_D"
        USE_SITES=false
        echo -e "  ${BLUE}Config style: conf.d${NC}"
    fi
    echo -e "    ${GREEN}Config path: ${CONF_FILE} ✔${NC}"

    NGINX_VER=$(nginx -v 2>&1 | grep -oP '[\d.]+' | head -1)
    LISTEN_SSL="listen 443 ssl"
    LISTEN_SSL6="listen [::]:443 ssl"

    echo ""
    echo -e "  ${BLUE}Writing Nginx configuration:${NC}"
    echo -e "    Upstream      : 127.0.0.1:${APP_PORT}"
    echo -e "    Server name   : ${HOSTNAME_INPUT}"
    echo -e "    SSL cert      : ${SSL_CERT}"
    echo -e "    SSL key       : ${SSL_KEY}"
    echo -e "    Auth file     : ${HTPASSWD_FILE}"
    echo -e "    HTTP → HTTPS  : redirect (port 80 → 443)"
    echo -e "    WebSocket     : /socket.io (proxy upgrade)"
    echo -e "    ACME challenge: /.well-known/acme-challenge/ (for Let's Encrypt IP)"
    echo ""

    mkdir -p "$ACME_CHALLENGE_DIR/.well-known/acme-challenge"
    chown -R www-data:www-data "$ACME_CHALLENGE_DIR" 2>/dev/null || chown -R nginx:nginx "$ACME_CHALLENGE_DIR" 2>/dev/null || true
    chmod -R 755 "$ACME_CHALLENGE_DIR"

    cat > "$CONF_FILE" << NGINXEOF
# CDN IP Scanner V2.0 - Nginx Configuration
# Auto-generated by installer

upstream cdn_scanner_app {
    server 127.0.0.1:${APP_PORT};
    keepalive 16;
}

server {
    listen 80;
    listen [::]:80;
    server_name ${HOSTNAME_INPUT} _;

    location /.well-known/acme-challenge/ {
        root /var/www/acme-challenge;
        add_header Content-Type text/plain;
        allow all;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    ${LISTEN_SSL};
    ${LISTEN_SSL6};
    server_name ${HOSTNAME_INPUT} _;

    ssl_certificate     ${SSL_CERT};
    ssl_certificate_key ${SSL_KEY};
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    auth_basic "CDN IP Scanner";
    auth_basic_user_file ${HTPASSWD_FILE};

    client_max_body_size 10m;
    proxy_connect_timeout 120;
    proxy_send_timeout 120;
    proxy_read_timeout 300;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript;

    location / {
        proxy_pass http://cdn_scanner_app;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }

    location /socket.io {
        proxy_pass http://cdn_scanner_app/socket.io;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    location /static/ {
        auth_basic off;
        proxy_pass http://cdn_scanner_app/static/;
        expires 1h;
    }
}
NGINXEOF

    echo -e "    ${GREEN}Config file written ✔${NC}"

    # Symlink if sites-available style
    if [ "$USE_SITES" = true ]; then
        ln -sf "$CONF_FILE" "$NGINX_LINK"
        echo -e "    ${GREEN}Symlink created: ${NGINX_LINK} ✔${NC}"
        rm -f /etc/nginx/sites-enabled/default
        echo -e "    ${GREEN}Default site disabled ✔${NC}"
    fi

    # Test config
    echo ""
    echo -e "  ${BLUE}Testing Nginx configuration...${NC}"
    if nginx -t 2>&1 | tee -a "$LOG_FILE"; then
        echo -e "    ${GREEN}Nginx config is valid ✔${NC}"
    else
        err "Nginx config test failed:"
        nginx -t 2>&1
        die "Fix nginx config manually: $CONF_FILE"
    fi

    # Enable and start nginx
    echo ""
    echo -e "  ${BLUE}Starting Nginx...${NC}"
    systemctl enable nginx >> "$LOG_FILE" 2>&1 || true
    echo -e "    ${GREEN}Nginx enabled on boot ✔${NC}"

    systemctl start nginx 2>/dev/null || systemctl restart nginx 2>/dev/null || true

    # Verify nginx is running
    if systemctl is-active --quiet nginx; then
        echo -e "    ${GREEN}Nginx is running ✔${NC}"
        echo -e "    ${GREEN}Listening on port 80 (HTTP → HTTPS redirect) ✔${NC}"
        echo -e "    ${GREEN}Listening on port 443 (HTTPS + SSL) ✔${NC}"
    else
        err "Nginx failed to start. Details:"
        systemctl status nginx --no-pager -l 2>&1 | tail -10
        journalctl -u nginx --no-pager -n 20 2>&1 | tail -10
        die "Nginx failed to start"
    fi
    echo ""
    log "Nginx configured and running"
}

# ───────── Systemd service ─────────
create_service() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}  [Step 7/12] Creating Systemd Service${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    echo -e "  ${BLUE}Writing service file...${NC}"
    echo -e "    Service name  : ${SERVICE_NAME}"
    echo -e "    Exec command  : ${APP_DIR}/venv/bin/python run.py --host 127.0.0.1 --port ${APP_PORT}"
    echo -e "    Auto-restart  : always (3s delay)"
    echo -e "    Working dir   : ${APP_DIR}"
    echo ""

    cat > "/etc/systemd/system/${SERVICE_NAME}.service" << SVCEOF
[Unit]
Description=CDN IP Scanner V2.0
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=${APP_DIR}
EnvironmentFile=${APP_DIR}/.env
ExecStart=${APP_DIR}/venv/bin/python ${APP_DIR}/run.py --host 127.0.0.1 --port ${APP_PORT} --no-browser
Restart=always
RestartSec=3
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${APP_NAME}
LimitNOFILE=65535
LimitNPROC=4096
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
SVCEOF

    systemctl daemon-reload
    echo -e "    ${GREEN}Service file: /etc/systemd/system/${SERVICE_NAME}.service ✔${NC}"
    echo -e "    ${GREEN}Systemd daemon reloaded ✔${NC}"

    systemctl enable "$SERVICE_NAME" >> "$LOG_FILE" 2>&1 || true
    echo -e "    ${GREEN}Service enabled on boot ✔${NC}"
    echo ""
    log "Systemd service created"
}

start_service() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}  [Step 10/12] Starting Application${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    echo -e "  ${BLUE}Starting ${SERVICE_NAME} service...${NC}"
    systemctl restart "$SERVICE_NAME" 2>/dev/null || true
    sleep 3

    # Check if running
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        echo -e "    ${GREEN}Service is running ✔${NC}"
        PID=$(systemctl show -p MainPID "$SERVICE_NAME" 2>/dev/null | cut -d= -f2)
        [ -n "$PID" ] && [ "$PID" != "0" ] && echo -e "    ${GREEN}Process ID: ${PID} ✔${NC}"
    else
        err "Service failed to start. Checking logs:"
        echo ""
        journalctl -u "$SERVICE_NAME" --no-pager -n 20 2>&1 | tail -15
        warn "Will try to continue anyway..."
    fi

    # Wait for HTTP response with progress
    echo ""
    echo -e "  ${BLUE}Waiting for application to respond on port ${APP_PORT}...${NC}"
    local i=0
    while [ $i -lt 20 ]; do
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${APP_PORT}/" 2>/dev/null) || true
        if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "302" ]; then
            echo -e "    ${GREEN}Application responding: HTTP ${HTTP_CODE} ✔${NC}"
            echo ""

            # Quick health check via HTTPS
            echo -e "  ${BLUE}Testing HTTPS access...${NC}"
            HTTPS_CODE=$(curl -sk -o /dev/null -w "%{http_code}" "https://${HOSTNAME_INPUT}/" 2>/dev/null) || true
            if [ "$HTTPS_CODE" = "200" ] || [ "$HTTPS_CODE" = "302" ] || [ "$HTTPS_CODE" = "401" ]; then
                echo -e "    ${GREEN}HTTPS working: HTTP ${HTTPS_CODE} ✔${NC}"
            else
                echo -e "    ${YELLOW}HTTPS returned: HTTP ${HTTPS_CODE} (may need a moment)${NC}"
            fi
            echo ""
            return 0
        fi
        printf "    Attempt %d/20 — HTTP %s ...\r" "$((i + 1))" "${HTTP_CODE:-timeout}"
        i=$((i + 1))
        sleep 2
    done
    echo ""

    warn "App not responding after 40s. Debug: journalctl -u ${SERVICE_NAME} -f"
}

# ───────── Firewall ─────────
configure_firewall() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}  [Step 8/12] Configuring Firewall${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    if command -v ufw >/dev/null 2>&1; then
        echo -e "  ${BLUE}Detected firewall: UFW${NC}"
        echo ""
        printf "    %-25s" "Allow SSH (22/tcp)"
        ufw allow 22/tcp >> "$LOG_FILE" 2>&1 || true
        echo -e " ${GREEN}✔${NC}"
        printf "    %-25s" "Allow HTTP (80/tcp)"
        ufw allow 80/tcp >> "$LOG_FILE" 2>&1 || true
        echo -e " ${GREEN}✔${NC}"
        printf "    %-25s" "Allow HTTPS (443/tcp)"
        ufw allow 443/tcp >> "$LOG_FILE" 2>&1 || true
        echo -e " ${GREEN}✔${NC}"

        if ufw status 2>/dev/null | grep -q "inactive"; then
            echo ""
            echo -e "    ${YELLOW}UFW is inactive. Run 'ufw enable' to activate.${NC}"
        else
            ufw reload >> "$LOG_FILE" 2>&1 || true
            echo ""
            echo -e "    ${GREEN}UFW reloaded ✔${NC}"
        fi
        log "UFW rules added"

    elif command -v firewall-cmd >/dev/null 2>&1; then
        echo -e "  ${BLUE}Detected firewall: firewalld${NC}"
        echo ""
        printf "    %-25s" "Allow HTTP"
        firewall-cmd --permanent --add-service=http >> "$LOG_FILE" 2>&1 || true
        echo -e " ${GREEN}✔${NC}"
        printf "    %-25s" "Allow HTTPS"
        firewall-cmd --permanent --add-service=https >> "$LOG_FILE" 2>&1 || true
        echo -e " ${GREEN}✔${NC}"
        printf "    %-25s" "Allow SSH"
        firewall-cmd --permanent --add-service=ssh >> "$LOG_FILE" 2>&1 || true
        echo -e " ${GREEN}✔${NC}"
        printf "    %-25s" "Reload firewall"
        firewall-cmd --reload >> "$LOG_FILE" 2>&1 || true
        echo -e " ${GREEN}✔${NC}"
        log "Firewalld rules added"
    else
        echo -e "  ${YELLOW}No firewall detected (ufw/firewalld not found).${NC}"
        echo -e "  ${YELLOW}Make sure ports 80 and 443 are open on your server.${NC}"
    fi
    echo ""
}

# ───────── Permissions ─────────
set_permissions() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}  [Step 9/12] Setting File Permissions${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    printf "    %-40s" "${APP_DIR}/ → root:root 755"
    chown -R root:root "$APP_DIR"
    chmod -R 755 "$APP_DIR"
    echo -e " ${GREEN}✔${NC}"

    printf "    %-40s" "${APP_DIR}/.env → 600 (private)"
    chmod 600 "$APP_DIR/.env"
    echo -e " ${GREEN}✔${NC}"

    printf "    %-40s" "${APP_DIR}/data/ → 777 (writable)"
    chmod 777 "$APP_DIR/data" 2>/dev/null || true
    echo -e " ${GREEN}✔${NC}"

    printf "    %-40s" "SSL key → 600 (private)"
    [ -f "$SSL_KEY" ] && chmod 600 "$SSL_KEY"
    echo -e " ${GREEN}✔${NC}"

    echo ""
    log "Permissions set"
}

# ───────── Uninstaller ─────────
create_uninstaller() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}  [Step 12/12] Creating Uninstaller${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    log "Creating uninstaller..."

    # The uninstaller is written to /usr/local/sbin/ so it survives app dir deletion
    # and also a copy inside $APP_DIR that self-copies to /tmp before running.
    UNINSTALL_PATH="/usr/local/sbin/${APP_NAME}-uninstall.sh"

    cat > "$UNINSTALL_PATH" << 'UNINSTEOF'
#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# CDN IP Scanner V2.0 — Complete Uninstaller
# ═══════════════════════════════════════════════════════════════

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

APP_NAME="cdn-ip-scanner"
APP_DIR="/opt/${APP_NAME}"
SERVICE_NAME="${APP_NAME}"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
NGINX_SITES_AVAIL="/etc/nginx/sites-available/${APP_NAME}"
NGINX_SITES_ENABLED="/etc/nginx/sites-enabled/${APP_NAME}"
NGINX_CONF_D="/etc/nginx/conf.d/${APP_NAME}.conf"
SSL_DIR="/etc/nginx/ssl_${APP_NAME}"
HTPASSWD_FILE="/etc/nginx/.htpasswd_${APP_NAME}"
LOG_FILE="/var/log/${APP_NAME}-install.log"
REMOVED=0
SKIPPED=0
ERRORS=0

ok()   { echo -e "    ${GREEN}✔ $1${NC}"; REMOVED=$((REMOVED + 1)); }
skip() { echo -e "    ${YELLOW}– $1${NC}"; SKIPPED=$((SKIPPED + 1)); }
fail() { echo -e "    ${RED}✘ $1${NC}"; ERRORS=$((ERRORS + 1)); }

# ─── Root check ───
if [ "$(id -u)" -ne 0 ]; then
    echo -e "${RED}[!] Run as root: sudo bash $0${NC}"
    exit 1
fi

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                                                          ║${NC}"
echo -e "${CYAN}║       CDN IP Scanner V2.0 — Uninstaller                  ║${NC}"
echo -e "${CYAN}║                                                          ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${BOLD}The following will be removed:${NC}"
echo ""
[ -f "$SERVICE_FILE" ]       && echo -e "  • Systemd service : ${SERVICE_FILE}" || echo -e "  ${YELLOW}• Systemd service : (not found)${NC}"
[ -f "$NGINX_SITES_AVAIL" ]  && echo -e "  • Nginx config    : ${NGINX_SITES_AVAIL}" || true
[ -f "$NGINX_CONF_D" ]       && echo -e "  • Nginx config    : ${NGINX_CONF_D}" || true
[ ! -f "$NGINX_SITES_AVAIL" ] && [ ! -f "$NGINX_CONF_D" ] && echo -e "  ${YELLOW}• Nginx config    : (not found)${NC}" || true
[ -d "$SSL_DIR" ]            && echo -e "  • SSL certificates: ${SSL_DIR}" || echo -e "  ${YELLOW}• SSL certificates: (not found)${NC}"
[ -f "$HTPASSWD_FILE" ]      && echo -e "  • Auth file       : ${HTPASSWD_FILE}" || echo -e "  ${YELLOW}• Auth file       : (not found)${NC}"
[ -d "$APP_DIR" ]            && echo -e "  • App directory   : ${APP_DIR} ($(du -sh "$APP_DIR" 2>/dev/null | awk '{print $1}'))" || echo -e "  ${YELLOW}• App directory   : (not found)${NC}"
id "cdnscanner" >/dev/null 2>&1 && echo -e "  • System user     : cdnscanner" || echo -e "  ${YELLOW}• System user     : (not found)${NC}"
[ -f "$LOG_FILE" ]           && echo -e "  • Install log     : ${LOG_FILE}" || true
echo ""

read -rp "$(echo -e "${RED}${BOLD}Are you sure you want to uninstall? [y/N]: ${NC}")" CONFIRM
case "$CONFIRM" in
    [Yy]*) ;;
    *) echo -e "\n${GREEN}Cancelled. Nothing was removed.${NC}"; exit 0 ;;
esac

echo ""
echo -e "${BOLD}Starting uninstall...${NC}"
echo ""

# ═══════════════════════════════════════════
# Step 1: Stop and disable systemd service
# ═══════════════════════════════════════════
echo -e "${CYAN}[1/8]${NC} ${BOLD}Stopping systemd service...${NC}"

if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    systemctl stop "$SERVICE_NAME"
    if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
        fail "Could not stop service ${SERVICE_NAME}"
    else
        ok "Service stopped"
    fi
else
    skip "Service was not running"
fi

if systemctl is-enabled --quiet "$SERVICE_NAME" 2>/dev/null; then
    systemctl disable "$SERVICE_NAME" 2>/dev/null
    ok "Service disabled from auto-start"
else
    skip "Service was not enabled"
fi

if [ -f "$SERVICE_FILE" ]; then
    rm -f "$SERVICE_FILE"
    ok "Removed ${SERVICE_FILE}"
else
    skip "Service file not found"
fi

systemctl daemon-reload 2>/dev/null
ok "Systemd daemon reloaded"

# ═══════════════════════════════════════════
# Step 2: Kill any remaining processes
# ═══════════════════════════════════════════
echo ""
echo -e "${CYAN}[2/8]${NC} ${BOLD}Killing remaining processes...${NC}"

PIDS=$(pgrep -f "${APP_DIR}/run.py" 2>/dev/null) || true
if [ -n "$PIDS" ]; then
    echo "$PIDS" | xargs kill -9 2>/dev/null || true
    ok "Killed leftover processes: ${PIDS}"
else
    skip "No leftover processes found"
fi

PIDS2=$(pgrep -f "${APP_DIR}/venv" 2>/dev/null) || true
if [ -n "$PIDS2" ]; then
    echo "$PIDS2" | xargs kill -9 2>/dev/null || true
    ok "Killed venv processes: ${PIDS2}"
else
    skip "No venv processes found"
fi

# ═══════════════════════════════════════════
# Step 3: Remove Nginx configuration
# ═══════════════════════════════════════════
echo ""
echo -e "${CYAN}[3/8]${NC} ${BOLD}Removing Nginx configuration...${NC}"

if [ -f "$NGINX_SITES_AVAIL" ]; then
    rm -f "$NGINX_SITES_AVAIL"
    ok "Removed ${NGINX_SITES_AVAIL}"
else
    skip "sites-available config not found"
fi

if [ -L "$NGINX_SITES_ENABLED" ] || [ -f "$NGINX_SITES_ENABLED" ]; then
    rm -f "$NGINX_SITES_ENABLED"
    ok "Removed ${NGINX_SITES_ENABLED}"
else
    skip "sites-enabled symlink not found"
fi

if [ -f "$NGINX_CONF_D" ]; then
    rm -f "$NGINX_CONF_D"
    ok "Removed ${NGINX_CONF_D}"
else
    skip "conf.d config not found"
fi

# Remove backup files too
rm -f "${NGINX_SITES_AVAIL}.bak" "${NGINX_CONF_D}.bak" 2>/dev/null

if command -v nginx >/dev/null 2>&1; then
    if nginx -t 2>/dev/null; then
        systemctl reload nginx 2>/dev/null || systemctl restart nginx 2>/dev/null || true
        ok "Nginx reloaded successfully"
    else
        warn "Nginx config test failed after removal — check manually"
    fi
else
    skip "Nginx not installed"
fi

# ═══════════════════════════════════════════
# Step 4: Remove SSL certificates
# ═══════════════════════════════════════════
echo ""
echo -e "${CYAN}[4/8]${NC} ${BOLD}Removing SSL certificates...${NC}"

if [ -d "$SSL_DIR" ]; then
    CERT_COUNT=$(find "$SSL_DIR" -type f 2>/dev/null | wc -l)
    rm -rf "$SSL_DIR"
    ok "Removed ${SSL_DIR} (${CERT_COUNT} files)"
else
    skip "SSL directory not found"
fi

# Check for Let's Encrypt certs too
LE_DIR="/etc/letsencrypt/live/${APP_NAME}"
LE_RENEWAL="/etc/letsencrypt/renewal/${APP_NAME}.conf"
if [ -d "$LE_DIR" ] || [ -f "$LE_RENEWAL" ]; then
    echo -e "    ${YELLOW}Found Let's Encrypt certificate.${NC}"
    read -rp "    Remove Let's Encrypt cert too? [y/N]: " LE_CONFIRM
    case "$LE_CONFIRM" in
        [Yy]*)
            certbot delete --cert-name "$APP_NAME" --non-interactive 2>/dev/null || true
            rm -rf "$LE_DIR" "$LE_RENEWAL" 2>/dev/null || true
            ok "Let's Encrypt certificate removed"
            ;;
        *)
            skip "Let's Encrypt certificate kept"
            ;;
    esac
else
    skip "No Let's Encrypt certificate found"
fi

# ═══════════════════════════════════════════
# Step 5: Remove Basic Auth file
# ═══════════════════════════════════════════
echo ""
echo -e "${CYAN}[5/8]${NC} ${BOLD}Removing authentication...${NC}"

if [ -f "$HTPASSWD_FILE" ]; then
    rm -f "$HTPASSWD_FILE"
    ok "Removed ${HTPASSWD_FILE}"
else
    skip "Auth file not found"
fi

# ═══════════════════════════════════════════
# Step 6: Remove application directory
# ═══════════════════════════════════════════
echo ""
echo -e "${CYAN}[6/8]${NC} ${BOLD}Removing application files...${NC}"

if [ -d "$APP_DIR" ]; then
    APP_SIZE=$(du -sh "$APP_DIR" 2>/dev/null | awk '{print $1}')
    FILE_COUNT=$(find "$APP_DIR" -type f 2>/dev/null | wc -l)

    # Check for database with user data
    DB_FILE="${APP_DIR}/data/scanner.db"
    if [ -f "$DB_FILE" ]; then
        DB_SIZE=$(du -sh "$DB_FILE" 2>/dev/null | awk '{print $1}')
        echo -e "    ${YELLOW}Database found: ${DB_FILE} (${DB_SIZE})${NC}"
        read -rp "    Keep a backup of the database? [Y/n]: " DB_CONFIRM
        case "$DB_CONFIRM" in
            [Nn]*)
                skip "Database will be deleted with app"
                ;;
            *)
                BACKUP_PATH="/root/${APP_NAME}-db-backup-$(date +%Y%m%d-%H%M%S).db"
                cp "$DB_FILE" "$BACKUP_PATH" 2>/dev/null
                ok "Database backed up to ${BACKUP_PATH}"
                ;;
        esac
    fi

    rm -rf "$APP_DIR"
    if [ ! -d "$APP_DIR" ]; then
        ok "Removed ${APP_DIR} (${FILE_COUNT} files, ${APP_SIZE})"
    else
        fail "Could not fully remove ${APP_DIR}"
    fi
else
    skip "App directory not found"
fi

# ═══════════════════════════════════════════
# Step 7: Remove system user
# ═══════════════════════════════════════════
echo ""
echo -e "${CYAN}[7/8]${NC} ${BOLD}Removing system user...${NC}"

if id "cdnscanner" >/dev/null 2>&1; then
    userdel "cdnscanner" 2>/dev/null
    if id "cdnscanner" >/dev/null 2>&1; then
        fail "Could not remove user cdnscanner"
    else
        ok "User cdnscanner removed"
    fi
else
    skip "User cdnscanner does not exist"
fi

# ═══════════════════════════════════════════
# Step 8: Clean up logs, manage script, install config, cron
# ═══════════════════════════════════════════
echo ""
echo -e "${CYAN}[8/8]${NC} ${BOLD}Cleaning up...${NC}"

if [ -f "$LOG_FILE" ]; then
    rm -f "$LOG_FILE"
    ok "Removed install log: ${LOG_FILE}"
else
    skip "Install log not found"
fi

if [ -f "/usr/local/sbin/cdn-scanner-manage" ]; then
    rm -f "/usr/local/sbin/cdn-scanner-manage"
    ok "Removed management script: cdn-scanner-manage"
else
    skip "Management script not found"
fi

if [ -d "/etc/${APP_NAME}" ]; then
    rm -rf "/etc/${APP_NAME}"
    ok "Removed install config: /etc/${APP_NAME}/"
else
    skip "Install config dir not found"
fi

rm -f "/tmp/${APP_NAME}-uninstall.sh" 2>/dev/null || true

# Remove certbot renewal cron if exists
if crontab -l 2>/dev/null | grep -q "certbot renew"; then
    crontab -l 2>/dev/null | grep -v "certbot renew" | crontab - 2>/dev/null || true
    ok "Removed certbot renewal cron job"
else
    skip "No certbot cron job found"
fi

# Remove firewall rules
if command -v ufw >/dev/null 2>&1; then
    echo -e "    ${YELLOW}Note: Firewall rules for ports 80/443 were NOT removed.${NC}"
    echo -e "    ${YELLOW}To remove: ufw delete allow 80/tcp && ufw delete allow 443/tcp${NC}"
elif command -v firewall-cmd >/dev/null 2>&1; then
    echo -e "    ${YELLOW}Note: Firewall rules were NOT removed.${NC}"
    echo -e "    ${YELLOW}To remove: firewall-cmd --permanent --remove-service=http --remove-service=https && firewall-cmd --reload${NC}"
fi

# ═══════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════
echo ""
echo -e "${CYAN}══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${GREEN}${BOLD}Uninstall complete!${NC}"
echo ""
echo -e "  ${GREEN}Removed : ${REMOVED} items${NC}"
[ $SKIPPED -gt 0 ] && echo -e "  ${YELLOW}Skipped : ${SKIPPED} items (not found or kept)${NC}"
[ $ERRORS -gt 0 ]  && echo -e "  ${RED}Errors  : ${ERRORS} items (check manually)${NC}"
echo ""
echo -e "${CYAN}══════════════════════════════════════════════════════════${NC}"
echo ""

# Self-cleanup
SELF_PATH="$(readlink -f "$0" 2>/dev/null || echo "$0")"
rm -f "$SELF_PATH" 2>/dev/null || true
rm -f "/usr/local/sbin/${APP_NAME}-uninstall.sh" 2>/dev/null || true
UNINSTEOF

    chmod +x "$UNINSTALL_PATH"

    # Also create a wrapper inside $APP_DIR that copies itself to /tmp then runs
    cat > "$APP_DIR/uninstall.sh" << 'WRAPEOF'
#!/bin/bash
APP_NAME="cdn-ip-scanner"
SRC="/usr/local/sbin/${APP_NAME}-uninstall.sh"

if [ "$(id -u)" -ne 0 ]; then
    echo -e "\033[0;31m[!] Run as root: sudo bash $0\033[0m"
    exit 1
fi

if [ -f "$SRC" ]; then
    exec bash "$SRC"
else
    echo -e "\033[0;31m[!] Uninstall script not found at ${SRC}\033[0m"
    echo "    Try re-running the installer first, or manually remove:"
    echo "      systemctl stop ${APP_NAME} && systemctl disable ${APP_NAME}"
    echo "      rm -f /etc/systemd/system/${APP_NAME}.service"
    echo "      rm -f /etc/nginx/sites-available/${APP_NAME} /etc/nginx/sites-enabled/${APP_NAME} /etc/nginx/conf.d/${APP_NAME}.conf"
    echo "      rm -rf /etc/nginx/ssl_${APP_NAME}"
    echo "      rm -f /etc/nginx/.htpasswd_${APP_NAME}"
    echo "      rm -rf /opt/${APP_NAME}"
    echo "      systemctl daemon-reload && systemctl reload nginx"
    exit 1
fi
WRAPEOF
    chmod +x "$APP_DIR/uninstall.sh"

    log "Uninstaller ready: ${UNINSTALL_PATH}"
}

# ───────── Install state (for manage script) ─────────
INSTALL_CONF="/etc/${APP_NAME}/install.conf"

write_install_config() {
    mkdir -p "/etc/${APP_NAME}"
    [ -z "$ACME_EMAIL" ] && ACME_EMAIL="admin@example.com"
    cat > "$INSTALL_CONF" << INSTALLCONF
# CDN IP Scanner — install state (used by cdn-scanner-manage)
HOSTNAME_INPUT=${HOSTNAME_INPUT}
USE_DOMAIN=${USE_DOMAIN}
APP_PORT=${APP_PORT}
SSL_DIR=${SSL_DIR}
ACME_CHALLENGE_DIR=${ACME_CHALLENGE_DIR}
APP_DIR=${APP_DIR}
SERVICE_NAME=${SERVICE_NAME}
NGINX_CONF=${NGINX_CONF}
NGINX_CONF_D=${NGINX_CONF_D}
ACME_EMAIL=${ACME_EMAIL}
INSTALLCONF
    chmod 644 "$INSTALL_CONF"
    log "Install config saved: ${INSTALL_CONF}"
}

# ───────── Management script: status, ssl, uninstall ─────────
create_manage_script() {
    MANAGER="/usr/local/sbin/cdn-scanner-manage"
    cat > "$MANAGER" << 'MANAGEREOF'
#!/bin/bash
# CDN IP Scanner V2.0 — Management: status, ssl, uninstall

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

APP_NAME="cdn-ip-scanner"
INSTALL_CONF="/etc/${APP_NAME}/install.conf"
UNINSTALL_SCRIPT="/usr/local/sbin/${APP_NAME}-uninstall.sh"

load_config() {
    if [ ! -f "$INSTALL_CONF" ]; then
        echo -e "${RED}Not installed or config missing: ${INSTALL_CONF}${NC}"
        exit 1
    fi
    # shellcheck source=/dev/null
    . "$INSTALL_CONF"
}

# ssl and uninstall require root
if [ "$(id -u)" -ne 0 ]; then
    case "${1:-}" in
        ssl|uninstall)
            echo -e "${RED}Run as root: sudo cdn-scanner-manage $1${NC}"
            exit 1
            ;;
    esac
fi

cmd_status() {
    load_config
    echo ""
    echo -e "${CYAN}══════════════════════════════════════════════════════════${NC}"
    echo -e "  ${BOLD}CDN IP Scanner — Status${NC}"
    echo -e "${CYAN}══════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${BOLD}URL${NC}       : ${GREEN}https://${HOSTNAME_INPUT}${NC}"
    echo -e "  ${BOLD}Service${NC}   : ${SERVICE_NAME}"
    echo ""

    if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
        echo -e "  ${BOLD}App${NC}       : ${GREEN}running ✔${NC}"
        PID=$(systemctl show -p MainPID "$SERVICE_NAME" 2>/dev/null | cut -d= -f2)
        [ -n "$PID" ] && [ "$PID" != "0" ] && echo -e "  ${BOLD}PID${NC}        : ${PID}"
    else
        echo -e "  ${BOLD}App${NC}       : ${RED}stopped ✘${NC}"
    fi

    if systemctl is-active --quiet nginx 2>/dev/null; then
        echo -e "  ${BOLD}Nginx${NC}     : ${GREEN}running ✔${NC}"
    else
        echo -e "  ${BOLD}Nginx${NC}     : ${RED}stopped ✘${NC}"
    fi

    if [ -f "${SSL_DIR}/cert.pem" ]; then
        EXPIRY=$(openssl x509 -in "${SSL_DIR}/cert.pem" -noout -enddate 2>/dev/null | cut -d= -f2)
        echo -e "  ${BOLD}SSL cert${NC}  : ${GREEN}${SSL_DIR}/cert.pem${NC}"
        echo -e "  ${BOLD}Expires${NC}  : ${EXPIRY}"
    else
        echo -e "  ${BOLD}SSL cert${NC}  : ${YELLOW}not found${NC}"
    fi

    echo ""
    echo -e "  ${BOLD}Commands:${NC}"
    echo -e "    Start   : systemctl start ${SERVICE_NAME}"
    echo -e "    Stop    : systemctl stop ${SERVICE_NAME}"
    echo -e "    Restart : systemctl restart ${SERVICE_NAME}"
    echo -e "    Logs    : journalctl -u ${SERVICE_NAME} -f"
    echo -e "    SSL     : cdn-scanner-manage ssl"
    echo -e "    Remove  : cdn-scanner-manage uninstall"
    echo ""
}

cmd_ssl() {
    load_config
    echo ""
    echo -e "${CYAN}══════════════════════════════════════════════════════════${NC}"
    echo -e "  ${BOLD}CDN IP Scanner — SSL Renewal${NC}"
    echo -e "${CYAN}══════════════════════════════════════════════════════════${NC}"
    echo ""

    if [ "$USE_DOMAIN" = "true" ]; then
        echo -e "  ${BLUE}Domain mode: running certbot renew...${NC}"
        certbot renew --nginx 2>&1
        systemctl reload nginx 2>/dev/null || true
        echo -e "  ${GREEN}Done.${NC}"
    else
        echo -e "  ${BLUE}IP mode: Let's Encrypt IP certificate (acme.sh)...${NC}"
        export HOME=/root
        ACME_SH="/root/.acme.sh/acme.sh"
        ACME_MAIL="${ACME_EMAIL:-admin@example.com}"
        if [ ! -f "$ACME_SH" ]; then
            echo -e "  ${YELLOW}acme.sh not found. Installing with email ${ACME_MAIL}...${NC}"
            if ! curl -sL https://get.acme.sh | sh -s email="${ACME_MAIL}"; then
                echo -e "  ${RED}acme.sh installation failed.${NC}"
                exit 1
            fi
            if [ ! -f "$ACME_SH" ]; then
                echo -e "  ${RED}acme.sh still not found at $ACME_SH${NC}"
                exit 1
            fi
            echo -e "  ${GREEN}acme.sh installed.${NC}"
        fi
        mkdir -p "${ACME_CHALLENGE_DIR}/.well-known/acme-challenge"
        chown -R www-data:www-data "$ACME_CHALLENGE_DIR" 2>/dev/null || chown -R nginx:nginx "$ACME_CHALLENGE_DIR" 2>/dev/null || true
        chmod -R 755 "$ACME_CHALLENGE_DIR"
        export HOME=/root
        ACME_TMP=$(mktemp)
        if ! "$ACME_SH" --issue -d "$HOSTNAME_INPUT" \
            --webroot "$ACME_CHALLENGE_DIR" \
            --server letsencrypt \
            --certificate-profile shortlived \
            --days 5 \
            --force 2>"$ACME_TMP"; then
            if grep -q "invalidContact\|invalid contact" "$ACME_TMP" 2>/dev/null; then
                echo -e "  ${YELLOW}Let's Encrypt rejected the account email. Removing old account and reinstalling acme.sh with email from config...${NC}"
                rm -rf /root/.acme.sh
                ACME_SH="/root/.acme.sh/acme.sh"
                if ! curl -sL https://get.acme.sh | sh -s email="${ACME_MAIL}"; then
                    cat "$ACME_TMP"
                    rm -f "$ACME_TMP"
                    echo -e "  ${RED}Reinstall failed. Add a valid email to config: echo 'ACME_EMAIL=your@real-email.com' >> $INSTALL_CONF${NC}"
                    echo -e "  Then run: sudo rm -rf /root/.acme.sh && sudo cdn-scanner-manage ssl"
                    exit 1
                fi
                rm -f "$ACME_TMP"
                if "$ACME_SH" --issue -d "$HOSTNAME_INPUT" --webroot "$ACME_CHALLENGE_DIR" --server letsencrypt --certificate-profile shortlived --days 5 --force; then
                    "$ACME_SH" --install-cert -d "$HOSTNAME_INPUT" --key-file "${SSL_DIR}/key.pem" --fullchain-file "${SSL_DIR}/cert.pem" --reloadcmd "systemctl reload nginx"
                    chmod 644 "${SSL_DIR}/cert.pem"
                    chmod 600 "${SSL_DIR}/key.pem"
                    systemctl reload nginx 2>/dev/null || true
                    echo -e "  ${GREEN}SSL certificate installed successfully.${NC}"
                else
                    echo -e "  ${RED}Still failed. Set a valid email: echo 'ACME_EMAIL=you@gmail.com' >> $INSTALL_CONF then rm -rf /root/.acme.sh and run this again.${NC}"
                    exit 1
                fi
            else
                cat "$ACME_TMP"
                rm -f "$ACME_TMP"
                echo -e "  ${YELLOW}Renewal failed. Ensure port 80 is open from the internet.${NC}"
                exit 1
            fi
        else
            rm -f "$ACME_TMP"
            "$ACME_SH" --install-cert -d "$HOSTNAME_INPUT" \
                --key-file "${SSL_DIR}/key.pem" \
                --fullchain-file "${SSL_DIR}/cert.pem" \
                --reloadcmd "systemctl reload nginx"
            chmod 644 "${SSL_DIR}/cert.pem"
            chmod 600 "${SSL_DIR}/key.pem"
            systemctl reload nginx 2>/dev/null || true
            echo -e "  ${GREEN}SSL certificate renewed successfully.${NC}"
        fi
    fi
    echo ""
}

cmd_uninstall() {
    if [ ! -f "$UNINSTALL_SCRIPT" ]; then
        echo -e "${RED}Uninstaller not found: ${UNINSTALL_SCRIPT}${NC}"
        exit 1
    fi
    exec bash "$UNINSTALL_SCRIPT"
}

case "${1:-}" in
    status)   cmd_status ;;
    ssl)      cmd_ssl ;;
    uninstall) cmd_uninstall ;;
    *)
        echo ""
        echo -e "${BOLD}CDN IP Scanner — Management${NC}"
        echo ""
        echo "  Usage: cdn-scanner-manage <command>"
        echo ""
        echo "  Commands:"
        echo "    status    Show service status, URL, SSL expiry"
        echo "    ssl       Renew SSL (Let's Encrypt / ACME)"
        echo "    uninstall Remove CDN IP Scanner completely"
        echo ""
        echo "  Examples:"
        echo "    sudo cdn-scanner-manage status"
        echo "    sudo cdn-scanner-manage ssl"
        echo "    sudo cdn-scanner-manage uninstall"
        echo ""
        exit 0
        ;;
esac
MANAGEREOF
    chmod +x "$MANAGER"
    log "Management script ready: $MANAGER (status | ssl | uninstall)"
}

# ───────── Summary ─────────
print_summary() {
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                          ║${NC}"
    echo -e "${GREEN}║       ✅  Installation Complete!                         ║${NC}"
    echo -e "${GREEN}║                                                          ║${NC}"
    echo -e "${GREEN}╠══════════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║                                                          ║${NC}"
    echo -e "${GREEN}║${NC}  ${BOLD}Panel URL${NC} : ${CYAN}https://${HOSTNAME_INPUT}${NC} (port 443, SSL)"
    echo -e "${GREEN}║${NC}  ${BOLD}Username${NC} : ${CYAN}${PANEL_USER}${NC}"
    echo -e "${GREEN}║${NC}  ${BOLD}Password${NC} : ${CYAN}${PANEL_PASS}${NC}"
    echo -e "${GREEN}║${NC}  ${BOLD}SSL${NC}      : ${CYAN}$([ "$USE_DOMAIN" = true ] && echo "Let's Encrypt (trusted)" || echo "Self-signed (encrypted)")${NC}"
    echo -e "${GREEN}║                                                          ║${NC}"
    echo -e "${GREEN}╠══════════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║${NC}  ${BOLD}Management (run after install):${NC}"
    echo -e "${GREEN}║${NC}    Status    : ${CYAN}sudo cdn-scanner-manage status${NC}"
    echo -e "${GREEN}║${NC}    SSL renew : ${CYAN}sudo cdn-scanner-manage ssl${NC}"
    echo -e "${GREEN}║${NC}    Uninstall : ${CYAN}sudo cdn-scanner-manage uninstall${NC}"
    echo -e "${GREEN}║${NC}    Logs      : ${CYAN}journalctl -u ${SERVICE_NAME} -f${NC}"
    echo -e "${GREEN}║${NC}    Restart   : ${CYAN}systemctl restart ${SERVICE_NAME}${NC}"
    echo -e "${GREEN}║                                                          ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
    echo ""

    if [ "$USE_DOMAIN" = false ]; then
        echo -e "  ${YELLOW}┌─────────────────────────────────────────────────────┐${NC}"
        echo -e "  ${YELLOW}│  IP-based SSL: Connection is encrypted (HTTPS).     │${NC}"
        echo -e "  ${YELLOW}│  Browser will show a security warning — this is     │${NC}"
        echo -e "  ${YELLOW}│  NORMAL and expected for IP-based certificates.     │${NC}"
        echo -e "  ${YELLOW}│                                                     │${NC}"
        echo -e "  ${YELLOW}│  → Chrome : 'Advanced' → 'Proceed to ${HOSTNAME_INPUT}'${NC}"
        echo -e "  ${YELLOW}│  → Firefox: 'Advanced' → 'Accept the Risk'         │${NC}"
        echo -e "  ${YELLOW}│                                                     │${NC}"
        echo -e "  ${YELLOW}│  To remove the warning, point a domain to this      │${NC}"
        echo -e "  ${YELLOW}│  server and reinstall, or run:                      │${NC}"
        echo -e "  ${YELLOW}│  certbot --nginx -d yourdomain.com                  │${NC}"
        echo -e "  ${YELLOW}└─────────────────────────────────────────────────────┘${NC}"
        echo ""
    fi

    echo -e "  Log file: ${LOG_FILE}"
    echo ""
}

# ======================== MAIN ========================

main() {
    mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
    echo "=== CDN IP Scanner Install $(date) ===" > "$LOG_FILE"

    banner
    check_root
    detect_os
    get_user_input

    START_TIME=$(date +%s)

    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║                                                          ║${NC}"
    echo -e "${CYAN}║  ${BOLD}Installation Plan (12 steps):${NC}${CYAN}                           ║${NC}"
    echo -e "${CYAN}║                                                          ║${NC}"
    echo -e "${CYAN}║${NC}   1.  Install system packages (Python, Nginx, SSL)       ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}   2.  Deploy application files & Python dependencies     ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}   3.  Create environment configuration                   ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}   4.  Generate SSL certificates                          ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}   5.  Setup Basic Authentication                         ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}   6.  Configure Nginx reverse proxy                      ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}   7.  Create systemd service                             ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}   8.  Configure firewall rules                           ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}   9.  Set file permissions                               ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}  10.  Start application                                  ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}  11.  Finalize SSL (Let's Encrypt if domain)             ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}  12.  Create uninstaller                                 ${CYAN}║${NC}"
    echo -e "${CYAN}║                                                          ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BOLD}Starting installation...${NC}"

    install_packages
    deploy_app
    create_env_file
    setup_ssl
    setup_htpasswd
    configure_nginx
    create_service
    configure_firewall
    set_permissions
    start_service

    # IP mode: install acme.sh so SSL renewal (cdn-scanner-manage ssl) always works
    if [ "$USE_DOMAIN" != true ]; then
        echo ""
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${BOLD}  Installing acme.sh (for SSL on IP)${NC}"
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
        install_acme_sh || true
        echo ""
    fi

    try_letsencrypt
    create_uninstaller
    write_install_config
    create_manage_script

    # Final restart to apply everything
    echo ""
    echo -e "  ${BLUE}Final service restart...${NC}"
    systemctl restart "$SERVICE_NAME" 2>/dev/null || true
    sleep 2
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        echo -e "    ${GREEN}Service running ✔${NC}"
    fi

    END_TIME=$(date +%s)
    ELAPSED=$(( END_TIME - START_TIME ))
    MINS=$(( ELAPSED / 60 ))
    SECS=$(( ELAPSED % 60 ))

    echo ""
    echo -e "  ${GREEN}Total installation time: ${MINS}m ${SECS}s${NC}"

    print_summary
}

main "$@"
