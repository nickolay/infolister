#!/bin/bash

cp addon-sdk/python-lib/cuddlefish/app-extension/components/harness.js infolister/extension/components || exit $?

#export NSPR_LOG_MODULES=nsHttp:5,nsSocketTransport:5,nsHostResolver:5,nsHttpChannel:5
#export NSPR_LOG_FILE=~/dev/infolister-googlecode/log.txt

pushd infolister

#cfx -a firefox --templatedir extension $1 $2 $3 $4 --profiledir `pwd`/profile
cfx -a firefox -b /Applications/Minefield.app --templatedir extension $1 $2 $3 $4 --profiledir `pwd`/../profile
#cfx -a firefox -b ~/dev/mozilla-work/src/obj-ff-debug/dist/MinefieldDebug.app --templatedir extension $1 $2 $3 $4 --profiledir `pwd`/profile
if [ "$1" = "xpi" ]
then
  echo "Remember to add the 'defaults' to the XPI! (bug 559306)"
  echo "Also, you need to update the contractID for the harness component in infolister-service (bug 567642)"
fi

popd