function branches --description 'List branches for a repo, most recent commit first'
    set -l repo .
    set -l refs refs/heads

    for arg in $argv
        switch $arg
            case -a --all
                set refs refs/heads refs/remotes
            case -h --help
                echo 'Usage: branches [-a | --all] [repo]'
                echo
                echo 'List branches sorted by most recent commit. repo may be a path or'
                echo 'the name of a repo under ~/src. Defaults to the current directory.'
                echo
                echo '  -a, --all   include remote-tracking branches'
                return 0
            case '*'
                set repo $arg
        end
    end

    # A bare name like "workspace" resolves to ~/src/workspace.
    if not test -d $repo; and test -d ~/src/$repo
        set repo ~/src/$repo
    end

    if not git -C $repo rev-parse --git-dir >/dev/null 2>&1
        echo "branches: '$repo' is not a git repository" >&2
        return 1
    end

    git -C $repo for-each-ref $refs --sort=-committerdate --format='%(HEAD) %(align:36)%(color:yellow)%(refname:short)%(color:reset)%(end) %(align:16)%(color:green)%(committerdate:relative)%(color:reset)%(end) %(align:18)%(color:blue)%(authorname)%(color:reset)%(end) %(contents:subject)'
end
