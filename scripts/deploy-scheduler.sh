#!/usr/bin/env bash
# Deploy or update the two Cloud Scheduler jobs for the Heard agent.
#
# Prerequisites (must exist before running):
#   - Cloud Run Job `heard-agent` deployed and smoke-tested (Part 5 of DEPLOYMENT.md)
#   - Service account `heard-scheduler@heard-apol-ai.iam.gserviceaccount.com` with roles/run.jobsExecutor
#   - Cloud Scheduler API enabled (cloudscheduler.googleapis.com)
#
# Usage:
#   bash scripts/deploy-scheduler.sh           # create (or update if already exists)
#   bash scripts/deploy-scheduler.sh --pause   # pause both jobs (pre-demo safety)
#   bash scripts/deploy-scheduler.sh --resume  # resume both jobs
#   bash scripts/deploy-scheduler.sh --run     # manually fire the sweep job now

set -euo pipefail

PROJECT=heard-apol-ai
REGION=us-central1
JOB_NAME=heard-agent
SA=heard-scheduler@heard-apol-ai.iam.gserviceaccount.com
RUN_URI="https://run.googleapis.com/v2/projects/${PROJECT}/locations/${REGION}/jobs/${JOB_NAME}:run"

SWEEP_JOB=heard-agent-sweep-2h
RECOVERY_JOB=heard-agent-nightly-recovery

SWEEP_BODY='{"overrides":{"containerOverrides":[{"env":[{"name":"MODE","value":"sweep"}]}]}}'
RECOVERY_BODY='{"overrides":{"containerOverrides":[{"env":[{"name":"MODE","value":"sweep"}]}]}}'

# ── helpers ────────────────────────────────────────────────────────────────────

scheduler_job_exists() {
  gcloud scheduler jobs describe "$1" \
    --location "${REGION}" \
    --project "${PROJECT}" \
    --quiet >/dev/null 2>&1
}

create_or_update() {
  local name="$1" schedule="$2" body="$3"

  if scheduler_job_exists "${name}"; then
    echo "[update] ${name}"
    gcloud scheduler jobs update http "${name}" \
      --location "${REGION}" \
      --schedule "${schedule}" \
      --time-zone "America/Chicago" \
      --uri "${RUN_URI}" \
      --http-method POST \
      --oauth-service-account-email "${SA}" \
      --headers "Content-Type=application/json" \
      --message-body "${body}" \
      --project "${PROJECT}"
  else
    echo "[create] ${name}"
    gcloud scheduler jobs create http "${name}" \
      --location "${REGION}" \
      --schedule "${schedule}" \
      --time-zone "America/Chicago" \
      --uri "${RUN_URI}" \
      --http-method POST \
      --oauth-service-account-email "${SA}" \
      --headers "Content-Type=application/json" \
      --message-body "${body}" \
      --project "${PROJECT}"
  fi
}

# ── dispatch ───────────────────────────────────────────────────────────────────

case "${1:-deploy}" in

  deploy)
    # Every 2 hours — main sweep
    create_or_update "${SWEEP_JOB}" "0 */2 * * *" "${SWEEP_BODY}"

    # Nightly 2 AM CT — recovery sweep for anything that stalled
    create_or_update "${RECOVERY_JOB}" "0 2 * * *" "${RECOVERY_BODY}"

    echo ""
    echo "Verifying jobs are in the expected state..."
    gcloud scheduler jobs list \
      --location "${REGION}" \
      --project "${PROJECT}" \
      --filter "name~heard-agent"

    echo ""
    echo "Trigger a manual sweep to confirm the job fires:"
    echo "  bash scripts/deploy-scheduler.sh --run"
    ;;

  --pause)
    echo "[pause] ${SWEEP_JOB}"
    gcloud scheduler jobs pause "${SWEEP_JOB}" \
      --location "${REGION}" --project "${PROJECT}"

    echo "[pause] ${RECOVERY_JOB}"
    gcloud scheduler jobs pause "${RECOVERY_JOB}" \
      --location "${REGION}" --project "${PROJECT}"

    echo "Both scheduler jobs paused."
    ;;

  --resume)
    echo "[resume] ${SWEEP_JOB}"
    gcloud scheduler jobs resume "${SWEEP_JOB}" \
      --location "${REGION}" --project "${PROJECT}"

    echo "[resume] ${RECOVERY_JOB}"
    gcloud scheduler jobs resume "${RECOVERY_JOB}" \
      --location "${REGION}" --project "${PROJECT}"

    echo "Both scheduler jobs resumed."
    ;;

  --run)
    echo "[manual trigger] ${SWEEP_JOB}"
    gcloud scheduler jobs run "${SWEEP_JOB}" \
      --location "${REGION}" --project "${PROJECT}"

    echo "Job triggered. Watch Cloud Run executions:"
    echo "  gcloud run jobs executions list --job ${JOB_NAME} --region ${REGION} --project ${PROJECT}"
    ;;

  *)
    echo "Usage: $0 [deploy|--pause|--resume|--run]" >&2
    exit 1
    ;;
esac
