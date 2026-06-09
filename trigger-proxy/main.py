import os
import google.auth
import google.auth.transport.requests
import requests as http_requests
from flask import Flask, request, jsonify

app = Flask(__name__)
SECRET = os.environ.get('INTERNAL_AGENT_TRIGGER_SECRET', '')


@app.route('/trigger', methods=['POST'])
def trigger():
    auth_header = request.headers.get('Authorization', '')
    if not SECRET or not auth_header.startswith('Bearer ') or auth_header[7:] != SECRET:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json(silent=True) or {}
    mode = data.get('mode', 'sweep')
    store_id = data.get('store_id', '')
    review_id = data.get('review_id', '')

    creds, project = google.auth.default(scopes=['https://www.googleapis.com/auth/cloud-platform'])
    creds.refresh(google.auth.transport.requests.Request())

    job_name = os.environ['CLOUD_RUN_JOB_NAME']
    region = os.environ.get('CLOUD_RUN_JOB_REGION', 'us-central1')
    url = f'https://run.googleapis.com/v2/projects/{project}/locations/{region}/jobs/{job_name}:run'

    env_vars = [
        {'name': 'MODE', 'value': mode},
        {'name': 'STORE_ID', 'value': store_id},
    ]
    if review_id:
        env_vars.append({'name': 'REVIEW_ID', 'value': review_id})

    resp = http_requests.post(
        url,
        headers={'Authorization': f'Bearer {creds.token}', 'Content-Type': 'application/json'},
        json={'overrides': {'containerOverrides': [{'env': env_vars}]}},
        timeout=15,
    )

    if not resp.ok:
        return jsonify({'error': resp.text}), 502

    return jsonify({'ok': True})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 8080)))
