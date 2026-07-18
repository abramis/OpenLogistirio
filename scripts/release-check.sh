#!/usr/bin/env bash
set -euo pipefail

command_timeout=${RELEASE_COMMAND_TIMEOUT_SECONDS:-300}
web_test_timeout=${RELEASE_WEB_TEST_TIMEOUT_SECONDS:-180}

run_timed() {
  local seconds=$1
  shift
  echo "+ timeout ${seconds}s $*"
  timeout --signal=TERM --kill-after=15s "${seconds}s" "$@"
}

if ! command -v timeout >/dev/null 2>&1; then
  echo "The release check requires GNU timeout so no test can hang indefinitely." >&2
  exit 1
fi

if [[ ${NODE_ENV:-} == production && ${AADE_MYDATA_PRODUCTION_ENABLED:-false} == true ]]; then
  echo "Refusing release verification while AADE production writes are enabled." >&2
  exit 1
fi

run_timed "$command_timeout" npm run lint --workspace=@open-logistirio/api
run_timed "$command_timeout" npm run lint --workspace=@open-logistirio/web
run_timed "$command_timeout" ./scripts/api-test-check.sh

if [[ -z ${CHROME_BIN:-} ]]; then
  # Calling the Snap wrapper directly can leave Karma waiting after all tests pass.
  # Prefer Chromium's real executable when this host uses the Snap package.
  for chrome in \
    /snap/chromium/current/usr/lib/chromium-browser/chrome \
    /usr/bin/chromium \
    /usr/bin/google-chrome \
    /snap/bin/chromium; do
    if [[ -x $chrome ]]; then
      export CHROME_BIN=$chrome
      break
    fi
  done
fi

run_timed "$web_test_timeout" npm test --workspace=@open-logistirio/web
run_timed "$command_timeout" npm run build --workspace=@open-logistirio/api
run_timed "$command_timeout" npm run build --workspace=@open-logistirio/web
run_timed "$command_timeout" npm audit --omit=dev --audit-level=high

if grep -R -F -q 'http://localhost:3000/api' apps/web/dist/web/browser; then
  echo "Production web bundle contains the development API URL." >&2
  exit 1
fi

echo "Release checks passed. No tag, push, image publish, or AADE write was performed."
