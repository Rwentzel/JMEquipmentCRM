<?php
/**
 * JM Equipment Child Theme Functions
 *
 * Custom functionality for JM Equipment Inc. WordPress site
 * Built on GeneratePress parent theme
 *
 * @package JM_Equipment_Child
 * @version 1.0.0
 */

if (!defined('ABSPATH')) {
    exit; // Exit if accessed directly
}

/**
 * Theme version
 */
define('JM_EQUIPMENT_VERSION', '1.0.0');

/**
 * Enqueue parent and child theme styles
 */
function jm_equipment_enqueue_styles() {
    // Parent theme stylesheet
    wp_enqueue_style(
        'generatepress-parent',
        get_template_directory_uri() . '/style.css',
        array(),
        wp_get_theme()->parent()->get('Version')
    );

    // Child theme stylesheet
    wp_enqueue_style(
        'jm-equipment-child',
        get_stylesheet_uri(),
        array('generatepress-parent'),
        JM_EQUIPMENT_VERSION
    );

    // Google Fonts
    wp_enqueue_style(
        'jm-equipment-fonts',
        'https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Open+Sans:wght@400;600;700&display=swap',
        array(),
        null
    );
}
add_action('wp_enqueue_scripts', 'jm_equipment_enqueue_styles');

/**
 * Enqueue custom JavaScript
 */
function jm_equipment_enqueue_scripts() {
    wp_enqueue_script(
        'jm-equipment-custom',
        get_stylesheet_directory_uri() . '/js/custom.js',
        array('jquery'),
        JM_EQUIPMENT_VERSION,
        true
    );

    // Localize script for AJAX
    wp_localize_script('jm-equipment-custom', 'jmEquipment', array(
        'ajaxUrl' => admin_url('admin-ajax.php'),
        'nonce' => wp_create_nonce('jm-equipment-nonce'),
        'phoneNumber' => '+1-269-651-2371',
        'email' => 'sales@jmequipment.com'
    ));
}
add_action('wp_enqueue_scripts', 'jm_equipment_enqueue_scripts');

/**
 * Register custom post type for Equipment
 */
function jm_equipment_register_post_types() {
    $labels = array(
        'name'                  => 'Equipment',
        'singular_name'         => 'Equipment',
        'menu_name'             => 'Equipment',
        'add_new'               => 'Add New',
        'add_new_item'          => 'Add New Equipment',
        'edit_item'             => 'Edit Equipment',
        'new_item'              => 'New Equipment',
        'view_item'             => 'View Equipment',
        'search_items'          => 'Search Equipment',
        'not_found'             => 'No equipment found',
        'not_found_in_trash'    => 'No equipment found in trash',
        'all_items'             => 'All Equipment',
    );

    $args = array(
        'labels'                => $labels,
        'public'                => true,
        'has_archive'           => true,
        'publicly_queryable'    => true,
        'show_ui'               => true,
        'show_in_menu'          => true,
        'show_in_rest'          => true,
        'menu_icon'             => 'dashicons-admin-tools',
        'supports'              => array('title', 'editor', 'thumbnail', 'excerpt', 'custom-fields', 'revisions'),
        'rewrite'               => array('slug' => 'equipment', 'with_front' => false),
        'capability_type'       => 'post',
        'hierarchical'          => false,
    );

    register_post_type('equipment', $args);
}
add_action('init', 'jm_equipment_register_post_types');

/**
 * Register custom taxonomies for Equipment
 */
function jm_equipment_register_taxonomies() {
    // Equipment Category
    $category_labels = array(
        'name'              => 'Equipment Categories',
        'singular_name'     => 'Equipment Category',
        'search_items'      => 'Search Categories',
        'all_items'         => 'All Categories',
        'parent_item'       => 'Parent Category',
        'parent_item_colon' => 'Parent Category:',
        'edit_item'         => 'Edit Category',
        'update_item'       => 'Update Category',
        'add_new_item'      => 'Add New Category',
        'new_item_name'     => 'New Category Name',
        'menu_name'         => 'Categories',
    );

    register_taxonomy('equipment_category', 'equipment', array(
        'hierarchical'      => true,
        'labels'            => $category_labels,
        'show_ui'           => true,
        'show_admin_column' => true,
        'show_in_rest'      => true,
        'query_var'         => true,
        'rewrite'           => array('slug' => 'equipment-category'),
    ));

    // Equipment Application
    $application_labels = array(
        'name'              => 'Applications',
        'singular_name'     => 'Application',
        'search_items'      => 'Search Applications',
        'all_items'         => 'All Applications',
        'edit_item'         => 'Edit Application',
        'update_item'       => 'Update Application',
        'add_new_item'      => 'Add New Application',
        'new_item_name'     => 'New Application Name',
        'menu_name'         => 'Applications',
    );

    register_taxonomy('equipment_application', 'equipment', array(
        'hierarchical'      => false,
        'labels'            => $application_labels,
        'show_ui'           => true,
        'show_admin_column' => true,
        'show_in_rest'      => true,
        'query_var'         => true,
        'rewrite'           => array('slug' => 'application'),
    ));
}
add_action('init', 'jm_equipment_register_taxonomies');

/**
 * Add custom meta boxes for equipment
 */
function jm_equipment_add_meta_boxes() {
    add_meta_box(
        'equipment_details',
        'Equipment Details',
        'jm_equipment_details_callback',
        'equipment',
        'normal',
        'high'
    );

    add_meta_box(
        'equipment_specs',
        'Technical Specifications',
        'jm_equipment_specs_callback',
        'equipment',
        'normal',
        'high'
    );
}
add_action('add_meta_boxes', 'jm_equipment_add_meta_boxes');

/**
 * Equipment details meta box callback
 */
function jm_equipment_details_callback($post) {
    wp_nonce_field('jm_equipment_save_details', 'jm_equipment_details_nonce');

    $price = get_post_meta($post->ID, '_equipment_price', true);
    $sku = get_post_meta($post->ID, '_equipment_sku', true);
    $lead_time = get_post_meta($post->ID, '_equipment_lead_time', true);
    $condition = get_post_meta($post->ID, '_equipment_condition', true);
    $tagline = get_post_meta($post->ID, '_product_tagline', true);
    ?>
    <table class="form-table">
        <tr>
            <th><label for="product_tagline">Product Tagline</label></th>
            <td>
                <input type="text" id="product_tagline" name="product_tagline" value="<?php echo esc_attr($tagline); ?>" class="regular-text" />
                <p class="description">Short tagline displayed above product title</p>
            </td>
        </tr>
        <tr>
            <th><label for="equipment_sku">SKU</label></th>
            <td>
                <input type="text" id="equipment_sku" name="equipment_sku" value="<?php echo esc_attr($sku); ?>" class="regular-text" />
            </td>
        </tr>
        <tr>
            <th><label for="equipment_price">Price</label></th>
            <td>
                <input type="text" id="equipment_price" name="equipment_price" value="<?php echo esc_attr($price); ?>" class="regular-text" />
                <p class="description">Enter "Quote" for quote-only items</p>
            </td>
        </tr>
        <tr>
            <th><label for="equipment_lead_time">Lead Time</label></th>
            <td>
                <input type="text" id="equipment_lead_time" name="equipment_lead_time" value="<?php echo esc_attr($lead_time); ?>" class="regular-text" />
                <p class="description">e.g., "8-10 weeks", "In Stock"</p>
            </td>
        </tr>
        <tr>
            <th><label for="equipment_condition">Condition</label></th>
            <td>
                <select id="equipment_condition" name="equipment_condition">
                    <option value="new" <?php selected($condition, 'new'); ?>>New</option>
                    <option value="refurbished" <?php selected($condition, 'refurbished'); ?>>Refurbished</option>
                    <option value="used" <?php selected($condition, 'used'); ?>>Used</option>
                </select>
            </td>
        </tr>
    </table>
    <?php
}

/**
 * Equipment specifications meta box callback
 */
function jm_equipment_specs_callback($post) {
    wp_nonce_field('jm_equipment_save_specs', 'jm_equipment_specs_nonce');

    $max_speed = get_post_meta($post->ID, '_max_speed', true);
    $accuracy = get_post_meta($post->ID, '_accuracy', true);
    $web_width = get_post_meta($post->ID, '_web_width', true);
    $power = get_post_meta($post->ID, '_power', true);
    $dimensions = get_post_meta($post->ID, '_dimensions', true);
    $weight = get_post_meta($post->ID, '_weight', true);
    ?>
    <table class="form-table">
        <tr>
            <th><label for="max_speed">Maximum Speed</label></th>
            <td>
                <input type="text" id="max_speed" name="max_speed" value="<?php echo esc_attr($max_speed); ?>" class="regular-text" />
                <p class="description">e.g., "600 FPM", "450 m/min"</p>
            </td>
        </tr>
        <tr>
            <th><label for="accuracy">Accuracy</label></th>
            <td>
                <input type="text" id="accuracy" name="accuracy" value="<?php echo esc_attr($accuracy); ?>" class="regular-text" />
                <p class="description">e.g., "±0.5mm", "±0.020""</p>
            </td>
        </tr>
        <tr>
            <th><label for="web_width">Web Width</label></th>
            <td>
                <input type="text" id="web_width" name="web_width" value="<?php echo esc_attr($web_width); ?>" class="regular-text" />
                <p class="description">e.g., "1650mm", "65 inches"</p>
            </td>
        </tr>
        <tr>
            <th><label for="power">Power Requirements</label></th>
            <td>
                <input type="text" id="power" name="power" value="<?php echo esc_attr($power); ?>" class="regular-text" />
                <p class="description">e.g., "480V 3-phase, 60Hz"</p>
            </td>
        </tr>
        <tr>
            <th><label for="dimensions">Dimensions</label></th>
            <td>
                <input type="text" id="dimensions" name="dimensions" value="<?php echo esc_attr($dimensions); ?>" class="regular-text" />
                <p class="description">L x W x H</p>
            </td>
        </tr>
        <tr>
            <th><label for="weight">Weight</label></th>
            <td>
                <input type="text" id="weight" name="weight" value="<?php echo esc_attr($weight); ?>" class="regular-text" />
            </td>
        </tr>
    </table>
    <?php
}

/**
 * Save equipment meta box data
 */
function jm_equipment_save_meta_boxes($post_id) {
    // Check autosave
    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
        return;
    }

    // Save equipment details
    if (isset($_POST['jm_equipment_details_nonce']) && wp_verify_nonce($_POST['jm_equipment_details_nonce'], 'jm_equipment_save_details')) {
        if (isset($_POST['product_tagline'])) {
            update_post_meta($post_id, '_product_tagline', sanitize_text_field($_POST['product_tagline']));
        }
        if (isset($_POST['equipment_sku'])) {
            update_post_meta($post_id, '_equipment_sku', sanitize_text_field($_POST['equipment_sku']));
        }
        if (isset($_POST['equipment_price'])) {
            update_post_meta($post_id, '_equipment_price', sanitize_text_field($_POST['equipment_price']));
        }
        if (isset($_POST['equipment_lead_time'])) {
            update_post_meta($post_id, '_equipment_lead_time', sanitize_text_field($_POST['equipment_lead_time']));
        }
        if (isset($_POST['equipment_condition'])) {
            update_post_meta($post_id, '_equipment_condition', sanitize_text_field($_POST['equipment_condition']));
        }
    }

    // Save equipment specs
    if (isset($_POST['jm_equipment_specs_nonce']) && wp_verify_nonce($_POST['jm_equipment_specs_nonce'], 'jm_equipment_save_specs')) {
        $specs = array('max_speed', 'accuracy', 'web_width', 'power', 'dimensions', 'weight');
        foreach ($specs as $spec) {
            if (isset($_POST[$spec])) {
                update_post_meta($post_id, '_' . $spec, sanitize_text_field($_POST[$spec]));
            }
        }
    }
}
add_action('save_post_equipment', 'jm_equipment_save_meta_boxes');

/**
 * Add custom widget areas
 */
function jm_equipment_widget_areas() {
    register_sidebar(array(
        'name'          => 'Product Sidebar',
        'id'            => 'product-sidebar',
        'description'   => 'Appears on equipment product pages',
        'before_widget' => '<div id="%1$s" class="widget %2$s">',
        'after_widget'  => '</div>',
        'before_title'  => '<h3 class="widget-title">',
        'after_title'   => '</h3>',
    ));

    register_sidebar(array(
        'name'          => 'Solution Sidebar',
        'id'            => 'solution-sidebar',
        'description'   => 'Appears on solution pages',
        'before_widget' => '<div id="%1$s" class="widget %2$s">',
        'after_widget'  => '</div>',
        'before_title'  => '<h3 class="widget-title">',
        'after_title'   => '</h3>',
    ));
}
add_action('widgets_init', 'jm_equipment_widget_areas');

/**
 * Customize excerpt length
 */
function jm_equipment_excerpt_length($length) {
    return 30;
}
add_filter('excerpt_length', 'jm_equipment_excerpt_length');

/**
 * Customize excerpt more text
 */
function jm_equipment_excerpt_more($more) {
    return '...';
}
add_filter('excerpt_more', 'jm_equipment_excerpt_more');

/**
 * Add custom image sizes
 */
function jm_equipment_image_sizes() {
    add_image_size('equipment-featured', 800, 600, true);
    add_image_size('equipment-thumbnail', 150, 150, true);
    add_image_size('equipment-gallery', 1200, 900, true);
    add_image_size('hero-banner', 1920, 600, true);
}
add_action('after_setup_theme', 'jm_equipment_image_sizes');

/**
 * Add theme support features
 */
function jm_equipment_theme_support() {
    // Add support for custom logo
    add_theme_support('custom-logo', array(
        'height'      => 100,
        'width'       => 400,
        'flex-height' => true,
        'flex-width'  => true,
    ));

    // Add support for post thumbnails
    add_theme_support('post-thumbnails');

    // Add support for HTML5 markup
    add_theme_support('html5', array(
        'search-form',
        'comment-form',
        'comment-list',
        'gallery',
        'caption',
    ));

    // Add support for title tag
    add_theme_support('title-tag');
}
add_action('after_setup_theme', 'jm_equipment_theme_support');

/**
 * Custom breadcrumb modification for equipment
 */
function jm_equipment_breadcrumb($crumbs) {
    if (is_singular('equipment')) {
        $crumbs = array(
            array(
                'url' => home_url('/'),
                'title' => 'Home'
            ),
            array(
                'url' => home_url('/equipment/'),
                'title' => 'Equipment'
            ),
            array(
                'title' => get_the_title()
            )
        );
    }
    return $crumbs;
}
add_filter('rank_math/frontend/breadcrumb/items', 'jm_equipment_breadcrumb');

/**
 * Add schema markup for equipment
 */
function jm_equipment_product_schema() {
    if (is_singular('equipment')) {
        global $post;

        $schema = array(
            '@context' => 'https://schema.org/',
            '@type' => 'Product',
            'name' => get_the_title(),
            'description' => get_the_excerpt(),
            'image' => get_the_post_thumbnail_url($post->ID, 'full'),
            'brand' => array(
                '@type' => 'Brand',
                'name' => 'JM Equipment Inc.'
            ),
            'manufacturer' => array(
                '@type' => 'Organization',
                'name' => 'JM Equipment Inc.',
                'url' => 'https://jmequipment.com'
            )
        );

        $price = get_post_meta($post->ID, '_equipment_price', true);
        if ($price && $price !== 'Quote' && is_numeric(str_replace(array('$', ','), '', $price))) {
            $schema['offers'] = array(
                '@type' => 'Offer',
                'price' => str_replace(array('$', ','), '', $price),
                'priceCurrency' => 'USD',
                'availability' => 'https://schema.org/InStock'
            );
        }

        echo '<script type="application/ld+json">' . json_encode($schema, JSON_UNESCAPED_SLASHES) . '</script>';
    }
}
add_action('wp_head', 'jm_equipment_product_schema');

/**
 * Flush rewrite rules on theme activation
 */
function jm_equipment_activation() {
    jm_equipment_register_post_types();
    jm_equipment_register_taxonomies();
    flush_rewrite_rules();
}
register_activation_hook(__FILE__, 'jm_equipment_activation');

/**
 * Security enhancements
 */
// Remove WordPress version from head
remove_action('wp_head', 'wp_generator');

// Disable XML-RPC
add_filter('xmlrpc_enabled', '__return_false');

// Remove RSD link
remove_action('wp_head', 'rsd_link');

// Remove Windows Live Writer manifest link
remove_action('wp_head', 'wlwmanifest_link');

/**
 * Performance optimizations
 */
// Disable embeds
function jm_equipment_disable_embeds() {
    wp_dequeue_script('wp-embed');
}
add_action('wp_footer', 'jm_equipment_disable_embeds');

// Defer JavaScript loading
function jm_equipment_defer_scripts($tag, $handle) {
    if (is_admin()) {
        return $tag;
    }

    $defer_scripts = array('jm-equipment-custom');

    if (in_array($handle, $defer_scripts)) {
        return str_replace(' src', ' defer src', $tag);
    }

    return $tag;
}
add_filter('script_loader_tag', 'jm_equipment_defer_scripts', 10, 2);

/**
 * Helper function to get equipment meta
 */
function jm_get_equipment_meta($post_id, $key, $default = '') {
    $value = get_post_meta($post_id, '_' . $key, true);
    return $value ? $value : $default;
}

/**
 * Helper function to display equipment specifications table
 */
function jm_display_specs_table($post_id) {
    $specs = array(
        'max_speed' => 'Maximum Speed',
        'accuracy' => 'Accuracy',
        'web_width' => 'Web Width',
        'power' => 'Power Requirements',
        'dimensions' => 'Dimensions',
        'weight' => 'Weight'
    );

    echo '<table class="specs-table">';
    echo '<thead><tr><th>Specification</th><th>Value</th></tr></thead>';
    echo '<tbody>';

    foreach ($specs as $key => $label) {
        $value = jm_get_equipment_meta($post_id, $key);
        if ($value) {
            echo '<tr>';
            echo '<td>' . esc_html($label) . '</td>';
            echo '<td>' . esc_html($value) . '</td>';
            echo '</tr>';
        }
    }

    echo '</tbody>';
    echo '</table>';
}
