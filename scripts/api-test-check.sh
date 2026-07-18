#!/usr/bin/env bash
set -euo pipefail

result_file=$(mktemp)
trap 'rm -f "$result_file"' EXIT

set +e
npm test --workspace=@open-logistirio/api -- --runInBand --json --outputFile="$result_file"
status=$?
set -e

if [[ $status -ne 0 && ${GITHUB_ACTIONS:-false} == true && -s $result_file ]]; then
  summary=$(node -e '
    const result = require(process.argv[1]);
    const failures = result.testResults
      .filter((suite) => suite.status === "failed")
      .flatMap((suite) => suite.assertionResults
        .filter((test) => test.status === "failed")
        .map((test) => `${suite.name}: ${test.fullName}\n${test.failureMessages.join("\n")}`));
    process.stdout.write(failures.join("\n\n").slice(0, 12000));
  ' "$result_file")
  summary=${summary//'%'/'%25'}
  summary=${summary//$'\r'/'%0D'}
  summary=${summary//$'\n'/'%0A'}
  echo "::error title=API tests failed::$summary"
fi

exit "$status"
