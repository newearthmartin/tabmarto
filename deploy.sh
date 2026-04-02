#!/bin/bash
set -e

npm run build
~/.claude/skills/here-now/scripts/publish.sh dist --slug shiny-ember-ftg9 --client claude-code
