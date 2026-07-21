# vm-in — snapshot the current repo into the Claude VM over ssh.
#
# One-way copy: the VM holds no git credentials, so the only way back out
# is vm-out (patches), reviewed and pushed from the host. Secrets never
# leave the host — .env and friends are excluded from the sync.
#
# Setup: a `claude-vm` Host alias in ~/.ssh/config pointing at the UTM
# guest (override the name per machine with $CLAUDE_VM). Repos land in
# ~/work/<repo-name> on the VM.
function vm-in --description "Copy the current repo into the Claude VM"
    set -l host claude-vm
    set -q CLAUDE_VM; and set host $CLAUDE_VM

    set -l root (git rev-parse --show-toplevel 2>/dev/null)
    or begin
        echo "vm-in: not inside a git repo" >&2
        return 1
    end
    set -l name (path basename $root)

    # Re-syncing clobbers the VM copy — anything Claude did there that
    # hasn't been vm-out'ed is gone. Make that a decision, not a surprise.
    if ssh $host test -d work/$name
        read -l -P "vm-in: $host:~/work/$name exists — overwrite (unexported changes are lost)? [y/N] " reply
        string match -qi 'y*' $reply; or return 1
    end

    ssh $host mkdir -p work
    or return

    # --delete keeps the copy honest (removed-on-host files go away);
    # excluded files are left alone on the receiver, so the base marker
    # survives until we rewrite it below.
    rsync -a --delete \
        --exclude .env --exclude '.env.*' --exclude node_modules \
        --exclude .DS_Store --exclude .claude-vm-base \
        --exclude 'claude-*.patch' \
        $root/ $host:work/$name/
    or return

    # Record where this copy started so vm-out knows what Claude added.
    ssh $host "git -C work/$name rev-parse HEAD > work/$name/.claude-vm-base"
    and echo "vm-in: synced to $host:~/work/$name"
end
