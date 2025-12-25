import requests
import uuid
import time

BASE_URL = "http://localhost:3000"
TIMEOUT = 30

AUTH_USERNAME = "tomato0924@gmail.com"
AUTH_PASSWORD = "111111"
AUTH_HEADER = {
    "Authorization": f"Basic {requests.auth._basic_auth_str(AUTH_USERNAME, AUTH_PASSWORD)}",
    "Content-Type": "application/json"
}


def create_user(email, password):
    url = f"{BASE_URL}/signup"
    payload = {
        "email": email,
        "password": password,
        "name": "Test User",
        "nickname": "TestNick",
        "phone": "010-1234-5678"
    }
    resp = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=TIMEOUT)
    resp.raise_for_status()
    try:
        return resp.json()
    except Exception:
        assert False, f"Signup response is not valid JSON: {resp.text}"


def delete_user(user_id, token):
    url = f"{BASE_URL}/users/{user_id}"
    headers = {
        "Authorization": f"Bearer {token}"
    }
    try:
        resp = requests.delete(url, headers=headers, timeout=TIMEOUT)
        resp.raise_for_status()
    except Exception:
        pass  # best effort cleanup


def login_user(email, password):
    url = f"{BASE_URL}/login"
    payload = {
        "email": email,
        "password": password
    }
    resp = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=TIMEOUT)
    return resp


def access_dashboard(auth_token):
    url = f"{BASE_URL}/dashboard/data"
    headers = {
        "Authorization": f"Bearer {auth_token}"
    }
    resp = requests.get(url, headers=headers, timeout=TIMEOUT)
    return resp


def get_user_status(auth_token):
    url = f"{BASE_URL}/users/me"
    headers = {
        "Authorization": f"Bearer {auth_token}"
    }
    resp = requests.get(url, headers=headers, timeout=TIMEOUT)
    resp.raise_for_status()
    return resp.json().get("status")


def test_user_login_access_restriction_for_pending_users():
    # We need a pending user to test that RLS blocks access accordingly.
    # Sign up a new user who will be pending (not first user)
    unique_email = f"pending_{uuid.uuid4()}@example.com"
    password = "TestPass123!"

    # Create user
    signup_resp = create_user(unique_email, password)
    assert "id" in signup_resp, "Signup failed to return user id"
    user_id = signup_resp["id"]

    # Login user
    login_resp = login_user(unique_email, password)
    assert login_resp.status_code == 200, f"Login failed with status {login_resp.status_code}"
    login_json = login_resp.json()
    assert "token" in login_json, "Login response missing auth token"
    auth_token = login_json["token"]

    try:
        # Confirm user status is 'pending' (not auto-approved)
        status = get_user_status(auth_token)
        assert status == "pending", f"User status expected to be 'pending' but was '{status}'"

        # Try to access dashboard data which is restricted to approved users by RLS
        dashboard_resp = access_dashboard(auth_token)

        # Expect forbidden or unauthorized due to RLS policies
        assert dashboard_resp.status_code in (401, 403), (
            f"Pending user should be blocked, but got status {dashboard_resp.status_code}"
        )

        # The response body may contain error message saying access denied
        try:
            body = dashboard_resp.json()
        except Exception:
            assert False, f"Dashboard response is not valid JSON: {dashboard_resp.text}"

        assert ("error" in body and "access denied" in body.get("error", "").lower()) or \
               ("message" in body and "access denied" in body.get("message", "").lower()), \
            "Expected access denied error for pending user"

    finally:
        # Cleanup - delete the created pending user if possible
        try:
            # For cleanup, we need an admin token or use super_admin credentials to delete user.
            # Logging in as provided admin user tomato0924@gmail.com for cleanup
            admin_login_resp = login_user(AUTH_USERNAME, AUTH_PASSWORD)
            admin_login_resp.raise_for_status()
            admin_token = admin_login_resp.json().get("token")
            if admin_token:
                delete_user(user_id, admin_token)
        except Exception:
            pass


test_user_login_access_restriction_for_pending_users()
