# Hazard register (plan §AM)

| hazard_id | phase | symptom | cause class | detect | mitigate | status |
|-----------|-------|---------|-------------|--------|----------|--------|
| inventory_gap | p0 | missing RN screen | matrix drift | matrix CI script | keep SCREEN_INVENTORY synced | OPEN |
| linking_parse | p2 | wrong screen on cold link | nav race | Maestro deep link | deferred nav queue | OPEN |
| pay_hash_contract | p5 | checkout broken | API change | contract test Q | golden JSON | OPEN |

Append from pre-mortems and incidents.
