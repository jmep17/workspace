# cwd, git branch (fish's built-in git prompt, configured in
# config.fish), prompt char coloured by last exit status. Named colours
# only, same reason as the syntax colours: Ghostty's theme fills them in.
function fish_prompt
    set -l last_status $status

    set_color blue
    echo -n (prompt_pwd)
    set_color normal

    fish_git_prompt ' (%s)'

    if test $last_status -eq 0
        set_color green
    else
        set_color red
    end
    echo -n ' ❯ '
    set_color normal
end
