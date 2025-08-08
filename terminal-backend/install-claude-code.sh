#!/bin/bash

echo "Installing Claude Code CLI globally..."
npm install -g @anthropic-ai/claude-code

echo "Checking Claude Code installation..."
claude --version

echo "Claude Code installation complete!"
echo "You can now start Claude Code by running: claude"