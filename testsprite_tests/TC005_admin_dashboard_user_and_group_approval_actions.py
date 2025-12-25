import requests
from requests.auth import HTTPBasicAuth
import time

BASE_URL = "http://localhost:3000"
AUTH_USERNAME = "tomato0924@gmail.com"
AUTH_PASSWORD = "111111"
TIMEOUT = 30
HEADERS = {"Content-Type": "application/json"}

def test_admin_dashboard_user_and_group_approval_actions():
    auth = HTTPBasicAuth(AUTH_USERNAME, AUTH_PASSWORD)

    # Helper functions
    def create_pending_user(email):
        # Sign up a new user (not first user, so pending by default)
        payload = {
            "email": email,
            "password": "TestPass123!"
        }
        r = requests.post(f"{BASE_URL}/signup", json=payload, timeout=TIMEOUT)
        r.raise_for_status()
        return email

    def login(email, password):
        payload = {"email": email, "password": password}
        r = requests.post(f"{BASE_URL}/login", json=payload, timeout=TIMEOUT)
        if r.status_code != 200:
            return None
        try:
            return r.json().get("token")
        except Exception:
            return None

    def get_admin_headers(token):
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

    def get_pending_users(token):
        r = requests.get(f"{BASE_URL}/admin/users/pending", headers=get_admin_headers(token), timeout=TIMEOUT)
        r.raise_for_status()
        try:
            return r.json()
        except Exception:
            assert False, "Pending users endpoint did not return valid JSON"

    def get_pending_groups(token):
        r = requests.get(f"{BASE_URL}/admin/groups/pending", headers=get_admin_headers(token), timeout=TIMEOUT)
        r.raise_for_status()
        try:
            return r.json()
        except Exception:
            assert False, "Pending groups endpoint did not return valid JSON"

    def approve_user(token, user_id):
        r = requests.post(f"{BASE_URL}/admin/users/{user_id}/approve", headers=get_admin_headers(token), timeout=TIMEOUT)
        r.raise_for_status()
        return r.status_code == 200

    def reject_user(token, user_id):
        r = requests.post(f"{BASE_URL}/admin/users/{user_id}/reject", headers=get_admin_headers(token), timeout=TIMEOUT)
        r.raise_for_status()
        return r.status_code == 200

    def approve_group(token, group_id):
        r = requests.post(f"{BASE_URL}/admin/groups/{group_id}/approve", headers=get_admin_headers(token), timeout=TIMEOUT)
        r.raise_for_status()
        return r.status_code == 200

    def reject_group(token, group_id):
        r = requests.post(f"{BASE_URL}/admin/groups/{group_id}/reject", headers=get_admin_headers(token), timeout=TIMEOUT)
        r.raise_for_status()
        return r.status_code == 200

    def get_user_roles(token, user_id):
        r = requests.get(f"{BASE_URL}/users/{user_id}/roles", headers=get_admin_headers(token), timeout=TIMEOUT)
        r.raise_for_status()
        try:
            data = r.json()
            assert isinstance(data, dict), "User roles response is not a dict"
            return data
        except Exception:
            assert False, "User roles endpoint did not return valid JSON"

    # Step 1: Authenticate as admin user (tomato0924@gmail.com - known admin)
    r = requests.post(f"{BASE_URL}/login", json={"email": AUTH_USERNAME, "password": AUTH_PASSWORD}, timeout=TIMEOUT)
    r.raise_for_status()
    try:
        admin_token = r.json().get("token")
    except Exception:
        assert False, "Admin login response not valid JSON"
    assert admin_token, "Admin login failed - token missing"

    # Step 2: Create a pending user (simulate workflow for non-first user signup)
    test_email_user = "pendinguser_test@local.test"

    def delete_user_by_email(email):
        try:
            r_users = requests.get(f"{BASE_URL}/admin/users", headers=get_admin_headers(admin_token), timeout=TIMEOUT)
            r_users.raise_for_status()
            try:
                users = r_users.json()
            except Exception:
                return
            target_user = next((u for u in users if u.get('email') == email), None)
            if target_user:
                requests.delete(f"{BASE_URL}/admin/users/{target_user.get('id')}", headers=get_admin_headers(admin_token), timeout=TIMEOUT)
        except Exception:
            pass

    try:
        delete_user_by_email(test_email_user)
        create_pending_user(test_email_user)

        # Step 3: Retrieve pending users, verify test user is listed
        pending_users = get_pending_users(admin_token)
        user_info = next((u for u in pending_users if u.get('email') == test_email_user), None)
        assert user_info, "Created pending user not found in pending users list"
        user_id = user_info.get('id')
        assert user_id, "Pending user missing id"

        # Step 4: Reject user first, verify status updated immediately and user role does not have access
        assert reject_user(admin_token, user_id), "User rejection failed"

        roles_after_reject = get_user_roles(admin_token, user_id)
        # After rejection, status should be 'rejected' not 'pending'
        assert roles_after_reject.get("status") == "rejected", "User status not rejected after rejection"

        # Check RLS prevents dashboard access by trying to access dashboard as that user
        token_pending_user = login(test_email_user, "TestPass123!")
        assert token_pending_user, "Pending (rejected) user failed to login"

        r_dash = requests.get(f"{BASE_URL}/dashboard/data", headers={"Authorization": f"Bearer {token_pending_user}"}, timeout=TIMEOUT)
        assert r_dash.status_code in (403, 401), "Rejected user should be blocked from dashboard data by RLS"

        # Step 5: Delete rejected user to recreate pending user again for approval test
        delete_user_by_email(test_email_user)
        create_pending_user(test_email_user)
        pending_users = get_pending_users(admin_token)
        user_info = next((u for u in pending_users if u.get('email') == test_email_user), None)
        assert user_info, "Recreated pending user not found"
        user_id = user_info.get('id')
        assert user_id, "Pending user missing id after recreation"

        # Step 6: Approve user and verify role updated to approved/admin immediately
        assert approve_user(admin_token, user_id), "User approval failed"

        roles_after_approve = get_user_roles(admin_token, user_id)
        assert roles_after_approve.get("status") == "approved", "User not approved after approval action"

        # Verify user can now access dashboard
        token_approved_user = login(test_email_user, "TestPass123!")
        assert token_approved_user, "Approved user failed to login"

        r_dash = requests.get(f"{BASE_URL}/dashboard/data", headers={"Authorization": f"Bearer {token_approved_user}"}, timeout=TIMEOUT)
        assert r_dash.status_code == 200, "Approved user should have access to dashboard data"

        # Step 7: Create a pending group
        group_payload = {"name": "Test Group Approval", "invite_code": "UNIQUECODE123"}
        r_group_create = requests.post(f"{BASE_URL}/groups", headers=get_admin_headers(admin_token), json=group_payload, timeout=TIMEOUT)
        r_group_create.raise_for_status()
        try:
            group_id = r_group_create.json().get("id")
        except Exception:
            assert False, "Group creation response not valid JSON"
        assert group_id, "Group creation failed"

        # Step 8: Get pending groups and verify newly created group is listed
        pending_groups = get_pending_groups(admin_token)
        group_info = next((g for g in pending_groups if g.get('id') == group_id), None)
        assert group_info, "Created pending group not found in pending groups list"

        # Step 9: Approve the group and verify status updates immediately
        assert approve_group(admin_token, group_id), "Group approval failed"
        pending_groups_after = get_pending_groups(admin_token)
        still_pending = any(g.get('id') == group_id for g in pending_groups_after)
        assert not still_pending, "Group still appears in pending after approval"

        # Step 10: Reject test cleanup - delete user and group
    finally:
        # Cleanup: Delete test user if exists
        delete_user_by_email(test_email_user)

        try:
            # Delete the test group created
            if 'group_id' in locals():
                requests.delete(f"{BASE_URL}/groups/{group_id}", headers=get_admin_headers(admin_token), timeout=TIMEOUT)
        except Exception:
            pass

test_admin_dashboard_user_and_group_approval_actions()
