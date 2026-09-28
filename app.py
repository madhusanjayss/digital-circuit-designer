from flask import Flask, render_template, request, jsonify, send_from_directory
import os
import sqlite3
import secrets
import time
from datetime import datetime, timezone

try:
    from flask_cors import CORS
    HAS_CORS = True
except ImportError:
    HAS_CORS = False

app = Flask(
    __name__,
    static_folder="static",
    template_folder="templates"
)

if HAS_CORS:
    CORS(app, resources={r"/api/*": {"origins": "*"}})
else:
    @app.after_request
    def add_cors_headers(response):
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
        response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
        return response

DB_PATH = os.environ.get("DATABASE_PATH", os.path.join(os.path.dirname(os.path.abspath(__file__)), "traffic.db"))
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Sandeep@23")

ACTIVE_SESSIONS = {}
SESSION_DURATION_SECONDS = 3600 * 24  # 24 hours


def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS page_views (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ip_address TEXT NOT NULL,
            path TEXT,
            referrer TEXT,
            user_agent TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS login_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ip_address TEXT NOT NULL,
            status TEXT NOT NULL,
            user_agent TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()


init_db()


def get_client_ip():
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    return request.remote_addr or "127.0.0.1"


def verify_token(token):
    if not token:
        return False
    expiry = ACTIVE_SESSIONS.get(token)
    if not expiry or time.time() > expiry:
        if token in ACTIVE_SESSIONS:
            del ACTIVE_SESSIONS[token]
        return False
    return True


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/admin")
@app.route("/admin/")
def admin_page():
    admin_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "admin")
    return send_from_directory(admin_dir, "index.html")


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()})


@app.route("/api/track", methods=["POST", "OPTIONS"])
def track_visit():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"})

    data = request.get_json(silent=True) or {}
    client_ip = get_client_ip()
    path = data.get("path", "/")
    referrer = data.get("referrer", "")
    user_agent = data.get("user_agent", request.headers.get("User-Agent", ""))

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO page_views (ip_address, path, referrer, user_agent) VALUES (?, ?, ?, ?)",
            (client_ip, path, referrer, user_agent)
        )
        conn.commit()
        conn.close()
        return jsonify({"status": "ok", "logged_ip": client_ip})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/login", methods=["POST", "OPTIONS"])
def admin_login():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"})

    data = request.get_json(silent=True) or {}
    password = data.get("password", "")
    client_ip = get_client_ip()
    user_agent = data.get("user_agent", request.headers.get("User-Agent", ""))

    is_valid = (password == ADMIN_PASSWORD)
    status_label = "SUCCESS" if is_valid else "FAILED"

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO login_logs (ip_address, status, user_agent) VALUES (?, ?, ?)",
            (client_ip, status_label, user_agent)
        )
        conn.commit()
        conn.close()
    except Exception:
        pass

    if is_valid:
        token = secrets.token_hex(24)
        ACTIVE_SESSIONS[token] = time.time() + SESSION_DURATION_SECONDS
        return jsonify({
            "status": "ok",
            "token": token,
            "message": "Authentication successful",
            "ip": client_ip
        })
    else:
        return jsonify({
            "status": "error",
            "message": "Invalid password"
        }), 401


@app.route("/api/admin/stats", methods=["GET", "OPTIONS"])
def admin_stats():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"})

    auth_header = request.headers.get("Authorization", "")
    token = ""
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()

    if not verify_token(token):
        return jsonify({"status": "error", "message": "Unauthorized"}), 401

    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Total logins
        cursor.execute("SELECT COUNT(*) AS total, SUM(CASE WHEN status='SUCCESS' THEN 1 ELSE 0 END) AS success, SUM(CASE WHEN status='FAILED' THEN 1 ELSE 0 END) AS failed FROM login_logs")
        row = cursor.fetchone()
        login_counts = {
            "total": row["total"] if row and row["total"] else 0,
            "success": row["success"] if row and row["success"] else 0,
            "failed": row["failed"] if row and row["failed"] else 0
        }

        # Total page views
        cursor.execute("SELECT COUNT(*) AS total FROM page_views")
        pv_row = cursor.fetchone()
        total_pageviews = pv_row["total"] if pv_row and pv_row["total"] else 0

        # Unique IPs
        cursor.execute("""
            SELECT COUNT(DISTINCT ip) AS unique_ips FROM (
                SELECT ip_address AS ip FROM page_views
                UNION
                SELECT ip_address AS ip FROM login_logs
            )
        """)
        uip_row = cursor.fetchone()
        unique_ips = uip_row["unique_ips"] if uip_row and uip_row["unique_ips"] else 0

        # IP Breakdown with visit counts
        cursor.execute("""
            SELECT ip_address, COUNT(*) as hits, MAX(timestamp) as last_seen
            FROM page_views
            GROUP BY ip_address
            ORDER BY hits DESC
            LIMIT 50
        """)
        ip_summary = [dict(r) for r in cursor.fetchall()]

        # Recent 100 page views
        cursor.execute("SELECT id, ip_address, path, referrer, user_agent, timestamp FROM page_views ORDER BY id DESC LIMIT 100")
        recent_traffic = [dict(r) for r in cursor.fetchall()]

        # Recent 100 login attempts
        cursor.execute("SELECT id, ip_address, status, user_agent, timestamp FROM login_logs ORDER BY id DESC LIMIT 100")
        recent_logins = [dict(r) for r in cursor.fetchall()]

        conn.close()

        return jsonify({
            "status": "ok",
            "stats": {
                "total_logins": login_counts.get("total", 0),
                "successful_logins": login_counts.get("success", 0),
                "failed_logins": login_counts.get("failed", 0),
                "total_pageviews": total_pageviews,
                "unique_ips": unique_ips
            },
            "ip_summary": ip_summary,
            "recent_traffic": recent_traffic,
            "recent_logins": recent_logins
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"Starting Digital Logic Circuit Designer on port {port}")
    app.run(
        host="0.0.0.0",
        port=port,
        debug=False
    )
