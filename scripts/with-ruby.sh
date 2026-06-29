#!/usr/bin/env bash
# Use Ruby 3.1+ for CocoaPods (activesupport 7.2+). macOS system Ruby 2.6 is too old.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

ruby_ok() {
  ruby -e 'Gem::Version.new(RUBY_VERSION) >= Gem::Version.new("3.1.0")' 2>/dev/null
}

ensure_ruby() {
  if ruby_ok; then
    return 0
  fi

  for prefix in \
    "/opt/homebrew/opt/ruby/bin" \
    "/opt/homebrew/opt/ruby@3.4/bin" \
    "/usr/local/opt/ruby/bin" \
    "/usr/local/opt/ruby@3.4/bin"; do
    if [[ -x "$prefix/ruby" ]] && "$prefix/ruby" -e 'Gem::Version.new(RUBY_VERSION) >= Gem::Version.new("3.1.0")' 2>/dev/null; then
      export PATH="$prefix:$PATH"
      return 0
    fi
  done

  if [[ -d "$HOME/.rbenv/shims" ]]; then
    export PATH="$HOME/.rbenv/shims:$PATH"
    if ruby_ok; then
      return 0
    fi
  fi

  echo "error: Ruby 3.1+ required for iOS CocoaPods (see .ruby-version)." >&2
  echo "Install: brew install ruby@3.4 && npm run setup:ios-ruby" >&2
  exit 1
}

ensure_ruby
cd "$ROOT"
exec "$@"
