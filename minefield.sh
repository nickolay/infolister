#!/bin/bash

#export NSPR_LOG_MODULES=nsHttp:5,nsSocketTransport:5,nsHostResolver:5,nsHttpChannel:5
#export NSPR_LOG_FILE=~/dev/infolister-googlecode/log.txt

cp addon-sdk/python-lib/cuddlefish/app-extension/components/harness.js infolister/extension/components || exit $?
pushd infolister

#cfx -a firefox --templatedir extension $1 $2 $3 $4 --profiledir `pwd`/profile
cfx -a firefox -b /Applications/Minefield.app --templatedir extension $1 $2 $3 $4 --profiledir `pwd`/../profile
#cfx -a firefox -b ~/dev/mozilla-work/src/obj-ff-debug/dist/MinefieldDebug.app --templatedir extension $1 $2 $3 $4 --profiledir `pwd`/profile
if [ "$1" = "xpi" ]
then
  echo "Remember to update em:bootstrap in the generated XPI!"
fi

popd