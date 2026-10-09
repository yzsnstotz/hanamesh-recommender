# Development Git supply record

| Name | Version line | Authorization / license | Source | Purpose |
| --- | --- | --- | --- | --- |
| @hanamesh/devkit | ^0.2.0 | SEE LICENSE IN LICENSE; HanaMesh-owned distribution authorized by D-2026-10-05-02 and D-2026-10-05-16; no new standard license or relicensing grant | yzsnstotz/hanamesh-server-shared, packages/devkit | Development toolchain, preflight, mutation runner and pack verifier only |

Normal source specification: `git+https://github.com/yzsnstotz/hanamesh-server-shared.git#semver:^0.2.0&path:/packages/devkit`.

Use pnpm 10.33.0: its normal Git subdirectory resolver installs the actual `@hanamesh/devkit` package. npm does not support this Git subdirectory specification. The generated pnpm lock records the exact resolved commit separately from the declared caret range. The current source tag is v0.2.0, peeled commit 8f9bcc69cbacf01d97ffe63bbbade4f865e6dd89.

The installed package's LICENSE and LICENSE_RECORD.md define its authorization. Devkit has no dependencies or peers and ships no third-party runtime or compiler. Node is supplied by the development environment. Devkit's four tools are used by development scripts only. It is absent from runtime imports, runtime dependencies, public peers and the distributed archive; normal runtime consumers do not need it.

The prior rc.1/rc.2 archives and old evidence remain in Git history and in the MERGE-RECOMMENDER-MAIN-01 run rollback directory. They are no longer active source dependencies or package members. Public runtime API and business source are unchanged.
