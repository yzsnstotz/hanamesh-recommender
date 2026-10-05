# Recommender rc.5 development vendor self-check evidence

METADATA-DEVKIT-VENDOR-RECOMMENDER-01, 2026-10-06 JST. These are implementer SOURCE/FIXTURE results, not independent review or a host/UI/product gate. Model requests: expected 0, actual 0.

Full original check: 34 tests, no failures/skips; all six original mutants have baseline exit0, mutant exit1 and ERR_ASSERTION. Original JS and strict TypeScript public consumer probes are copied byte-identically from the C03 evidence; TypeScript inference uses allowJs=true/checkJs=false, strict=true/skipLibCheck=false, and rejects two wrong assignments. This does not typecheck the internal JS implementation.

Runtime lock graph: exact 31 packages and snapshots; devkit absent in pure consumer. Installed canonical devkit rc.2 byte-matches the independently verified archive. The first baseline check log records Node22 PATH drift; fixed PATH is recorded in the next log. No origin assertion was relaxed.

Complete member payload/headers and manifest/lock preservation assertions are in archive-audit.json. Rerunnable card scripts: ~/.cache/hanamesh-runs/METADATA-DEVKIT-VENDOR-RECOMMENDER-01/_evidence/{reproduce.sh,audit.py}.
