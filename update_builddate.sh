#!/bin/bash
# Replace all eight-digit numbers with builddate in selected files

UPDATE_LIST="./install.rdf"

echo "Updating build date..."
for UPDATE_FILE in $UPDATE_LIST; do
  if [ -f $UPDATE_FILE ]; then
    echo "   $UPDATE_FILE"
    sed -i -r s/\\.[0-9]{8}\</.`date "+%Y%m%d"`\</ $UPDATE_FILE
  fi
done
echo "Done!"
