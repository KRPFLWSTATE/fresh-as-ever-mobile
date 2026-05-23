# Map & location edge-case QA

## Mobile (device)

- [ ] Permission denied — copy + CTA to open Settings
- [ ] Permission granted — discover shows distance-sorted bags
- [ ] Simulator — fallback / Colombo label visible
- [ ] Profile city vs GPS — region label matches policy in `useUserLocation`
- [ ] Battery — background watch uses 30s interval when not in high-accuracy mode

## Web

- [x] Browser geolocation denied — discover empty copy matches mobile tone
- [x] No hardcoded “1,248” or fake distances on customer pages (favourites use haversine; discover uses `formatDistanceAwayLabel`)
- [x] Favourites show `distanceLabel` (m/km), not static “Nearby”

Record device + build in `PERFECTION_PASS_MCP_GATES.md` Phase 2.
