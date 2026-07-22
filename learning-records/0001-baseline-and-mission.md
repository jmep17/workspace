# Baseline established: exact-match redirect_uri is the real constraint

The user arrived with a precise, well-formed problem — multiple branches of one
repo needing OAuth on a provider that accepts exactly `http://localhost:3000/...`
— and confirmed the validation is exact-URL-only (probed and observed errors on
other ports, even in QA mode). They chose mechanics-first learning over a quick
fix. This sets the floor: they already understand ports and redirect_uris at a
working level; teaching starts at *why* the rules exist (socket ownership,
RFC 9700) and builds toward a session-routed reverse proxy. No evidence yet of
prior reverse-proxy experience — treat lesson 0002 as first contact.

**Implications**: skip "what is OAuth" entirely; do not skip "what does bind
actually do". Side-by-side comparison goal means lesson 0003 must cover the
shared-origin/shared-cookie consequence, not just proxying.
