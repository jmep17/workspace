FROM node:20-bookworm-slim

ARG TZ=UTC
ENV TZ="$TZ"

# Dev tooling plus the firewall's dependencies (iptables, ipset, dnsutils, curl, jq)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    dnsutils \
    git \
    gnupg \
    iproute2 \
    ipset \
    iptables \
    jq \
    less \
    procps \
    sudo \
    unzip \
    zsh \
    && rm -rf /var/lib/apt/lists/*

# Persist shell history in the mounted volume
RUN mkdir -p /commandhistory \
    && touch /commandhistory/.bash_history \
    && chown -R node:node /commandhistory
ENV HISTFILE=/commandhistory/.bash_history \
    PROMPT_COMMAND="history -a"

ENV DEVCONTAINER=true

RUN mkdir -p /workspace /home/node/.claude \
    && chown -R node:node /workspace /home/node/.claude

# Pinned install; auto-update is disabled via DISABLE_AUTOUPDATER in devcontainer.json.
# Bump the version here deliberately rather than letting the container drift.
RUN npm install -g @anthropic-ai/claude-code

COPY init-firewall.sh /usr/local/bin/init-firewall.sh

# The firewall script is the only thing the node user may run as root
RUN chmod 755 /usr/local/bin/init-firewall.sh \
    && echo "node ALL=(root) NOPASSWD: /usr/local/bin/init-firewall.sh" > /etc/sudoers.d/node-firewall \
    && chmod 440 /etc/sudoers.d/node-firewall

USER node
WORKDIR /workspace
