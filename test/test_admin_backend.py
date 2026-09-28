import unittest
import json
import os
import sys

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import app, init_db, DB_PATH

class TestAdminBackend(unittest.TestCase):
    def setUp(self):
        app.config["TESTING"] = True
        self.client = app.test_client()
        init_db()

    def test_health(self):
        res = self.client.get("/api/health")
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertEqual(data.get("status"), "ok")

    def test_track_visit(self):
        res = self.client.post("/api/track", json={
            "path": "/",
            "referrer": "https://google.com",
            "user_agent": "TestBrowser/1.0"
        })
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertEqual(data.get("status"), "ok")
        self.assertTrue("logged_ip" in data)

    def test_login_invalid_password(self):
        res = self.client.post("/api/login", json={
            "password": "WrongPassword123"
        })
        self.assertEqual(res.status_code, 401)
        data = json.loads(res.data)
        self.assertEqual(data.get("status"), "error")

    def test_login_valid_password(self):
        res = self.client.post("/api/login", json={
            "password": "Sandeep@23"
        })
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertEqual(data.get("status"), "ok")
        self.assertTrue("token" in data)
        self.assertTrue(len(data["token"]) > 10)

    def test_admin_stats_unauthorized(self):
        res = self.client.get("/api/admin/stats")
        self.assertEqual(res.status_code, 401)

    def test_admin_stats_authorized(self):
        # 1. Login to get token
        login_res = self.client.post("/api/login", json={
            "password": "Sandeep@23"
        })
        token = json.loads(login_res.data)["token"]

        # 2. Track a visit
        self.client.post("/api/track", json={
            "path": "/canvas",
            "referrer": "direct",
            "user_agent": "TestRunner"
        })

        # 3. Fetch stats
        res = self.client.get("/api/admin/stats", headers={
            "Authorization": f"Bearer {token}"
        })
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertEqual(data.get("status"), "ok")
        self.assertIn("stats", data)
        self.assertIn("ip_summary", data)
        self.assertIn("recent_traffic", data)
        self.assertIn("recent_logins", data)
        self.assertGreaterEqual(data["stats"]["total_logins"], 1)
        self.assertGreaterEqual(data["stats"]["total_pageviews"], 1)

if __name__ == "__main__":
    unittest.main()
