#!/bin/bash

cp addon-sdk/python-lib/cuddlefish/app-extension/components/harness.js infolister/extension/components || exit $?
pushd infolister || exit $?

cfx -a firefox --templatedir extension $1 $2 $3 $4 --profiledir `pwd`/../profile-3.6
#cfx -a firefox -b /Applications/Minefield.app --templatedir extension $1 $2 $3 $4 --profiledir `pwd`/profile
if [ "$1" = "xpi" ]
then
  echo "Remember to update em:bootstrap in the generated XPI!"
fi

popd