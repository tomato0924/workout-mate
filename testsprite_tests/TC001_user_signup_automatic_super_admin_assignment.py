import requests
import time

BASE_URL = "http://localhost:3000"
TIMEOUT = 30
AUTH_CREDENTIALS = ("tomato0924@gmail.com", "111111")

def test_user_signup_automatic_super_admin_assignment():
    signup_url = f"{BASE_URL}/api/signup"
    headers = {"Content-Type": "application/json"}
    # Use a unique email to avoid conflicts in reruns
    unique_email = f"firstuser_{int(time.time())}@example.com"
    payload = {
        "email": unique_email,
        "password": "SecurePassword123!",
        "full_name": "First User"
    }

    # Attempt user signup
    try:
        response = requests.post(signup_url, json=payload, headers=headers, timeout=TIMEOUT)
        response.raise_for_status()

        # Login as the newly signed up user to get a token/session
        login_url = f"{BASE_URL}/api/login"
        login_payload = {"email": unique_email, "password": "SecurePassword123!"}
        login_resp = requests.post(login_url, json=login_payload, headers=headers, timeout=TIMEOUT)
        login_resp.raise_for_status()
        login_json = login_resp.json()
        token = login_json.get("token")
        assert token, "Login token not received"

        auth_headers = {"Authorization": f"Bearer {token}"}

        # Check user's role and approval status by calling a protected user info endpoint
        userinfo_url = f"{BASE_URL}/api/user/me"
        userinfo_resp = requests.get(userinfo_url, headers=auth_headers, timeout=TIMEOUT)
        userinfo_resp.raise_for_status()
        userinfo = userinfo_resp.json()
        role = userinfo.get("role")
        approval_status = userinfo.get("approval_status")

        assert approval_status == "approved", "First user is not automatically approved"
        assert role == "super_admin", "First user is not assigned super admin role"

        # Verify that RLS policies prevent 'pending' users from accessing dashboard data
        # Create a pending user to test this
        pending_email = f"pendinguser_{int(time.time())}@example.com"
        pending_payload = {
            "email": pending_email,
            "password": "PendingPass123!",
            "full_name": "Pending User"
        }
        pending_signup_resp = requests.post(signup_url, json=pending_payload, headers=headers, timeout=TIMEOUT)
        pending_signup_resp.raise_for_status()
        # Login pending user
        pending_login_payload = {"email": pending_email, "password": "PendingPass123!"}
        pending_login_resp = requests.post(login_url, json=pending_login_payload, headers=headers, timeout=TIMEOUT)
        pending_login_resp.raise_for_status()
        pending_token = pending_login_resp.json().get("token")
        assert pending_token, "Pending user login token not received"

        pending_auth_headers = {"Authorization": f"Bearer {pending_token}"}

        # Try to access dashboard data with pending user - expect forbidden or empty data per RLS
        dashboard_url = f"{BASE_URL}/api/dashboard/data"
        dash_resp = requests.get(dashboard_url, headers=pending_auth_headers, timeout=TIMEOUT)
        # Depending on implementation 403 or empty data expected
        if dash_resp.status_code == 403:
            # Forbidden as expected due to RLS
            pass
        else:
            dash_resp.raise_for_status()
            dash_data = dash_resp.json()
            # Expect no accessible data for pending user
            assert not dash_data.get("groups"), "Pending user should not access groups data"
            assert not dash_data.get("workouts"), "Pending user should not access workouts data"

    finally:
        # Cleanup: delete the first user and pending user
        # Requires admin token to delete users (assumes API supports it)
        # Login as initial admin (provided credentials) to delete created users
        admin_login_url = f"{BASE_URL}/api/auth/login"
        admin_login_resp = requests.post(admin_login_url, json={"email": AUTH_CREDENTIALS[0], "password": AUTH_CREDENTIALS[1]}, headers=headers, timeout=TIMEOUT)
        admin_login_resp.raise_for_status()
        admin_token = admin_login_resp.json().get("token")
        if admin_token:
            admin_headers = {"Authorization": f"Bearer {admin_token}"}
            for email_to_delete in [unique_email, pending_email]:
                # Search user id by email
                search_url = f"{BASE_URL}/api/admin/users?email={email_to_delete}"
                try:
                    search_resp = requests.get(search_url, headers=admin_headers, timeout=TIMEOUT)
                    search_resp.raise_for_status()
                    users_found = search_resp.json()
                    if isinstance(users_found, list) and users_found:
                        uid = users_found[0].get("id")
                        if uid:
                            del_url = f"{BASE_URL}/api/admin/users/{uid}"
                            del_resp = requests.delete(del_url, headers=admin_headers, timeout=TIMEOUT)
                            if del_resp.status_code not in (200, 204):
                                print(f"Warning: failed to delete user {email_to_delete}")
                except Exception:
                    # Log but continue
                    print(f"Exception during cleanup user {email_to_delete}")

test_user_signup_automatic_super_admin_assignment()
