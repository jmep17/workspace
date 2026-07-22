# ports — list every TCP port something is listening on.
#
# One line per listener: port, command, pid, and the bound address, so
# it's obvious what's localhost-only vs exposed on every interface.
# Uses lsof (-P -n keeps ports/addresses numeric), same on macOS and
# Linux. Ports below 1024 usually belong to root, so system daemons
# only show up under `sudo ports` — fine for the dev-server use case.
function ports --description "List all listening TCP ports"
    set -l lines (lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null | tail -n +2)
    if test -z "$lines"
        echo "ports: nothing listening"
        return 1
    end

    # lsof columns: COMMAND PID USER ... NAME(addr:port). Reshape to
    # port-first and dedupe (a process bound to v4+v6 shows up twice).
    for line in $lines
        set -l f (string split -n " " $line)
        set -l addr (string replace -r '^\[?([^\]]*)\]?:(\d+)$' '$1 $2' $f[9])
        set -l parts (string split " " $addr)
        printf "%s\t%s\t%s\t%s\n" $parts[2] $f[1] $f[2] $parts[1]
    end | sort -n -u | column -t -s \t
end
