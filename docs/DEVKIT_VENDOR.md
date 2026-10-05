# Development vendor distribution record

| Name | Version | License / authorization | Source | Purpose |
| --- | --- | --- | --- | --- |
| @hanamesh/devkit | 0.1.0-rc.2 | SEE LICENSE IN LICENSE; HanaMesh-owned distribution authorized by D-2026-10-05-02 and D-2026-10-05-16; no new standard license or relicensing grant | yzsnstotz/hanamesh-server-shared, packages/devkit, source 067a41e7138ca6a9d8f180991711f1b27aefba5a | Development toolchain, preflight, mutation runner and pack verifier only |

Canonical archive: `vendor/hanamesh-devkit-0.1.0-rc.2.tgz`.

- SHA256: `ae815e589c3e5a573e407da5c982bb0fc8df15b57683ebbfaccd828d9dd588e0`
- SHA512 integrity: `sha512-eonr0qJSG3QwOCLLQVbQkeCU0pL1VE5UJcKMEfZZe1NnW5VXtjA5zsfyarurGmthglzpwEkNB+AX0Jqv4XQWZA==`
- Independent component receipt: METADATA-DEVKIT-01 VERIFY, docs commit `69be0faea0b66ae49adf5988ebd1fab093a26290`.
- The archive includes its own `LICENSE` and `LICENSE_RECORD.md`; those texts define this vendor's authorization. The obsolete rc.1 `private=true` / `UNLICENSED` metadata is superseded only for this new devkit archive. The rc.1 archive and digest remain preserved.
- Devkit has no dependency or peerDependency and ships no third-party runtime or compiler. Node is supplied by the development environment.

The precise devDependency and optional peer provide development tools. Devkit is absent from runtime dependencies, runtime imports, and this package's distributed archive; consumers need no devkit installed to use the public package. No shared package or new dependency is introduced.

`hanamesh-recommender` retains its existing MIT license and unset private field. This record grants no new license to the recommender or any other package.
