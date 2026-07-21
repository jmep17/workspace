#!/bin/bash
# Default-deny egress firewall for the Claude Code devcontainer.
#
# Blocks all outbound traffic except:
#   - DNS and localhost
#   - the host network (so the devcontainer bind mount / editor bridge works)
#   - an allowlist of domains Claude Code and basic dev tooling need
#
# Requires NET_ADMIN and NET_RAW capabilities (set in devcontainer.json runArgs).
# Runs at container start via postStartCommand.

set -euo pipefail
IFS=$'\n\t'

# Domains Claude Code needs (per code.claude.com/docs/en/network-config), plus
# npm and GitHub for ordinary development. Add your own project's registries
# or API hosts here — anything not listed is unreachable from inside the container.
ALLOWED_DOMAINS=(
    # Anthropic API + auth
    api.anthropic.com
    claude.ai
    claude.com
    platform.claude.com
    downloads.claude.ai
    code.claude.com
    # Package registry
    registry.npmjs.org
    # Changelog / release notes
    raw.githubusercontent.com
)

echo "Flushing existing rules..."
iptables -F
iptables -X
iptables -t nat -F
iptables -t nat -X
iptables -t mangle -F
iptables -t mangle -X
ipset destroy allowed-domains 2>/dev/null || true

# DNS and localhost must work before the default-deny policies land
iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
iptables -A OUTPUT -p tcp --dport 53 -j ACCEPT
iptables -A INPUT -p udp --sport 53 -j ACCEPT
iptables -A INPUT -p tcp --sport 53 -j ACCEPT
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

ipset create allowed-domains hash:net

# GitHub publishes its IP ranges; resolving github.com alone is not enough
# because git traffic hits several rotating ranges.
echo "Fetching GitHub IP ranges..."
gh_ranges=$(curl -sf --connect-timeout 10 https://api.github.com/meta)
if [ -z "$gh_ranges" ] || ! echo "$gh_ranges" | jq -e '.web and .api and .git' >/dev/null; then
    echo "ERROR: could not fetch GitHub IP ranges" >&2
    exit 1
fi
while read -r cidr; do
    ipset add allowed-domains "$cidr" -exist
done < <(echo "$gh_ranges" | jq -r '(.web + .api + .git + .packages)[]' | grep -v ':')

for domain in "${ALLOWED_DOMAINS[@]}"; do
    echo "Resolving $domain..."
    ips=$(dig +short A "$domain" | grep -E '^[0-9.]+$' || true)
    if [ -z "$ips" ]; then
        echo "ERROR: failed to resolve $domain" >&2
        exit 1
    fi
    while read -r ip; do
        ipset add allowed-domains "$ip/32" -exist
    done <<< "$ips"
done

# Keep the host network reachable so the editor <-> container bridge works
HOST_IP=$(ip route | grep default | cut -d" " -f3)
if [ -z "$HOST_IP" ]; then
    echo "ERROR: could not determine host IP" >&2
    exit 1
fi
HOST_NETWORK=$(echo "$HOST_IP" | sed 's/\.[0-9]*$/.0\/24/')
iptables -A INPUT -s "$HOST_NETWORK" -j ACCEPT
iptables -A OUTPUT -d "$HOST_NETWORK" -j ACCEPT

# Default deny, then allow established flows and the allowlist
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT DROP
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m set --match-set allowed-domains dst -j ACCEPT
iptables -A OUTPUT -j REJECT --reject-with icmp-admin-prohibited

echo "Verifying firewall..."
if curl -sf --connect-timeout 5 https://example.com >/dev/null 2>&1; then
    echo "ERROR: firewall verification failed — example.com is reachable" >&2
    exit 1
fi
if ! curl -sf --connect-timeout 10 https://api.anthropic.com >/dev/null 2>&1; then
    # api.anthropic.com returns an error status without auth; only connection
    # failures matter here, so retry and inspect the failure mode.
    if ! curl -s --connect-timeout 10 -o /dev/null -w '%{http_code}' https://api.anthropic.com | grep -qE '^[0-9]{3}$'; then
        echo "ERROR: firewall verification failed — cannot reach api.anthropic.com" >&2
        exit 1
    fi
fi
echo "Firewall configured: default-deny egress with $(ipset list allowed-domains | grep -c '^[0-9]') allowed CIDRs"
