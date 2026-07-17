# fish/config.fish — symlinked to ~/.config/fish (see fish/README.md).
# Everything below runs 100% offline; the only network use in this setup
# is `fisher update` fetching plugin code at install time.

if status is-interactive
    # ── environment ────────────────────────────────────────────────
    set -gx EDITOR nvim
    set -gx VISUAL nvim

    # Homebrew (Apple Silicon path; no-op where it doesn't exist)
    test -d /opt/homebrew/bin; and fish_add_path /opt/homebrew/bin

    # fnm — Node versions from local shims, switches on cd
    type -q fnm; and fnm env --use-on-cd --shell fish | source

    # ── look & feel: gruvbox dark, matching tmux/ghostty ───────────
    set -g fish_greeting

    set -g fish_color_normal ebdbb2
    set -g fish_color_command b8bb26
    set -g fish_color_keyword fe8019
    set -g fish_color_param 83a598
    set -g fish_color_option 83a598
    set -g fish_color_quote fabd2f
    set -g fish_color_error fb4934
    set -g fish_color_comment 928374
    set -g fish_color_operator fe8019
    set -g fish_color_end fe8019
    set -g fish_color_redirection d3869b
    set -g fish_color_autosuggestion 928374
    set -g fish_color_valid_path --underline
    set -g fish_color_selection --background=504945
    set -g fish_color_search_match --background=504945
    set -g fish_pager_color_prefix fabd2f
    set -g fish_pager_color_completion ebdbb2
    set -g fish_pager_color_description 928374
    set -g fish_pager_color_progress 928374
    set -g fish_pager_color_selected_background --background=504945

    # git info for the hand-rolled prompt (functions/fish_prompt.fish)
    set -g __fish_git_prompt_showdirtystate 1
    set -g __fish_git_prompt_showuntrackedfiles 1
    set -g __fish_git_prompt_showstashstate 1
    set -g __fish_git_prompt_showupstream informative
    set -g __fish_git_prompt_char_dirtystate '*'
    set -g __fish_git_prompt_char_untrackedfiles '?'
    set -g __fish_git_prompt_char_stashstate '$'
    set -g __fish_git_prompt_char_upstream_ahead '↑'
    set -g __fish_git_prompt_char_upstream_behind '↓'
    set -g __fish_git_prompt_color_branch d3869b
    set -g __fish_git_prompt_color_dirtystate fabd2f
    set -g __fish_git_prompt_color_untrackedfiles fe8019
    set -g __fish_git_prompt_color_stashstate 8ec07c

    # ── plugins ────────────────────────────────────────────────────
    # fzf.fish: Ctrl-F search directory, Ctrl-R history, Ctrl-Alt-L git log,
    # Ctrl-Alt-S git status, Ctrl-V variables
    if type -q fzf_configure_bindings
        fzf_configure_bindings --directory=\cf
        set -g fzf_fd_opts --hidden --exclude=.git
    end

    # ── abbreviations (plugin-git covers the git ones) ─────────────
    abbr -a v nvim
    abbr -a lg lazygit
    abbr -a ta tmux attach -t main
end
