# Vi mode tag ahead of the prompt. Insert is the resting state — the
# bar cursor already signals it — so only the other modes get a tag.
function fish_mode_prompt
    switch $fish_bind_mode
        case default
            set_color --bold yellow
            echo -n '[N] '
        case replace replace_one
            set_color --bold red
            echo -n '[R] '
        case visual
            set_color --bold magenta
            echo -n '[V] '
    end
    set_color normal
end
