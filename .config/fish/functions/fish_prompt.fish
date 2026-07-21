# Minimal prompt: cwd, git branch (+ dirty markers, configured in
# config.fish), status-colored arrow. Gruvbox hues matching config.fish.
function fish_prompt
    set -l last $status

    echo -n -s (set_color 83a598) (prompt_pwd) (set_color normal)
    echo -n -s (set_color 928374) (fish_git_prompt " %s") (set_color normal)

    if test $last -eq 0
        set_color b8bb26
    else
        set_color fb4934
    end
    echo -n " ❯ "
    set_color normal
end
