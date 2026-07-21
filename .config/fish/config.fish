# Hand-rolled fish config — no framework, everything explicit.
# Bootstrap: ln -s ~/src/workspace/.config/fish ~/.config/fish
# Reload with `exec fish`, or just open a new pane — every pane runs fish.
#
# How a shell gets here: Ghostty launches tmux (ghostty/config `command =`),
# tmux launches fish (tmux/tmux.conf `default-shell`), so this file runs
# for every pane without touching the login shell — chsh is optional.

# ── Environment (all shells, including non-interactive) ──────────────
set -gx EDITOR nvim
set -gx VISUAL nvim

# Homebrew first on PATH; fish_add_path dedupes across reloads.
# (/usr/local/bin on an Intel Mac — same caveat as the tmux/ghostty paths.)
fish_add_path /opt/homebrew/bin /opt/homebrew/sbin

if status is-interactive
    # ── Interactive setup ────────────────────────────────────────────
    set -g fish_greeting ""    # no banner; the tmux status line is enough

    # node via fnm (brew, see README); --use-on-cd switches versions on
    # .node-version / .nvmrc.
    if command -q fnm
        fnm env --use-on-cd | source
    end

    # fzf key bindings: C-r history, C-t files (needs fzf ≥ 0.48).
    if command -q fzf
        fzf --fish | source
    end

    # ── Abbreviations ────────────────────────────────────────────────
    # abbr over alias: expands inline, so history stays greppable
    # full-form.
    abbr -a v nvim
    abbr -a lg lazygit
    abbr -a gs git status
    # Re-attach the session Ghostty auto-creates — for SSH / other
    # terminals, where the ⌘ keybinds don't exist and Ghostty isn't the
    # one running tmux.
    abbr -a ta tmux new-session -A -s main

    # ── Prompt ───────────────────────────────────────────────────────
    # Defined in functions/fish_prompt.fish; these tune its git segment.
    set -g __fish_git_prompt_showdirtystate 1
    set -g __fish_git_prompt_showuntrackedfiles 1
    set -g __fish_git_prompt_char_dirtystate "*"
    set -g __fish_git_prompt_char_untrackedfiles "?"

    # ── Colors (gruvbox dark, matching tmux status line & nvim) ──────
    # set -g, not -U: universal variables persist in fish_variables,
    # which is machine state and gitignored — globals keep this file
    # the source of truth on every machine.
    set -g fish_color_normal ebdbb2
    set -g fish_color_command b8bb26
    set -g fish_color_keyword fb4934
    set -g fish_color_quote d79921
    set -g fish_color_redirection d3869b
    set -g fish_color_end fe8019
    set -g fish_color_error fb4934
    set -g fish_color_param ebdbb2
    set -g fish_color_option 83a598
    set -g fish_color_comment 928374
    set -g fish_color_operator 8ec07c
    set -g fish_color_escape fe8019
    set -g fish_color_autosuggestion 928374
    set -g fish_color_valid_path --underline
    set -g fish_color_selection --background=504945
    set -g fish_color_search_match --background=504945
    set -g fish_pager_color_prefix fabd2f --bold
    set -g fish_pager_color_completion ebdbb2
    set -g fish_pager_color_description 928374
    set -g fish_pager_color_selected_background --background=504945
end
