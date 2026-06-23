#!/bin/bash
# JM Equipment WordPress Cron Job Configuration
# Version: 1.0.0
#
# This script sets up the necessary cron jobs for WordPress
# Run this on your server after WordPress installation

# ============================================
# WORDPRESS WP-CRON
# ============================================
# Runs every 15 minutes to handle scheduled tasks
# (posts, updates, backups, etc.)

echo "Setting up WordPress cron jobs..."

# Option 1: Using wget
# */15 * * * * wget -q -O - https://jmequipment.com/wp-cron.php?doing_wp_cron >/dev/null 2>&1

# Option 2: Using curl (recommended)
CRON_WPCRON="*/15 * * * * curl -s https://jmequipment.com/wp-cron.php?doing_wp_cron >/dev/null 2>&1"

# ============================================
# DATABASE OPTIMIZATION
# ============================================
# Runs weekly on Sunday at 3:00 AM
# Optimizes WordPress database tables

CRON_DBOPTIMIZE="0 3 * * 0 /usr/bin/wp db optimize --path=/var/www/html >/dev/null 2>&1"

# ============================================
# SECURITY SCAN
# ============================================
# Runs daily at 2:00 AM
# Wordfence security scan

CRON_SECURITY="0 2 * * * /usr/bin/wp wordfence scan --path=/var/www/html >/dev/null 2>&1"

# ============================================
# BACKUP
# ============================================
# Runs daily at 1:00 AM
# Creates full backup via UpdraftPlus

CRON_BACKUP="0 1 * * * /usr/bin/wp updraftplus backup --path=/var/www/html >/dev/null 2>&1"

# ============================================
# CACHE CLEARING
# ============================================
# Runs every 6 hours
# Clears WP Rocket cache

CRON_CACHE="0 */6 * * * /usr/bin/wp rocket clean --confirm --path=/var/www/html >/dev/null 2>&1"

# ============================================
# SITEMAP GENERATION
# ============================================
# Runs daily at 4:00 AM
# Regenerates XML sitemap

CRON_SITEMAP="0 4 * * * /usr/bin/wp rank-math sitemap generate --path=/var/www/html >/dev/null 2>&1"

# ============================================
# LOG ROTATION
# ============================================
# Runs weekly on Monday at 5:00 AM
# Rotates and compresses WordPress debug logs

CRON_LOGS="0 5 * * 1 find /var/www/html/wp-content -name 'debug.log' -size +10M -exec gzip {} \\; >/dev/null 2>&1"

# ============================================
# INSTALLATION INSTRUCTIONS
# ============================================

cat << 'INSTRUCTIONS'

==============================================
CRON JOB INSTALLATION INSTRUCTIONS
==============================================

AUTOMATED INSTALLATION:
-----------------------
To install all cron jobs automatically, run this script with sudo:
sudo bash cron-configuration.sh install

MANUAL INSTALLATION:
--------------------
1. SSH into your server
2. Open crontab editor:
   crontab -e

3. Add the following lines:

# WordPress WP-Cron (every 15 minutes)
*/15 * * * * curl -s https://jmequipment.com/wp-cron.php?doing_wp_cron >/dev/null 2>&1

# Database optimization (weekly, Sunday 3 AM)
0 3 * * 0 /usr/bin/wp db optimize --path=/var/www/html >/dev/null 2>&1

# Security scan (daily, 2 AM)
0 2 * * * /usr/bin/wp wordfence scan --path=/var/www/html >/dev/null 2>&1

# Backup (daily, 1 AM)
0 1 * * * /usr/bin/wp updraftplus backup --path=/var/www/html >/dev/null 2>&1

# Cache clearing (every 6 hours)
0 */6 * * * /usr/bin/wp rocket clean --confirm --path=/var/www/html >/dev/null 2>&1

# Sitemap generation (daily, 4 AM)
0 4 * * * /usr/bin/wp rank-math sitemap generate --path=/var/www/html >/dev/null 2>&1

# Log rotation (weekly, Monday 5 AM)
0 5 * * 1 find /var/www/html/wp-content -name 'debug.log' -size +10M -exec gzip {} \; >/dev/null 2>&1

4. Save and exit (Ctrl+X, then Y, then Enter)

5. Verify cron jobs are installed:
   crontab -l

IMPORTANT NOTES:
----------------
- Replace '/var/www/html' with your actual WordPress installation path
- Replace 'jmequipment.com' with your actual domain
- Ensure WP-CLI is installed (required for WP commands)
- Test each cron job manually before scheduling
- Monitor cron execution logs: tail -f /var/log/syslog | grep CRON
- All times are in server timezone (should be America/Detroit for Michigan)

TESTING CRON JOBS:
------------------
Test WP-Cron manually:
curl https://jmequipment.com/wp-cron.php?doing_wp_cron

Test database optimization:
wp db optimize --path=/var/www/html

Test cache clearing:
wp rocket clean --confirm --path=/var/www/html

TROUBLESHOOTING:
----------------
If cron jobs are not running:
1. Check cron service is running: systemctl status cron
2. Check cron logs: grep CRON /var/log/syslog
3. Verify WP-CLI path: which wp
4. Check file permissions on WordPress directory
5. Ensure DISABLE_WP_CRON is set to true in wp-config.php

EMAIL NOTIFICATIONS:
--------------------
To receive email notifications for cron errors, add this at the top of crontab:
MAILTO="admin@jmequipment.com"

To disable email notifications:
MAILTO=""

TIMEZONE:
---------
Set server timezone to Michigan (EST/EDT):
sudo timedatectl set-timezone America/Detroit

Verify timezone:
timedatectl

==============================================

INSTRUCTIONS

# ============================================
# AUTOMATED INSTALLATION FUNCTION
# ============================================

if [ "$1" == "install" ]; then
    echo "Installing cron jobs..."

    # Create temporary cron file
    TEMP_CRON=$(mktemp)

    # Export existing cron jobs
    crontab -l > "$TEMP_CRON" 2>/dev/null || true

    # Add new cron jobs (avoid duplicates)
    if ! grep -q "wp-cron.php" "$TEMP_CRON"; then
        echo "" >> "$TEMP_CRON"
        echo "# JM Equipment WordPress Cron Jobs" >> "$TEMP_CRON"
        echo "$CRON_WPCRON" >> "$TEMP_CRON"
        echo "$CRON_DBOPTIMIZE" >> "$TEMP_CRON"
        echo "$CRON_SECURITY" >> "$TEMP_CRON"
        echo "$CRON_BACKUP" >> "$TEMP_CRON"
        echo "$CRON_CACHE" >> "$TEMP_CRON"
        echo "$CRON_SITEMAP" >> "$TEMP_CRON"
        echo "$CRON_LOGS" >> "$TEMP_CRON"
    fi

    # Install the new crontab
    crontab "$TEMP_CRON"

    # Remove temporary file
    rm "$TEMP_CRON"

    echo "Cron jobs installed successfully!"
    echo ""
    echo "Current cron jobs:"
    crontab -l
    echo ""
    echo "Note: Verify the WordPress path and domain are correct."

elif [ "$1" == "remove" ]; then
    echo "Removing JM Equipment cron jobs..."

    TEMP_CRON=$(mktemp)
    crontab -l | grep -v "wp-cron.php" | grep -v "JM Equipment" > "$TEMP_CRON" 2>/dev/null || true
    crontab "$TEMP_CRON"
    rm "$TEMP_CRON"

    echo "Cron jobs removed."

elif [ "$1" == "test" ]; then
    echo "Testing cron jobs..."

    echo "1. Testing WP-Cron..."
    curl -s https://jmequipment.com/wp-cron.php?doing_wp_cron
    echo "✓ WP-Cron test complete"

    echo ""
    echo "2. Testing WP-CLI availability..."
    which wp
    echo "✓ WP-CLI found"

    echo ""
    echo "3. Testing WordPress path..."
    if [ -f "/var/www/html/wp-config.php" ]; then
        echo "✓ WordPress installation found"
    else
        echo "✗ WordPress not found at /var/www/html"
        echo "  Please update the path in this script"
    fi

    echo ""
    echo "All tests complete."

else
    # Just show instructions if no argument provided
    echo "Usage:"
    echo "  $0 install  - Install all cron jobs"
    echo "  $0 remove   - Remove all cron jobs"
    echo "  $0 test     - Test cron configuration"
    echo ""
    echo "For manual installation, see instructions above."
fi

# ============================================
# MONITORING SCRIPT
# ============================================

# Create a monitoring script to check cron job execution
# Save as: /usr/local/bin/wp-cron-monitor.sh

cat << 'MONITOR_SCRIPT' > /dev/null
#!/bin/bash
# WordPress Cron Monitoring Script
# Checks if cron jobs are running successfully

LOGFILE="/var/log/wp-cron-monitor.log"
WORDPRESS_PATH="/var/www/html"

echo "=== WordPress Cron Monitor - $(date) ===" >> "$LOGFILE"

# Check if WP-Cron is disabled in wp-config.php
if grep -q "DISABLE_WP_CRON.*true" "$WORDPRESS_PATH/wp-config.php"; then
    echo "✓ WP-Cron is disabled (using system cron)" >> "$LOGFILE"
else
    echo "✗ WP-Cron is not disabled in wp-config.php" >> "$LOGFILE"
fi

# Check if cron jobs are scheduled
if crontab -l | grep -q "wp-cron.php"; then
    echo "✓ System cron jobs are scheduled" >> "$LOGFILE"
else
    echo "✗ System cron jobs are NOT scheduled" >> "$LOGFILE"
fi

# Check last backup
LAST_BACKUP=$(find "$WORDPRESS_PATH/wp-content/updraft" -type f -name "*.zip" -mtime -2 2>/dev/null | wc -l)
if [ "$LAST_BACKUP" -gt 0 ]; then
    echo "✓ Recent backup found (last 48 hours)" >> "$LOGFILE"
else
    echo "✗ No recent backups found" >> "$LOGFILE"
fi

echo "" >> "$LOGFILE"
MONITOR_SCRIPT

echo ""
echo "Configuration script ready. Run with 'install', 'remove', or 'test' parameter."
