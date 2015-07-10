#!/bin/bash

pushd `dirname $0`/infolister/extension
zip -r ../../infolister.xpi .
popd

pushd `dirname $0`
mkdir -p profile-rel/extensions
cp ./infolister.xpi profile-rel/extensions/{3f0da09b-c1ab-40c5-8d7f-53f475ac3fe8}.xpi
popd

/Applications/FirefoxNightly.app/Contents/MacOS/firefox-bin -foreground -no-remote -profile `pwd`/profile-rel
