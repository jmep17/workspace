# Hand-rolled fish config — no framework, everything explicit.
# Bootstrap: mv ~/.config/fish ~/.config/fish.bak
#            ln -s ~/src/workspace/fish ~/.config/fish
# Ghostty starts tmux (session "main"); tmux starts fish via
# default-shell in tmux.conf. Ghostty's fish shell integration rides in
# through XDG_DATA_DIRS, so it survives the tmux hop — nothing to wire.

# ── Environment ──────────────────────────────────────────────────────
# Explicit PATH: tmux panes aren't login shells, so don't rely on
# /etc/paths or brew shellenv having run. fish_add_path is idempotent.
fish_add_path /opt/homebrew/bin /opt/homebrew/sbin
fish_add_path ~/src/workspace/bin
fish_add_path ~/.local/bin ~/.bun/bin
fish_add_path /Applications/Docker.app/Contents/Resources/bin

set -gx EDITOR nvim
set -gx VISUAL nvim
set -gx MANPAGER 'nvim +Man!'          # man pages in nvim, with folding
set -gx BAT_THEME gruvbox-dark         # matches the tmux status line

if status is-interactive
    set -g fish_greeting               # no greeting

    # ── Vi mode ──────────────────────────────────────────────────────
    # Esc / hjkl / v / y — mirrors nvim and tmux copy-mode-vi.
    fish_vi_key_bindings
    set -g fish_escape_delay_ms 10     # match tmux's escape-time
    # Mode-shaped cursor: block in normal (Ghostty's default shape),
    # bar in insert. Forced because $TERM is tmux-256color, which hides
    # Ghostty's cursor support from fish; tmux passes DECSCUSR through.
    set -g fish_vi_force_cursor 1
    set -g fish_cursor_default block
    set -g fish_cursor_insert line
    set -g fish_cursor_replace_one underscore
    set -g fish_cursor_visual block

    # ── Colours ──────────────────────────────────────────────────────
    # Named 16-colour slots only — Ghostty's gruvbox theme supplies the
    # real values, so these follow the OS light/dark switch for free.
    set -g fish_color_command green --bold
    set -g fish_color_param normal
    set -g fish_color_option cyan
    set -g fish_color_quote yellow
    set -g fish_color_error red
    set -g fish_color_comment brblack
    set -g fish_color_operator magenta
    set -g fish_color_escape magenta
    set -g fish_color_redirection cyan
    set -g fish_color_end magenta
    set -g fish_color_autosuggestion brblack
    set -g fish_color_valid_path --underline
    set -g fish_color_selection --background=brblack
    set -g fish_pager_color_prefix yellow --bold
    set -g fish_pager_color_completion normal
    set -g fish_pager_color_description brblack
    set -g fish_pager_color_selected_background --background=brblack

    # ── Prompt (see functions/fish_prompt.fish) ──────────────────────
    set -g __fish_git_prompt_showdirtystate 1
    set -g __fish_git_prompt_showuntrackedfiles 1
    set -g __fish_git_prompt_showstashstate 1
    set -g __fish_git_prompt_char_dirtystate '*'
    set -g __fish_git_prompt_char_untrackedfiles '?'
    set -g __fish_git_prompt_char_stashstate '$'
    set -g __fish_git_prompt_color_branch yellow

    # ── Tools ────────────────────────────────────────────────────────
    zoxide init fish | source          # z <dir> jumps, zi picks via fzf
    direnv hook fish | source
    fzf --fish | source                # C-r history, C-t files, M-c cd
    # M-c reaches the shell because Ghostty sets macos-option-as-alt;
    # --color 16 keeps fzf on the terminal palette (gruvbox, both modes).
    set -gx FZF_DEFAULT_COMMAND 'fd --type f --hidden --exclude .git'
    set -gx FZF_CTRL_T_COMMAND $FZF_DEFAULT_COMMAND
    set -gx FZF_ALT_C_COMMAND 'fd --type d --hidden --exclude .git'
    set -gx FZF_DEFAULT_OPTS '--height 40% --layout reverse --border --color 16'

    # ── Aliases & abbreviations ──────────────────────────────────────
    # eza icons render via the Nerd Font ghostty/config sets.
    alias ls 'eza --group-directories-first'
    alias ll 'eza -l --git --group-directories-first'
    alias la 'eza -la --git --group-directories-first'
    alias lt 'eza --tree --level 2'
    alias cat 'bat --paging never'

    abbr -a vi nvim
    abbr -a vim nvim
    abbr -a g git
    abbr -a ta 'tmux attach -t main'
end
