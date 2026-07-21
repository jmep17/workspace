# vm-out — pull Claude's commits back from the VM as a patch file.
#
# Counterpart to vm-in. Exports every commit made on the VM since the
# last vm-in (the .claude-vm-base marker) with format-patch. Nothing is
# applied automatically — the patch file in the repo root is the review
# boundary: eyeball it, then land it with `git am`.
function vm-out --description "Fetch Claude's VM commits as a patch"
    set -l host claude-vm
    set -q CLAUDE_VM; and set host $CLAUDE_VM

    set -l root (git rev-parse --show-toplevel 2>/dev/null)
    or begin
        echo "vm-out: not inside a git repo" >&2
        return 1
    end
    set -l name (path basename $root)

    set -l base (ssh $host cat work/$name/.claude-vm-base 2>/dev/null)
    if test -z "$base"
        echo "vm-out: no base marker on $host:~/work/$name — was this repo vm-in'ed?" >&2
        return 1
    end

    set -l patch $root/claude-(date +%Y%m%d-%H%M%S).patch
    ssh $host "git -C work/$name format-patch --stdout $base" > $patch
    or begin
        rm -f $patch
        return 1
    end

    if test -s $patch
        echo "vm-out: wrote "(path basename $patch)
        git -C $root apply --stat $patch
        echo "review it, then: git am "(path basename $patch)
    else
        rm $patch
        echo "vm-out: no commits on the VM since vm-in"
    end

    # format-patch only carries commits — flag anything left behind.
    set -l dirty (ssh $host "git -C work/$name status --porcelain" | string collect)
    if test -n "$dirty"
        echo "vm-out: note — the VM tree has uncommitted/untracked changes; commit them there and rerun" >&2
    end
end
