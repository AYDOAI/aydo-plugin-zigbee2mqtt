#!/bin/bash
npm install || exit 1
npm run build || exit 1

CODE=$?
if [ $CODE != 0 ]; then
  echo "Build error $CODE"
  exit $CODE
else
  ARCHIVE="../aydo_plugin_zigbee2mqtt_$1.zip"
  rm -r -f ./release
  mkdir -p ./release
  mkdir -p ./release/plugins
  cp ./dist/*.js ./release/plugins
  cp ./src/*.json ./release/plugins
  cp ./dist/*.js ../../server/plugins
  cp ./src/*.json ../../server/plugins
  cd ./release
  rm "$ARCHIVE"
  zip -u -r -q "$ARCHIVE" ./plugins
  if [ "$2" != "" ]; then
    echo "Copy to server: $2"
    scp "$ARCHIVE" "$2"
  fi
fi
