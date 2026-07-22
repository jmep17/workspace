# killport — kill whatever is listening on a TCP port.
#
# `killport 3000` sends TERM to every process bound to :3000 and reports
# what it killed. `killport -9 3000` (or --force) sends KILL for the
# stubborn ones. Uses lsof, so it works the same on macOS and Linux.
function killport --description "Kill the process(es) listening on a TCP port"
    set -l sig TERM
    set -l port
    for arg in $argv
        switch $arg
            case -9 --force
                set sig KILL
            case '*'
                set port $arg
        end
    end

    if test -z "$port"
        echo "usage: killport [-9|--force] <port>" >&2
        return 2
    end

    set -l pids (lsof -ti tcp:$port -s tcp:listen)
    if test -z "$pids"
        echo "killport: nothing listening on :$port"
        return 1
    end

    # Show what's about to die before killing it — no silent surprises.
    for pid in $pids
        echo "killport: $sig → "(ps -p $pid -o comm= | string trim)" ($pid) on :$port"
    end
    kill -$sig $pids
end
