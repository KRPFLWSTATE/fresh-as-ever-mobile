# TLS pinning stance (**§ `p5-ant-mitm-staging-vs-prod-pinning-decisiondoc`**)

| Env | Guidance |
|-----|----------|
| Staging | Trust system store; allow Proxyman/Charles QA |
| Prod | Prefer modern TLS + cert transparency; pinning optional after threat model |

No client pinning wired today — escalate when fraud signals demand it.
