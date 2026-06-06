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
    asyncio.run(_run(mode, review_id))


if __name__ == "__main__":
    main()
