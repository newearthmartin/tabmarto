#!/bin/bash
source "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
set -e

nvm use || exit 1
npm run build
~/.claude/skills/here-now/scripts/publish.sh dist --slug shiny-ember-ftg9 --client claude-code
