function fish_prompt --description 'Two-line gruvbox prompt: path + git, then status-colored arrow'
    set -l last_status $status

    echo -s (set_color a89984) (prompt_pwd) (set_color normal) (fish_git_prompt ' %s')

    if test $last_status -eq 0
        echo -n -s (set_color b8bb26) '❯ ' (set_color normal)
    else
        echo -n -s (set_color fb4934) '❯ ' (set_color normal)
    end
end
