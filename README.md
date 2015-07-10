InfoLister is a Firefox extension that lists installed add-ons, themes, and plugins.

The user documentation is at https://nickolay.github.io/infolister/

Installation
============
InfoLister can be installed from [addons.mozilla.org](https://addons.mozilla.org/en-US/firefox/addon/infolister/).

Development
===========

1. git clone https://github.com/nickolay/infolister.git
2. Create an empty `profile` folder, and `profile/extensions/` inside it.
3. Create a file named ``{3f0da09b-c1ab-40c5-8d7f-53f475ac3fe8}` inside the `profile/extensions` directory. Put the full path to `(infolister clone)/extension/` in the file.
4. Run firefox.exe (or `Firefox.app/Contents/MacOS/firefox-bin` on OS X) with the following parameters: ``-foreground -no-remote -profile full/path/to/profile`.

An example start script I use on Mac OS X is checked into the root of this repository (nightly.sh).

Testing
-------
The included tests (`./tests/`) are non-functional at the moment :(

Packaging
---------
To create the XPI just create a zip archive with the contents of the `extension/` directory (not including the directory itself!). See the `build.sh` script for an example.

Documentation
-------------
The InfoLister website (https://nickolay.github.io/infolister/) is maintained in a separate branch of this repository (`gh-pages`).
