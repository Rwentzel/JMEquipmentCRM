<?php
/**
 * JME Child — Storefront child theme for JM Equipment.
 *
 * Responsibilities:
 *  1. Load design-system tokens + components before the theme stylesheet.
 *  2. Enforce the data boundary: no price, cart, sale badge or stock text on any surface.
 *  3. Header contact bar (phone + parts desk + Request list).
 *  4. Status-band badge from product meta (the seven approved bands).
 *  5. noindex + light "console" surface on /console/ and /internal/.
 *  6. Block-editor palette limited to brand tokens.
 *
 * Nothing here talks to the RFQ Worker directly — YITH Request a Quote POSTs to
 * https://jmequipment.net/api/rfq (see deploy/REPLICATION.md, Stage C2).
 */

defined( 'ABSPATH' ) || exit;

define( 'JME_CHILD_VERSION', '1.0.0' );
define( 'JME_PHONE_DISPLAY', '(269) 659-0093' );
define( 'JME_PHONE_TEL', '+12696590093' );
define( 'JME_PARTS_EMAIL', 'parts@jmequipment.net' );

/* ------------------------------------------------------------------
 * 1. Styles — order matters: fonts → tokens → base → components → theme
 * ---------------------------------------------------------------- */
add_action( 'wp_enqueue_scripts', function () {
	$uri  = get_stylesheet_directory_uri();
	$deps = array( 'storefront-style' );

	wp_enqueue_style( 'jme-fonts',
		'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700;800;900&family=Barlow:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap',
		array(), null );

	foreach ( array( 'colors', 'typography', 'spacing', 'effects', 'base' ) as $t ) {
		wp_enqueue_style( "jme-tok-$t", "$uri/assets/css/tokens/$t.css", $deps, JME_CHILD_VERSION );
		$deps[] = "jme-tok-$t";
	}
	wp_enqueue_style( 'jme-components', "$uri/assets/css/components.css", $deps, JME_CHILD_VERSION );
	wp_enqueue_style( 'jme-child', "$uri/style.css", array( 'jme-components' ), JME_CHILD_VERSION );
}, 20 );

// Storefront prints Customizer colors inline at priority 130; the brand is locked, so drop them.
add_action( 'init', function () {
	global $storefront;
	if ( isset( $storefront->customizer ) ) {
		remove_action( 'wp_enqueue_scripts', array( $storefront->customizer, 'add_customizer_css' ), 130 );
	}
}, 20 );

// Preconnect for the font host.
add_filter( 'wp_resource_hints', function ( $urls, $relation ) {
	if ( 'preconnect' === $relation ) {
		$urls[] = array( 'href' => 'https://fonts.gstatic.com', 'crossorigin' );
	}
	return $urls;
}, 10, 2 );

/* ------------------------------------------------------------------
 * 2. Data boundary — RFQ-first, no prices anywhere
 * ---------------------------------------------------------------- */
add_action( 'init', function () {
	remove_action( 'woocommerce_single_product_summary', 'woocommerce_template_single_price', 10 );
	remove_action( 'woocommerce_after_shop_loop_item_title', 'woocommerce_template_loop_price', 10 );
	remove_action( 'woocommerce_after_shop_loop_item_title', 'woocommerce_template_loop_rating', 5 );
	remove_action( 'woocommerce_single_product_summary', 'woocommerce_template_single_rating', 10 );
	remove_action( 'woocommerce_before_shop_loop_item_title', 'woocommerce_show_product_loop_sale_flash', 10 );
	remove_action( 'woocommerce_before_single_product_summary', 'woocommerce_show_product_sale_flash', 10 );
	// Storefront header cart + search (FiboSearch is placed by its own shortcode/widget).
	remove_action( 'storefront_header', 'storefront_header_cart', 60 );
	remove_action( 'storefront_header', 'storefront_product_search', 40 );
} );

add_filter( 'woocommerce_get_price_html', '__return_empty_string', 99 );
add_filter( 'woocommerce_cart_item_price', '__return_empty_string', 99 );
add_filter( 'woocommerce_sale_flash', '__return_empty_string', 99 );
add_filter( 'woocommerce_get_stock_html', '__return_empty_string', 99 );   // stock text replaced by status band (below)
add_filter( 'woocommerce_product_get_reviews_allowed', '__return_false', 99 );
add_filter( 'woocommerce_is_purchasable', '__return_false', 99 );          // YITH Request a Quote renders its own button

// Structured data must not leak an offer/price either.
add_filter( 'woocommerce_structured_data_product', function ( $markup ) {
	unset( $markup['offers'] );
	return $markup;
} );

/* ------------------------------------------------------------------
 * 3. Header contact bar — phone and parts desk are always visible
 * ---------------------------------------------------------------- */
add_action( 'storefront_header', function () {
	$request_list = get_permalink( get_page_by_path( 'request-list' ) );
	printf(
		'<div class="jme-header-contact">'
		. '<span>Sales: <a href="tel:%1$s">%2$s</a></span>'
		. '<a href="mailto:%3$s">%3$s</a>'
		. '%4$s'
		. '</div>',
		esc_attr( JME_PHONE_TEL ),
		esc_html( JME_PHONE_DISPLAY ),
		esc_html( JME_PARTS_EMAIL ),
		$request_list ? '<a class="jme-btn jme-btn--ghost" href="' . esc_url( $request_list ) . '">Request list</a>' : ''
	);
}, 55 );

/* ------------------------------------------------------------------
 * 4. Status band badge (the seven approved bands; never a quantity)
 *    Product meta key: _jme_status_band
 * ---------------------------------------------------------------- */
function jme_status_band_badge( $product_id ) {
	$band = get_post_meta( $product_id, '_jme_status_band', true );
	if ( ! $band ) {
		return '';
	}
	$map = array(
		'in-stock'            => array( 'stock', 'In stock' ),
		'ships-quickly'       => array( 'stock', 'Ships quickly' ),
		'short-lead'          => array( 'lead',  'Short lead time' ),
		'lead-time'           => array( 'lead',  'Lead time confirmed at quote' ),
		'made-to-order'       => array( 'info',  'Made to order' ),
		'confirm-fitment'     => array( 'info',  'Confirm fitment' ),
		'contact-parts-desk'  => array( 'out',   'Contact parts desk' ),
	);
	if ( ! isset( $map[ $band ] ) ) {
		return '';
	}
	list( $tone, $label ) = $map[ $band ];
	return sprintf( '<span class="jme-badge jme-badge--%s">%s</span>', esc_attr( $tone ), esc_html( $label ) );
}
add_action( 'woocommerce_single_product_summary', function () {
	echo jme_status_band_badge( get_the_ID() ); // phpcs:ignore WordPress.Security.EscapeOutput
}, 12 );
add_action( 'woocommerce_after_shop_loop_item_title', function () {
	global $product;
	if ( $product && $product->get_sku() ) {
		printf( '<span class="jme-sku">%s</span>', esc_html( $product->get_sku() ) );
	}
	echo jme_status_band_badge( get_the_ID() ); // phpcs:ignore WordPress.Security.EscapeOutput
}, 11 );

/* ------------------------------------------------------------------
 * 5. Internal surfaces: /console/* and /internal/* — noindex, light system
 * ---------------------------------------------------------------- */
function jme_is_internal_path() {
	$uri = isset( $_SERVER['REQUEST_URI'] ) ? wp_unslash( $_SERVER['REQUEST_URI'] ) : '';
	return (bool) preg_match( '#^/(console|internal)(/|$)#', $uri );
}
add_filter( 'wp_robots', function ( $robots ) {
	if ( jme_is_internal_path() ) {
		$robots['noindex']  = true;
		$robots['nofollow'] = true;
	}
	return $robots;
} );
add_action( 'send_headers', function () {
	if ( jme_is_internal_path() ) {
		header( 'X-Robots-Tag: noindex, nofollow', true );
	}
} );
add_filter( 'body_class', function ( $classes ) {
	if ( jme_is_internal_path() ) {
		$classes[] = 'jme-console';
	}
	return $classes;
} );

/* ------------------------------------------------------------------
 * 6. Block editor: brand palette only, no custom colors/gradients
 * ---------------------------------------------------------------- */
add_action( 'after_setup_theme', function () {
	add_theme_support( 'editor-color-palette', array(
		array( 'name' => 'JME Red',        'slug' => 'jme-red',       'color' => '#A8353A' ),
		array( 'name' => 'JME Red Deep',   'slug' => 'jme-red-deep',  'color' => '#7A1F23' ),
		array( 'name' => 'JME Gold',       'slug' => 'jme-gold',      'color' => '#B8920A' ),
		array( 'name' => 'Charcoal',       'slug' => 'jme-charcoal',  'color' => '#1F1F1F' ),
		array( 'name' => 'Ink',            'slug' => 'ink',           'color' => '#141414' ),
		array( 'name' => 'Paper',          'slug' => 'paper',         'color' => '#EDEAE4' ),
		array( 'name' => 'Paper Dim',      'slug' => 'paper-dim',     'color' => '#B9B4AA' ),
		array( 'name' => 'Canvas',         'slug' => 'canvas',        'color' => '#FFFFFF' ),
	) );
	add_theme_support( 'disable-custom-colors' );
	add_theme_support( 'disable-custom-gradients' );
	add_theme_support( 'editor-gradient-presets', array() );
	add_theme_support( 'editor-font-sizes', array(
		array( 'name' => 'Small', 'slug' => 'sm',   'size' => 13 ),
		array( 'name' => 'Body',  'slug' => 'base', 'size' => 15 ),
		array( 'name' => 'Lead',  'slug' => 'md',   'size' => 17 ),
		array( 'name' => 'H3',    'slug' => 'lg',   'size' => 22 ),
		array( 'name' => 'H2',    'slug' => 'xl',   'size' => 32 ),
		array( 'name' => 'H1',    'slug' => '2xl',  'size' => 48 ),
	) );
	add_theme_support( 'disable-custom-font-sizes' );
}, 20 );

// Tokens in the editor canvas too.
add_action( 'enqueue_block_editor_assets', function () {
	$uri = get_stylesheet_directory_uri();
	foreach ( array( 'colors', 'typography', 'spacing', 'effects' ) as $t ) {
		wp_enqueue_style( "jme-editor-tok-$t", "$uri/assets/css/tokens/$t.css", array(), JME_CHILD_VERSION );
	}
} );
