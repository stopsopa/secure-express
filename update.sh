
#!/bin/bash

exec 3<> /dev/null
function red {
    printf "\e[91m$1\e[0m\n"
}
function green {
    printf "\e[32m$1\e[0m\n"
}
set -e

set -x

ORIGIN="origin"
LOCALBRANCH="master"
REMOTEBRANCH="master"

trim() {
    local var="$*"
    # remove leading whitespace characters
    var="${var#"${var%%[![:space:]]*}"}"
    # remove trailing whitespace characters
    var="${var%"${var##*[![:space:]]}"}"
    echo -n "$var"
}


#    if [ "$1" = "--npm" ]; then
#
#        if [ ! -f package_npm.json ]; then red "package_npm.json does not exist - stop"; exit 1; fi
#
#        if [ ! -f package.json ]; then red "package.json does not exist - stop"; exit 1; fi
#
#        if [ -f package_prod.json ]; then red "package_prod.json does exist - stop"; exit 1; fi
#
#        mv package.json package_prod.json
#
#        if [ ! -f package_prod.json ]; then red "package_prod.json does not exist - stop"; exit 1; fi
#
#        mv package_npm.json package.json
#
#        if [ -f package_npm.json ]; then red "package_npm.json does exist - stop"; exit 1; fi
#
#        if [ ! -f package.json ]; then red "package.json does not exist - stop 2"; exit 1; fi
#
#        green "package.json -> package_prod.json  and  package_npm.json -> package.json [done]"
#
#        exit 0
#    fi
#
#    if [ "$1" = "--prod" ]; then
#
#        if [ ! -f package_prod.json ]; then red "package_prod.json does not exist - stop"; exit 1; fi
#
#        if [ ! -f package.json ]; then red "package.json does not exist - stop"; exit 1; fi
#
#        if [ -f package_npm.json ]; then red "package_npm.json does exist - stop"; exit 1; fi
#
#        mv package.json package_npm.json
#
#        if [ ! -f package_npm.json ]; then red "package_npm.json does not exist - stop"; exit 1; fi
#
#        mv package_prod.json package.json
#
#        if [ -f package_prod.json ]; then red "package_prod.json does exist - stop"; exit 1; fi
#
#        if [ ! -f package.json ]; then red "package.json does not exist - stop 2"; exit 1; fi
#
#        green "package.json -> package_npm.json  and  package_prod.json -> package.json [done]"
#
#        exit 0
#    fi
#
#    if [ -f package_prod.json ]; then
#
#        { red "package_prod.json exist, before update run\n    /bin/bash update.sh --prod\n"; } 2>&3
#
#        exit 1;
#    fi

if [ "$(git rev-parse --abbrev-ref HEAD)" != $LOCALBRANCH ]; then

    { red "switch first branch to <$LOCALBRANCH>"; } 2>&3

    exit 1;
fi

make t

{ green "\ncurrent branch: $LOCALBRANCH"; } 2>&3

DIFF="$(git diff --numstat)"

DIFF="$(trim "$DIFF")"

if [ "$DIFF" != "" ]; then

    { red "\n\n    Error: First commit changes ...\n\n"; } 2>&3

    exit 2;
fi

DIFF="$(git diff --numstat $LOCALBRANCH $ORIGIN/$REMOTEBRANCH)"

DIFF="$(trim "$DIFF")"

if [ "$DIFF" != "" ] || [ "$1" = "force" ]; then

    git push $ORIGIN $REMOTEBRANCH --tags

    if [ "$?" != "0" ]; then

        { red "\n\nCan't git push - stop bumping version\n"; } 2>&3

        exit 3;
    fi

    npm version patch

#    node json-to-json.js package.json version package_npm.json version
#
#    node json-to-json.js package.json version standalone-node/package.json "dependencies........."

#    (cd heroku && /bin/bash keep-awake.sh)

    # make umd
    # cat comment.txt dist/spvalidation.js > dist/test.js
    # mv dist/test.js dist/spvalidation.js
    # cat comment.txt dist/spvalidation.min.js > dist/test.js
    # mv dist/test.js dist/spvalidation.min.js

#                            node update-badge.js
#                            git add README.md
#                            npx markdown-toc -i README.md
#                            git add README.md
#                            git add package_npm.json
#                            git add standalone-node/package.json

                            # git add dist
                            # git add examples.es5.js
#                            git commit --amend --no-edit

    git push $ORIGIN $REMOTEBRANCH
#    git push heroku $REMOTEBRANCH

    if [ "$?" = "0" ]; then

#        make cn

        npm publish

#        make cp

        if [ "$?" != "0" ]; then

            { red "\n\nCan't npm publish\n    try to run 'npm login'\n"; } 2>&3

            exit 4;
        fi

#        git push --tags --force

        #make h

        git push $ORIGIN $REMOTEBRANCH --tags

#        git push heroku master

        { green "\n\nSuccess\n"; } 2>&3

    else

        { red "\n\nCan't git push\n"; } 2>&3

        exit 5
    fi

else

    { red "\n\n    Nothing new to publish, \n        run 'make uf' if you're sure that there is still something that should be published\n\n"; } 2>&3
fi
