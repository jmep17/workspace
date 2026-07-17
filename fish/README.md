# fish

Hand-rolled fish config in the same spirit as `nvim/` — gruvbox colors to
match tmux/ghostty, a small plugin set, and a prompt written by hand rather
than pulled in as a theme.

## 100%-local plugin set

Every plugin below runs entirely offline: no telemetry, no API calls, no
network access at runtime. The only network use in this whole setup is
`fisher update` downloading plugin code from GitHub at install time — after
that, the shell works with the cable unplugged.

| Plugin | What it does | Where its data lives |
| --- | --- | --- |
| [fisher](https://github.com/jorgebucaran/fisher) | Plugin manager; reads the pinned `fish_plugins` file | copies files into the config dir, nothing else |
| [fzf.fish](https://github.com/PatrickF1/fzf.fish) | Fuzzy-search files (`Ctrl-F`), history (`Ctrl-R`), git log/status (`Ctrl-Alt-L`/`S`), variables (`Ctrl-V`) | wraps the local `fzf`/`fd`/`bat` binaries |
| [z](https://github.com/jethrokuan/z) | Jump to frequently-used directories (`z work`) | frecency database in `$XDG_DATA_HOME` |
| [autopair.fish](https://github.com/jorgebucaran/autopair.fish) | Auto-close and auto-delete matching `()` `[]` `{}` `""` | keybindings only, no state |
| [puffer-fish](https://github.com/nickeb96/puffer-fish) | Text expansions: `...` → `../..`, `!!` → last command | keybindings only, no state |
| [sponge](https://github.com/meaningful-ooo/sponge) | Keeps failed commands and typos out of history | edits local history in memory |
| [plugin-git](https://github.com/jhillyerd/plugin-git) | ~150 git abbreviations (`gst`, `gco`, `gp`, …) | abbreviations only, wraps local git |
| [done](https://github.com/franciscolourenco/done) | Desktop notification when a command >5s finishes in a background window | local `osascript`/`notify-send` |

Deliberately excluded: prompt themes with update checkers, weather/IP
widgets, anything that shells out to a hosted API. The prompt is
hand-rolled in `functions/fish_prompt.fish` (path + git state via fish's
built-in `fish_git_prompt`) with command duration in
`functions/fish_right_prompt.fish` — zero dependencies beyond git.

## Functions

### `branches [-a | --all] [repo]`

Lists branches for any repository, sorted by most recent commit, one line
per branch: current-branch marker, name, relative commit date, author,
subject.

```fish
branches                  # repo you're in
branches ~/src/workspace  # explicit path
branches workspace        # bare name resolves to ~/src/workspace
branches -a workspace     # include remote-tracking branches
```

Tab completion offers directories and the repos under `~/src`.

## Install

```fish
brew install fish fzf fd bat        # fd + bat power fzf.fish previews
ln -s ~/src/workspace/fish ~/.config/fish
fish                                 # start fish, then bootstrap fisher:
curl -sL https://raw.githubusercontent.com/jorgebucaran/fisher/main/functions/fisher.fish | source && fisher update
```

`fisher update` installs everything pinned in `fish_plugins`. To make fish
the login shell:

```fish
echo /opt/homebrew/bin/fish | sudo tee -a /etc/shells
chsh -s /opt/homebrew/bin/fish
```
