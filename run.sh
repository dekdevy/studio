#!/bin/sh

apt-get update
apt-get install -yq python build-essential

rm -rf node_modules
npm install

node --harmony main.js
