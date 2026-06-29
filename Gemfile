source 'https://rubygems.org'

# CocoaPods + activesupport 7.2.3.1+ (CVE-2026-33169/70/76) require Ruby >= 3.1.
# macOS system Ruby 2.6 will not work. First-time setup:
#   brew install ruby@3.4
#   npm run setup:ios-ruby && npm run pod-install
ruby ">= 3.1.0"

# Exclude problematic versions of cocoapods and activesupport that causes build failures.
gem 'cocoapods', '>= 1.13', '!= 1.15.0', '!= 1.15.1'
gem 'activesupport', '>= 7.2.3.1', '!= 7.1.0'
gem 'xcodeproj', '< 1.26.0'
gem 'concurrent-ruby', '>= 1.3.4'

# Ruby 3.4.0 has removed some libraries from the standard library.
gem 'bigdecimal'
gem 'logger'
gem 'benchmark'
gem 'mutex_m'
gem 'nkf'
