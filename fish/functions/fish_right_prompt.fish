function fish_right_prompt --description 'Duration of the last command when it ran longer than 2s'
    set -q CMD_DURATION; or return
    test $CMD_DURATION -gt 2000; or return

    set_color 928374
    if test $CMD_DURATION -ge 60000
        set -l mins (math -s0 "floor($CMD_DURATION / 60000)")
        set -l secs (math -s0 "floor(($CMD_DURATION % 60000) / 1000)")
        echo -n $mins"m"$secs"s"
    else
        echo -n (math -s1 $CMD_DURATION / 1000)s
    end
    set_color normal
end
