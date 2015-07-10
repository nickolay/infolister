#!/bin/bash

#export NSPR_LOG_MODULES=nsHttp:5,nsSocketTransport:5,nsHostResolver:5,nsHttpChannel:5
#export NSPR_LOG_FILE=~/dev/infolister/log.txt

pushd `dirname $0`
mkdir -p profile/extensions/
echo "`pwd`/extension/" > profile/extensions/\{3f0da09b-c1ab-40c5-8d7f-53f475ac3fe8\}
/Applications/FirefoxNightly.app/Contents/MacOS/firefox-bin -foreground -no-remote -profile `pwd`/profile
popd
