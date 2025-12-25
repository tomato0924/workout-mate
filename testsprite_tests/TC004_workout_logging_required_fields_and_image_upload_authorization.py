import requests
import uuid
import io

BASE_URL = "http://localhost:3000"
AUTH = ("tomato0924@gmail.com", "111111")
HEADERS = {"Authorization": f"Basic tomato0924@gmail.com:111111"}

TIMEOUT = 30


def encode_basic_auth(username, password):
    import base64

    token = base64.b64encode(f"{username}:{password}".encode()).decode()
    return f"Basic {token}"


def test_workout_logging_required_fields_and_image_upload_authorization():
    # Prepare auth header with Basic token
    auth_header = {"Authorization": encode_basic_auth(AUTH[0], AUTH[1])}
    # 1) Test workout logging required fields per sport, enforce database level integrity
    # Attempt to log a swimming workout without 'swolf' field (required for swimming)
    workout_url = f"{BASE_URL}/api/workouts"

    # Payload without required 'swolf' field for swimming
    workout_payload_missing_required = {
        "sport": "swimming",
        "duration": 3600,  # 1 hour
        "distance": 2500,
        # 'swolf' field missing on purpose to test db integrity enforcement
    }

    resp = requests.post(workout_url, json=workout_payload_missing_required, headers=auth_header, timeout=TIMEOUT)
    # Expect failure due to DB constraint enforcing required fields
    assert resp.status_code == 400 or resp.status_code == 422, f"Expected 400 or 422 for missing required fields, got {resp.status_code}"
    assert "swolf" in resp.text.lower() or "required" in resp.text.lower(), "Error message should indicate missing required 'swolf' field"

    # 2) Correct workout logging with all required fields including 'swolf'
    workout_payload = {
        "sport": "swimming",
        "duration": 3600,
        "distance": 2500,
        "swolf": 45,
        "notes": "Morning swim session"
    }
    upload_image = True

    created_workout_id = None
    uploaded_file_path = None
    try:
        # Create workout record
        resp = requests.post(workout_url, json=workout_payload, headers=auth_header, timeout=TIMEOUT)
        assert resp.status_code == 201, f"Failed to create workout with all required fields, status: {resp.status_code}"
        workout_data = resp.json()
        created_workout_id = workout_data.get("id")
        assert created_workout_id, "Response missing workout ID"

        # 3) Test image upload authorization and path structure
        # Try to upload an image file tied to the workout under the user-secured path
        upload_url = f"{BASE_URL}/api/workouts/{created_workout_id}/upload-image"
        # Prepare an in-memory file
        image_content = io.BytesIO(b"fake-image-content")
        files = {"file": ("workout.jpg", image_content, "image/jpeg")}

        resp = requests.post(upload_url, files=files, headers=auth_header, timeout=TIMEOUT)
        assert resp.status_code == 201 or resp.status_code == 200, f"Image upload failed with status {resp.status_code}"
        upload_resp = resp.json()
        uploaded_file_path = upload_resp.get("path")
        assert uploaded_file_path, "Upload response missing file path"
        # Verify path structure includes user or workout id to ensure proper storage path
        assert str(created_workout_id) in uploaded_file_path or AUTH[0].split("@")[0] in uploaded_file_path, "Uploaded file path structure is incorrect"

        # 4) Attempt uploading image without authentication - should fail
        resp = requests.post(upload_url, files=files, timeout=TIMEOUT)
        assert resp.status_code == 401 or resp.status_code == 403, f"Unauthenticated image upload should fail; got {resp.status_code}"

    finally:
        # Cleanup: Delete created workout and uploaded file if applicable
        if created_workout_id:
            del_url = f"{BASE_URL}/api/workouts/{created_workout_id}"
            requests.delete(del_url, headers=auth_header, timeout=TIMEOUT)
        # There could be an API to delete uploaded file but assuming workout deletion cleans up storage


test_workout_logging_required_fields_and_image_upload_authorization()