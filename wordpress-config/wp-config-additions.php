<?php
/**
 * JM Equipment WordPress Configuration Additions
 *
 * Add these lines to your wp-config.php file ABOVE the line that says:
 * "That's all, stop editing! Happy publishing."
 *
 * @package JM_Equipment
 * @version 1.0.0
 */

// ============================================
// SECURITY KEYS
// ============================================
// Generate new keys at: https://api.wordpress.org/secret-key/1.1/salt/
// Replace the default keys with the generated ones

define('AUTH_KEY',         'put your unique phrase here');
define('SECURE_AUTH_KEY',  'put your unique phrase here');
define('LOGGED_IN_KEY',    'put your unique phrase here');
define('NONCE_KEY',        'put your unique phrase here');
define('AUTH_SALT',        'put your unique phrase here');
define('SECURE_AUTH_SALT', 'put your unique phrase here');
define('LOGGED_IN_SALT',   'put your unique phrase here');
define('NONCE_SALT',       'put your unique phrase here');

// ============================================
// PERFORMANCE OPTIMIZATIONS
// ============================================

// Increase memory limits for better performance
define('WP_MEMORY_LIMIT', '512M');
define('WP_MAX_MEMORY_LIMIT', '512M');

// Disable WP-Cron (use server cron instead)
define('DISABLE_WP_CRON', true);

// Limit post revisions to save database space
define('WP_POST_REVISIONS', 3);

// Set autosave interval to 3 minutes (default is 1 minute)
define('AUTOSAVE_INTERVAL', 180);

// Increase database repair timeout
define('DB_REPAIR', false); // Set to true only when needed

// ============================================
// SECURITY HARDENING
// ============================================

// Disable file editing from WordPress admin
define('DISALLOW_FILE_EDIT', true);

// Force SSL for admin area
define('FORCE_SSL_ADMIN', true);

// Disable file modifications (updates/installs via admin)
// define('DISALLOW_FILE_MODS', true); // Uncomment in production if updates are managed externally

// Set custom auto-update constants (WordPress 5.6+)
define('WP_AUTO_UPDATE_CORE', 'minor'); // Enable minor core updates only

// ============================================
// DEBUGGING (DISABLE IN PRODUCTION)
// ============================================

// For development/staging only
// define('WP_DEBUG', true);
// define('WP_DEBUG_LOG', true);
// define('WP_DEBUG_DISPLAY', false);
// define('SCRIPT_DEBUG', true);
// @ini_set('display_errors', 0);

// For production (ensure these are set)
define('WP_DEBUG', false);
define('WP_DEBUG_LOG', false);
define('WP_DEBUG_DISPLAY', false);

// ============================================
// CACHE & COMPRESSION
// ============================================

// Enable built-in cache (if not using external caching plugin)
// define('WP_CACHE', true);

// Compression
define('COMPRESS_CSS', true);
define('COMPRESS_SCRIPTS', true);
define('CONCATENATE_SCRIPTS', true);
define('ENFORCE_GZIP', true);

// ============================================
// CUSTOM PATHS (if needed)
// ============================================

// Custom content directory
// define('WP_CONTENT_DIR', dirname(__FILE__) . '/wp-content');
// define('WP_CONTENT_URL', 'https://jmequipment.com/wp-content');

// Custom plugin directory
// define('WP_PLUGIN_DIR', dirname(__FILE__) . '/wp-content/plugins');
// define('WP_PLUGIN_URL', 'https://jmequipment.com/wp-content/plugins');

// ============================================
// CUSTOM SETTINGS FOR JM EQUIPMENT
// ============================================

// Set default theme
define('WP_DEFAULT_THEME', 'jm-equipment-child');

// Increase upload size limit (if server allows)
@ini_set('upload_max_filesize', '64M');
@ini_set('post_max_size', '64M');
@ini_set('max_execution_time', '300');

// Set timezone
date_default_timezone_set('America/Detroit'); // Michigan timezone

// ============================================
// MULTISITE (if needed in future)
// ============================================

// define('WP_ALLOW_MULTISITE', true);

// ============================================
// CUSTOM DATABASE TABLE PREFIX
// ============================================
// It's recommended to use a custom prefix instead of the default 'wp_'
// for added security. This is set during installation but can be referenced here.

// Example (already set in wp-config.php):
// $table_prefix = 'jme_';

// ============================================
// CLEANUP & OPTIMIZATION
// ============================================

// Empty trash automatically after 7 days (default is 30)
define('EMPTY_TRASH_DAYS', 7);

// Disable post by email
define('WP_POST_BY_EMAIL', false);

// ============================================
// REDIS CACHE (if using Redis)
// ============================================

// define('WP_REDIS_HOST', 'localhost');
// define('WP_REDIS_PORT', 6379);
// define('WP_REDIS_DATABASE', 0);
// define('WP_REDIS_DISABLED', false);

// ============================================
// CLOUDFLARE CDN (if using Cloudflare)
// ============================================

// Trust Cloudflare's forwarded IP addresses
// if (isset($_SERVER['HTTP_CF_CONNECTING_IP'])) {
//     $_SERVER['REMOTE_ADDR'] = $_SERVER['HTTP_CF_CONNECTING_IP'];
// }

// ============================================
// ADDITIONAL PHP SETTINGS
// ============================================

// Increase memory for image processing
@ini_set('memory_limit', '512M');

// Set maximum input variables
@ini_set('max_input_vars', '3000');

// Increase max input time
@ini_set('max_input_time', '300');

// ============================================
// SMTP EMAIL CONFIGURATION (if needed)
// ============================================

// If using external SMTP (like Gmail, SendGrid, etc.)
// Better to use a plugin like WP Mail SMTP for this

// ============================================
// ENVIRONMENT-SPECIFIC SETTINGS
// ============================================

// Detect environment
if (strpos($_SERVER['HTTP_HOST'], 'localhost') !== false ||
    strpos($_SERVER['HTTP_HOST'], '.local') !== false ||
    strpos($_SERVER['HTTP_HOST'], 'staging') !== false) {

    // Development/Staging environment
    define('WP_ENVIRONMENT_TYPE', 'staging');

} else {
    // Production environment
    define('WP_ENVIRONMENT_TYPE', 'production');
}

// ============================================
// API & SERVICE KEYS (use environment variables in production)
// ============================================

// Google reCAPTCHA (for WPForms)
// define('WPFORMS_RECAPTCHA_SITE_KEY', 'your-site-key-here');
// define('WPFORMS_RECAPTCHA_SECRET_KEY', 'your-secret-key-here');

// Google Analytics / Tag Manager
// define('JM_GOOGLE_ANALYTICS_ID', 'G-XXXXXXXXXX');
// define('JM_GOOGLE_TAG_MANAGER_ID', 'GTM-XXXXXXX');

// ============================================
// CUSTOM CONSTANTS FOR THEME
// ============================================

// Company information
define('JM_COMPANY_NAME', 'JM Equipment Inc.');
define('JM_COMPANY_PHONE', '+1-269-651-2371');
define('JM_COMPANY_EMAIL', 'sales@jmequipment.com');
define('JM_COMPANY_ADDRESS', '62265 M-66 North, Sturgis, MI 49091');

// Business hours
define('JM_BUSINESS_HOURS', 'Monday - Friday: 8:00 AM - 5:00 PM EST');

// Social media (add as needed)
// define('JM_LINKEDIN_URL', 'https://www.linkedin.com/company/jm-equipment-inc');
// define('JM_FACEBOOK_URL', 'https://www.facebook.com/jmequipment');

// ============================================
// CRON JOBS CONFIGURATION
// ============================================

// Add this to server crontab (replace domain as needed):
// */15 * * * * wget -q -O - https://jmequipment.com/wp-cron.php?doing_wp_cron >/dev/null 2>&1
// OR
// */15 * * * * curl https://jmequipment.com/wp-cron.php?doing_wp_cron >/dev/null 2>&1

// ============================================
// NOTES
// ============================================

/*
 * After adding these configurations:
 *
 * 1. Generate new security keys from https://api.wordpress.org/secret-key/1.1/salt/
 * 2. Update database credentials (DB_NAME, DB_USER, DB_PASSWORD, DB_HOST)
 * 3. Set up server cron job for WP-Cron
 * 4. Ensure file permissions are correct:
 *    - Files: 644
 *    - Directories: 755
 *    - wp-config.php: 600 (for added security)
 * 5. Test thoroughly on staging before deploying to production
 * 6. Keep a backup of wp-config.php before making changes
 */
