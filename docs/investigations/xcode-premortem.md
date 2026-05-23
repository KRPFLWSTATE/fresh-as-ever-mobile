# Xcode provisioning premortem (**§ `p1-ant-xcode-signed-capabilities-dupe-provisioning-ant`**)

Common failure: duplicated capabilities / stale provisioning profiles when toggling Maps or Push.

Mitigation archive: regenerate profiles after capability change; never commit provisioning secrets — store in CI vault.
