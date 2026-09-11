set -e
cd /home/gaetan/forge-ops
git add -A
git commit -q -F - <<'MSG'
fix(security): confine the checkout root and stop following symlinks out of a tree

setCheckoutPath and createProject wrote whatever path they were handed. The
traversal guard in LocalTree was sound, but it guarded relative to a root the
caller chose, so pointing a project at / turned the file api into a full
filesystem read. Both entry points now run assertCheckoutPath against a
declared list of roots, closed by default to the working directory and widened
through FORGE_CHECKOUT_ROOTS plus the worktree root; the api answers 422
rather than 500.

LocalTree compared paths without resolving them and the evidence reader used
statSync, so a symlink planted in either tree was followed out of it. Both
walk realpath now, which is the confinement each guard was written to claim.

allocateSubdomain is gone: the subdomain actually stored is worktreeFolderFor,
so it was a second way to do the same thing, and it could return the empty
string the day something wired it to a proxy config.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
git push -u origin fix/confine-checkout-root-and-evidence-symlinks 2>&1 | tail -2
