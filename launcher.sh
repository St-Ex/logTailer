#!/bin/sh
die () {
    echo >&2 "$@"
    exit 1
}

export PATH=/opt/application/node/node/bin/:$PATH
export WHERE=$(dirname $0)
[ "${WHERE}" = "." ] && export WHERE=${PWD}

[ "$#" -eq 1 ] || die "1 argument required, $# provided. Possible arg are : start, stop"

if [ "$1" == "start" ]
then
    ${WHERE}/node_modules/forever/bin/forever stopall
    ${WHERE}/node_modules/forever/bin/forever start ${WHERE}/forever.json
    exit 0
fi

if [ "$1" == "stop" ]
then
    ${WHERE}/node_modules/forever/bin/forever stopall
    exit 0
fi

die "Argument must be start or stop, $1 provided"
