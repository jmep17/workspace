# Doorman lab — Docker variant (lesson 0002)

All commands assume you are in this directory:

```fish
cd ~/src/workspace/labs/doorman-docker
```

## Start everything

```fish
docker compose up
```

## Checkpoints (second terminal)

```fish
curl -s localhost:3000    # → STABLE BRANCH (3101) + echoed X-Forwarded-* headers
curl -s localhost:3101    # → connection refused: branches only exist behind the front door
```

## Swap the live branch

Edit `Caddyfile`: change `reverse_proxy stable:3101` → `reverse_proxy feature:3102`.
Then hot-reload Caddy inside the running container:

```fish
docker compose exec doorman caddy reload --config /etc/caddy/Caddyfile
curl -s localhost:3000    # → FEATURE BRANCH (3102), origin unchanged
```

Swap back the same way (`feature:3102` → `stable:3101`, reload again).

## Tear down

```fish
docker compose down
```

## Who owns the front door?

```fish
lsof -nP -iTCP:3000 -sTCP:LISTEN    # spoiler: a Docker forwarder, not Caddy itself
```

---

Full walkthrough and the *why*: `../../lessons/0002-the-doorman.html` ·
Quick syntax reference: `../../reference/caddyfile-cheatsheet.html`
