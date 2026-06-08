"""Cloud Run Job entry point.

Usage:
  python main.py --mode sweep              # process all pending reviews
  python main.py --mode single --review_id <uuid>
"""

import argparse
import asyncio
import os
import sys


def _validate_env() -> None:
    required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
    missing = [k for k in required if not os.environ.get(k)]
    if missing:
        print(f"[fatal] missing env vars: {', '.join(missing)}", file=sys.stderr)
        sys.exit(1)


def _setup_cloud_trace():
    """Configure OpenTelemetry to export ADK spans to GCP Cloud Trace.

    No-ops silently when the exporter package is absent (local dev without
    the extra dep) or when GOOGLE_CLOUD_PROJECT is not set.  Cloud Run Jobs
    are short-lived, so the caller must call provider.shutdown() after the
    job finishes to flush BatchSpanProcessor before the process exits.
    """
    project = os.environ.get("GOOGLE_CLOUD_PROJECT")
    if not project:
        return None
    try:
        from opentelemetry import trace as otel_trace
        from opentelemetry.exporter.cloud_trace import CloudTraceSpanExporter
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor

        provider = TracerProvider()
        provider.add_span_processor(
            BatchSpanProcessor(CloudTraceSpanExporter(project_id=project))
        )
        otel_trace.set_tracer_provider(provider)
        return provider
    except ImportError:
        print(
            "[warn] opentelemetry-exporter-gcp-trace not installed; Cloud Trace disabled",
            file=sys.stderr,
        )
    except Exception as exc:
        print(f"[warn] Cloud Trace setup failed: {exc}", file=sys.stderr)
    return None


async def _run(mode: str, review_id: str | None) -> None:
    # Import here so env validation runs first and import errors surface cleanly
    from orchestrator import Orchestrator

    orch = Orchestrator()

    if mode == "sweep":
        await orch.sweep()
    elif mode == "single":
        if not review_id:
            print("[fatal] --review_id required for single mode", file=sys.stderr)
            sys.exit(1)
        await orch.process_review(review_id)
    else:
        print(f"[fatal] unknown mode: {mode}", file=sys.stderr)
        sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(description="Heard review agent")
    parser.add_argument("--mode", choices=["sweep", "single"], default=None)
    parser.add_argument("--review_id", default=None)
    args = parser.parse_args()

    mode = args.mode or os.environ.get("MODE", "sweep")
    review_id = args.review_id or os.environ.get("REVIEW_ID")

    _validate_env()
    trace_provider = _setup_cloud_trace()
    try:
        asyncio.run(_run(mode, review_id))
    finally:
        if trace_provider is not None:
            trace_provider.shutdown()


if __name__ == "__main__":
    main()
