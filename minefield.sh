#!/bin/bash

#export NSPR_LOG_MODULES=nsHttp:5,nsSocketTransport:5,nsHostResolver:5,nsHttpChannel:5
#export NSPR_LOG_FILE=~/dev/infolister-googlecode/log.txt

cp addon-sdk/python-lib/cuddlefish/app-extension/components/harness.js infolister/extension/components || exit $?
pushd infolister

if [ "$1" = "xpi" ]
then
  UPDATE_URL="--update-url http://mozilla.doslash.org/infolister/update_dev.rdf"
fi
cfx -a firefox -b /Applications/Minefield.app $1 $2 $3 $4 --profiledir `pwd`/../profile-debug $UPDATE_URL
#cfx -a firefox -b /Applications/Minefield.app $1 $2 $3 $4 --profiledir `pwd`/../profile $UPDATE_URL
#cfx -a firefox -b ~/dev/mozilla-work/src/obj-ff-debug/dist/MinefieldDebug.app $1 $2 $3 $4 --profiledir `pwd`/profile

popd
