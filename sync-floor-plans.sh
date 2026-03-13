#!/bin/bash
# Sync floor-plans from server/public to dist/public for production deployment

SOURCE_DIR="/opt/test/server/public/floor-plans"
DEST_DIR="/opt/test/dist/public/floor-plans"

# Create destination directory if it doesn't exist
mkdir -p "$DEST_DIR"

# Copy all files from source to destination
if [ -d "$SOURCE_DIR" ]; then
    cp -u "$SOURCE_DIR"/* "$DEST_DIR/" 2>/dev/null || true
    echo "✓ Floor-plans synced to $DEST_DIR"
else
    echo "⚠ Source directory $SOURCE_DIR not found"
fi

# Ensure destination directory has correct permissions
chmod 755 "$DEST_DIR"
