#!/bin/bash

cp addon-sdk/python-lib/cuddlefish/app-extension/components/harness.js infolister/extension/components || exit $?
pushd infolister || exit $?

cfx -a firefox $1 $2 $3 $4 --profiledir `pwd`/../profile-3.6
#cfx -a firefox -b /Applications/Minefield.app $1 $2 $3 $4 --profiledir `pwd`/profile

popd