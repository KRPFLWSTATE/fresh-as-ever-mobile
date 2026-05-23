# Geo API negative UX (**§ `ux-geo-api-contract-reverse-search-negative-paths-ant`**)

Treat unicode, empty string, malformed server JSON consistently:

| Input | Behaviour |
|-------|-----------|
| `""` chips hidden; user hint |
| Emoji-only | degrade gracefully `"Search failed"` message |
| 5xx upstream | surfaced `DiscoverScreen` banner |
