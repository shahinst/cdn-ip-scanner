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

    echo ""
    echo -e "${BOLD}-- Summary --${NC}"
    echo -e "  Username : ${GREEN}${PANEL_USER}${NC}"
    echo -e "  Password : ${GREEN}****${NC}"
    echo -e "  Address  : ${GREEN}${HOSTNAME_INPUT}${NC}"
    echo -e "  Backend  : ${GREEN}127.0.0.1:${APP_PORT}${NC}"
    echo -e "  Domain   : ${GREEN}${USE_DOMAIN}${NC}"
    echo ""
    read -rp "$(echo -e "${YELLOW}Continue? [Y/n]: ${NC}")" CONFIRM
    case "$CONFIRM" in
        [Nn]*) echo "Cancelled."; exit 0 ;;
    esac
}

# ───────── Install packages ─────────
install_packages() {
    log "Installing system packages..."

    if [ "$PKG_MGR" = "apt" ]; then
        export DEBIAN_FRONTEND=noninteractive
        apt-get update -qq || true
        apt-get install -y -qq \
            python3 python3-pip python3-venv python3-dev \
            nginx openssl curl wget ca-certificates \
            build-essential libffi-dev libssl-dev \
            apache2-utils \
            2>&1 | tail -3 || true

        # Nginx SSL module (required for HTTPS)
        apt-get install -y -qq libnginx-mod-http-ssl 2>/dev/null || true
        # If not found, try full nginx (has ssl built-in)
        if ! nginx -V 2>&1 | grep -q "ssl"; then
            apt-get install -y -qq nginx-full 2>/dev/null || true
        fi

        # Certbot for Let's Encrypt (domain only)
        apt-get install -y -qq certbot python3-certbot-nginx 2>/dev/null || true

    elif [ "$PKG_MGR" = "dnf" ] || [ "$PKG_MGR" = "yum" ]; then
        $PKG_MGR install -y -q epel-release 2>/dev/null || true

        $PKG_MGR install -y -q \
            python3 python3-pip python3-devel \
            nginx openssl curl wget ca-certificates \
            gcc gcc-c++ libffi-devel openssl-devel \
            httpd-tools \
            2>&1 | tail -3 || true

        # Certbot for Let's Encrypt
        $PKG_MGR install -y -q certbot python3-certbot-nginx 2>/dev/null || true
    fi

    # Verify Nginx has SSL support
    if ! nginx -V 2>&1 | grep -q "ssl"; then
        warn "Nginx SSL module not found. Trying to install..."
        if [ "$PKG_MGR" = "apt" ]; then
            apt-get install -y -qq nginx-extras 2>/dev/null || apt-get install -y -qq nginx 2>/dev/null || true
        fi
    fi
    nginx -V 2>&1 | grep -q "ssl" && log "Nginx SSL support: OK" || warn "Nginx may not have SSL; HTTPS might fail"

    # Verify critical tools exist
    command -v python3 >/dev/null 2>&1 || die "python3 installation failed"
    command -v nginx >/dev/null 2>&1 || die "nginx installation failed"
    command -v openssl >/dev/null 2>&1 || die "openssl installation failed"

    log "System packages OK"
}

# ───────── Deploy application ─────────
deploy_app() {
    log "Deploying application..."

    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

    # Clean old install if exists
    if [ -d "$APP_DIR" ]; then
        # Preserve data directory
        if [ -d "$APP_DIR/data" ]; then
            cp -r "$APP_DIR/data" /tmp/_cdn_scanner_data_backup 2>/dev/null || true
        fi
        rm -rf "$APP_DIR"
    fi

    mkdir -p "$APP_DIR"
    mkdir -p "$APP_DIR/data"

    # Copy app files
    cp -r "${SCRIPT_DIR}/app" "$APP_DIR/" || die "Failed to copy app/"
    cp "${SCRIPT_DIR}/run.py" "$APP_DIR/" || die "Failed to copy run.py"
    cp "${SCRIPT_DIR}/requirements.txt" "$APP_DIR/" || die "Failed to copy requirements.txt"
    cp "${SCRIPT_DIR}/version" "$APP_DIR/" 2>/dev/null || echo "2.0" > "$APP_DIR/version"

    # Restore data backup
    if [ -d /tmp/_cdn_scanner_data_backup ]; then
        cp -r /tmp/_cdn_scanner_data_backup/* "$APP_DIR/data/" 2>/dev/null || true
        rm -rf /tmp/_cdn_scanner_data_backup
    fi

    # Python venv
    log "Creating Python virtual environment..."
    python3 -m venv "$APP_DIR/venv" || die "Failed to create venv"

    log "Installing Python dependencies (this may take 1-2 minutes)..."
    "$APP_DIR/venv/bin/pip" install --upgrade pip setuptools wheel -q 2>&1 | tail -1 || true
    "$APP_DIR/venv/bin/pip" install -r "$APP_DIR/requirements.txt" 2>&1 | tail -5
    PIP_EXIT=$?
    if [ $PIP_EXIT -ne 0 ]; then
        warn "pip install had warnings (exit=$PIP_EXIT), checking critical packages..."
    fi

    # Verify critical imports
    "$APP_DIR/venv/bin/python" -c "
import flask
import flask_socketio
import gevent
import requests
import dotenv
print('OK: All critical packages installed')
" || die "Critical Python packages are missing. Check pip output above."

    log "Application deployed"
}

# ───────── Create .env ─────────
create_env_file() {
    log "Creating .env..."

    SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null)
    if [ -z "$SECRET_KEY" ]; then
        SECRET_KEY=$(openssl rand -hex 32 2>/dev/null || echo "fallback-secret-change-me-$(date +%s)")
    fi

    cat > "$APP_DIR/.env" << ENVEOF
SECRET_KEY=${SECRET_KEY}
PORT=${APP_PORT}
PANEL_USER=${PANEL_USER}
PANEL_PASS=${PANEL_PASS}
ENVEOF

    chmod 600 "$APP_DIR/.env"
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

    # Clean up temp config
    rm -f "$OPENSSL_CNF"
}

# Let's Encrypt (ACME) — only for domains, after Nginx is running with self-signed
try_letsencrypt() {
    if [ "$USE_DOMAIN" != true ]; then
        log "IP-based access → self-signed certificate is the only option."
        log "(Let's Encrypt / ACME does not issue certificates for bare IP addresses)"
        echo ""
        echo -e "  ${YELLOW}╔════════════════════════════════════════════════════════════╗${NC}"
        echo -e "  ${YELLOW}║  SSL on IP: Self-signed certificate installed.            ║${NC}"
        echo -e "  ${YELLOW}║                                                            ║${NC}"
        echo -e "  ${YELLOW}║  Your connection IS encrypted (HTTPS works).               ║${NC}"
        echo -e "  ${YELLOW}║  Browser will show a warning — this is NORMAL for IP SSL.  ║${NC}"
        echo -e "  ${YELLOW}║                                                            ║${NC}"
        echo -e "  ${YELLOW}║  To proceed:                                               ║${NC}"
        echo -e "  ${YELLOW}║    Chrome : Click 'Advanced' → 'Proceed to <ip>'           ║${NC}"
        echo -e "  ${YELLOW}║    Firefox: Click 'Advanced' → 'Accept the Risk'           ║${NC}"
        echo -e "  ${YELLOW}║                                                            ║${NC}"
        echo -e "  ${YELLOW}║  To avoid the warning, use a domain name instead.          ║${NC}"
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
    log "Setting up Basic Authentication..."

    if command -v htpasswd >/dev/null 2>&1; then
        htpasswd -cb "$HTPASSWD_FILE" "$PANEL_USER" "$PANEL_PASS" 2>/dev/null
    else
        # Fallback: openssl
        HASHED=$(openssl passwd -apr1 "$PANEL_PASS" 2>/dev/null) || true
        if [ -n "$HASHED" ]; then
            echo "${PANEL_USER}:${HASHED}" > "$HTPASSWD_FILE"
        else
            # Fallback: Python
            "$APP_DIR/venv/bin/python" -c "
import crypt, os
salt = crypt.mksalt(crypt.METHOD_SHA256)
hashed = crypt.crypt('${PANEL_PASS}', salt)
print('${PANEL_USER}:' + hashed)
" > "$HTPASSWD_FILE" 2>/dev/null || true
        fi
    fi

    # Verify htpasswd file exists and is not empty
    if [ ! -s "$HTPASSWD_FILE" ]; then
        # Last resort fallback
        echo "${PANEL_USER}:$(openssl passwd -1 "$PANEL_PASS" 2>/dev/null || echo '{PLAIN}'$PANEL_PASS)" > "$HTPASSWD_FILE"
    fi

    chmod 640 "$HTPASSWD_FILE"
    chown root:www-data "$HTPASSWD_FILE" 2>/dev/null || chown root:nginx "$HTPASSWD_FILE" 2>/dev/null || true

    log "Basic Auth configured (user: ${PANEL_USER})"
}

# ───────── Nginx ─────────
configure_nginx() {
    log "Configuring Nginx..."

    # Stop nginx first to prevent conflicts
    systemctl stop nginx 2>/dev/null || true

    # Determine config path
    if [ -d "/etc/nginx/sites-available" ]; then
        CONF_FILE="$NGINX_CONF"
        USE_SITES=true
    else
        CONF_FILE="$NGINX_CONF_D"
        USE_SITES=false
    fi

    # Detect if http2 is supported (Nginx >= 1.25 uses http2 directive differently)
    NGINX_VER=$(nginx -v 2>&1 | grep -oP '[\d.]+' | head -1)
    HTTP2_PARAM="http2"
    # On very old Nginx, http2 in listen directive works. On newer, it's a separate directive.
    # Using "ssl" only is safest for compatibility:
    LISTEN_SSL="listen 443 ssl"
    LISTEN_SSL6="listen [::]:443 ssl"

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
    return 301 https://\$host\$request_uri;
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

    # Symlink if sites-available style
    if [ "$USE_SITES" = true ]; then
        ln -sf "$CONF_FILE" "$NGINX_LINK"
        rm -f /etc/nginx/sites-enabled/default
    fi

    # Test config
    if nginx -t 2>&1; then
        log "Nginx config is valid"
    else
        err "Nginx config test failed. Showing error:"
        nginx -t 2>&1
        die "Fix nginx config manually: $CONF_FILE"
    fi

    # Start nginx
    systemctl enable nginx 2>/dev/null || true
    systemctl start nginx 2>/dev/null || systemctl restart nginx 2>/dev/null || true

    # Verify nginx is running
    if systemctl is-active --quiet nginx; then
        log "Nginx is running"
    else
        err "Nginx failed to start. Checking error:"
        systemctl status nginx --no-pager -l 2>&1 | tail -10
        journalctl -u nginx --no-pager -n 20 2>&1 | tail -10
        die "Nginx failed to start"
    fi
}

# ───────── Systemd service ─────────
create_service() {
    log "Creating systemd service..."

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
    systemctl enable "$SERVICE_NAME" 2>/dev/null || true

    log "Systemd service created"
}

start_service() {
    log "Starting application service..."

    systemctl restart "$SERVICE_NAME" 2>/dev/null || true
    sleep 3

    # Check if running
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        log "Service is running"
    else
        err "Service failed to start. Checking logs:"
        journalctl -u "$SERVICE_NAME" --no-pager -n 20 2>&1 | tail -15
        warn "Will try to continue anyway..."
    fi

    # Wait for HTTP response
    log "Waiting for app to respond on port ${APP_PORT}..."
    local i=0
    while [ $i -lt 20 ]; do
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${APP_PORT}/" 2>/dev/null) || true
        if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "302" ]; then
            log "App responding: HTTP ${HTTP_CODE}"
            return 0
        fi
        i=$((i + 1))
        sleep 2
    done

    warn "App not responding after 40s. Check: journalctl -u ${SERVICE_NAME} -f"
}

# ───────── Firewall ─────────
configure_firewall() {
    log "Configuring firewall..."

    if command -v ufw >/dev/null 2>&1; then
        ufw allow 22/tcp 2>/dev/null || true
        ufw allow 80/tcp 2>/dev/null || true
        ufw allow 443/tcp 2>/dev/null || true
        if ufw status 2>/dev/null | grep -q "inactive"; then
            warn "UFW is inactive. Run 'ufw enable' if needed."
        else
            ufw reload 2>/dev/null || true
        fi
        log "UFW rules added"
    elif command -v firewall-cmd >/dev/null 2>&1; then
        firewall-cmd --permanent --add-service=http 2>/dev/null || true
        firewall-cmd --permanent --add-service=https 2>/dev/null || true
        firewall-cmd --permanent --add-service=ssh 2>/dev/null || true
        firewall-cmd --reload 2>/dev/null || true
        log "Firewalld rules added"
    else
        warn "No firewall detected. Make sure ports 80,443 are open."
    fi
}

# ───────── Permissions ─────────
set_permissions() {
    log "Setting permissions..."
    chown -R root:root "$APP_DIR"
    chmod -R 755 "$APP_DIR"
    chmod 600 "$APP_DIR/.env"
    chmod 777 "$APP_DIR/data" 2>/dev/null || true
}

# ───────── Uninstaller ─────────
create_uninstaller() {
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
# Step 8: Clean up logs, temp files, cron
# ═══════════════════════════════════════════
echo ""
echo -e "${CYAN}[8/8]${NC} ${BOLD}Cleaning up...${NC}"

if [ -f "$LOG_FILE" ]; then
    rm -f "$LOG_FILE"
    ok "Removed install log: ${LOG_FILE}"
else
    skip "Install log not found"
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

# ───────── Summary ─────────
print_summary() {
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                          ║${NC}"
    echo -e "${GREEN}║       ✅  Installation Complete!                         ║${NC}"
    echo -e "${GREEN}║                                                          ║${NC}"
    echo -e "${GREEN}╠══════════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║                                                          ║${NC}"
    echo -e "${GREEN}║${NC}  ${BOLD}URL${NC}      : ${CYAN}https://${HOSTNAME_INPUT}${NC}"
    echo -e "${GREEN}║${NC}  ${BOLD}Username${NC} : ${CYAN}${PANEL_USER}${NC}"
    echo -e "${GREEN}║${NC}  ${BOLD}Password${NC} : ${CYAN}${PANEL_PASS}${NC}"
    echo -e "${GREEN}║${NC}  ${BOLD}SSL${NC}      : ${CYAN}$([ "$USE_DOMAIN" = true ] && echo "Let's Encrypt (trusted)" || echo "Self-signed (encrypted)")${NC}"
    echo -e "${GREEN}║                                                          ║${NC}"
    echo -e "${GREEN}╠══════════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║${NC}  ${BOLD}Management Commands:${NC}"
    echo -e "${GREEN}║${NC}    Status  : ${CYAN}systemctl status ${SERVICE_NAME}${NC}"
    echo -e "${GREEN}║${NC}    Logs    : ${CYAN}journalctl -u ${SERVICE_NAME} -f${NC}"
    echo -e "${GREEN}║${NC}    Restart : ${CYAN}systemctl restart ${SERVICE_NAME}${NC}"
    echo -e "${GREEN}║${NC}    Remove  : ${CYAN}bash ${APP_DIR}/uninstall.sh${NC}"
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

    echo ""
    echo -e "${BOLD}-- Installing --${NC}"
    echo ""

    # Step 1: System packages
    install_packages

    # Step 2: Deploy app + Python deps
    deploy_app

    # Step 3: Configuration files
    create_env_file

    # Step 4: SSL (self-signed first, always works)
    setup_ssl

    # Step 5: htpasswd for Basic Auth
    setup_htpasswd

    # Step 6: Nginx config (uses SSL cert from step 4)
    configure_nginx

    # Step 7: Systemd service
    create_service

    # Step 8: Firewall
    configure_firewall

    # Step 9: Permissions
    set_permissions

    # Step 10: Start the app
    start_service

    # Step 11: Try Let's Encrypt (optional, after everything works)
    try_letsencrypt

    # Step 12: Create uninstaller
    create_uninstaller

    # Final restart to pick up any changes
    systemctl restart "$SERVICE_NAME" 2>/dev/null || true
    sleep 2

    print_summary
}

main "$@"
