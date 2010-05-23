#!/bin/bash

cfx -a firefox -t extension $1 -P `pwd`/profile
if [ "$1" = "xpi" ]
then
  echo "Remember to add the 'defaults' to the XPI! (bug 559306)"
fi
