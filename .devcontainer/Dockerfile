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
    ripgrep \
    sudo \
    tmux \
    unzip \
    zsh \
    && rm -rf /var/lib/apt/lists/*

# Recent Neovim (bookworm's apt package is 0.7, too old for most configs).
# Installed at build time, so the runtime firewall doesn't apply here.
ARG NVIM_VERSION=v0.11.2
RUN arch="$(dpkg --print-architecture)" \
    && case "$arch" in \
         amd64) nvim_arch=x86_64 ;; \
         arm64) nvim_arch=arm64 ;; \
         *) echo "unsupported arch: $arch" >&2; exit 1 ;; \
       esac \
    && curl -fsSL "https://github.com/neovim/neovim/releases/download/${NVIM_VERSION}/nvim-linux-${nvim_arch}.tar.gz" \
       | tar -xz -C /opt \
    && ln -s "/opt/nvim-linux-${nvim_arch}/bin/nvim" /usr/local/bin/nvim

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
