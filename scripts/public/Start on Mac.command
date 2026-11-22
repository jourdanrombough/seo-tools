#!/bin/bash
# Double-click to start the SEO tools on a Mac. Leave the window open while you work.
cd "$(dirname "$0")" || exit 1
clear
echo "Starting the SEO Pitch Deck Generator..."
if ! python3 -c "import sys" >/dev/null 2>&1; then
  echo ""
  echo "This Mac does not have Python 3 yet. It is free."
  echo ""
  echo "  If macOS just asked to install its developer tools: click Install,"
  echo "  wait for it to finish, then double-click this file again."
  echo ""
  echo "  Otherwise download Python from https://www.python.org/downloads/"
  echo "  install it, then double-click this file again."
  echo ""
  read -n 1 -s -r -p "Press any key to close this window."
  exit 1
fi
python3 dev-server.py
echo ""
read -n 1 -s -r -p "The tool has stopped. Press any key to close this window."
