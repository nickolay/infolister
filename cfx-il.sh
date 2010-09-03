#!/bin/bash

cp ~/dev/jetpack-sdk/python-lib/cuddlefish/app-extension/components/harness.js extension/components || exit $?

cfx -a firefox -t extension $1 $2 -P `pwd`/profile
if [ "$1" = "xpi" ]
then
  echo "Remember to add the 'defaults' to the XPI! (bug 559306)"
  echo "Also, you need to update the contractID for the harness component in infolister-service (bug 567642)"
fi
