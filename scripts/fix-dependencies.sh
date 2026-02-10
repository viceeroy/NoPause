#!/bin/bash

# Remove node_modules and reinstall dependencies
rm -rf node_modules package-lock.json
npm install
