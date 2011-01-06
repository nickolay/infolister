#!/bin/bash

cp ~/dev/jetpack-sdk/python-lib/cuddlefish/app-extension/components/harness.js extension/components || exit $?

cfx -a firefox --templatedir extension $1 $2 $3 $4 --profiledir `pwd`/profile-3.6
#cfx -a firefox -b /Applications/Minefield.app --templatedir extension $1 $2 $3 $4 --profiledir `pwd`/profile
if [ "$1" = "xpi" ]
then
  echo "Remember to add the 'defaults' to the XPI! (bug 559306)"
  echo "Also, you need to update the contractID for the harness component in infolister-service (bug 567642)"
fi
