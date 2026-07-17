complete -c branches -s a -l all -d 'include remote-tracking branches'
complete -c branches -s h -l help -d 'show usage'
complete -c branches -x -a '(__fish_complete_directories)'
complete -c branches -x -a '(command ls ~/src 2>/dev/null)' -d 'repo under ~/src'
