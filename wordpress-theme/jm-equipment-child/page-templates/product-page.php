<?php
/**
 * Template Name: Equipment Product Page
 * Template Post Type: page, equipment
 *
 * Custom template for displaying equipment products
 *
 * @package JM_Equipment_Child
 * @version 1.0.0
 */

get_header(); ?>

<div class="product-page-container">
    <?php while (have_posts()) : the_post(); ?>

        <article id="post-<?php the_ID(); ?>" <?php post_class('product-page'); ?>>

            <?php
            // Get custom field values
            $tagline = get_post_meta(get_the_ID(), '_product_tagline', true);
            $price = get_post_meta(get_the_ID(), '_equipment_price', true);
            $sku = get_post_meta(get_the_ID(), '_equipment_sku', true);
            $lead_time = get_post_meta(get_the_ID(), '_equipment_lead_time', true);
            $condition = get_post_meta(get_the_ID(), '_equipment_condition', true);

            // Specifications
            $max_speed = get_post_meta(get_the_ID(), '_max_speed', true);
            $accuracy = get_post_meta(get_the_ID(), '_accuracy', true);
            $web_width = get_post_meta(get_the_ID(), '_web_width', true);
            ?>

            <!-- Product Hero Section -->
            <div class="product-hero">
                <!-- Product Images -->
                <div class="product-image-gallery">
                    <?php if (has_post_thumbnail()) : ?>
                        <?php the_post_thumbnail('equipment-gallery', array('class' => 'product-image-main', 'alt' => get_the_title())); ?>

                        <!-- Thumbnail Gallery (if multiple images via gallery) -->
                        <div class="product-image-thumbnails">
                            <?php
                            // Get gallery images from post content or custom field
                            $gallery = get_post_gallery(get_the_ID(), false);
                            if ($gallery && isset($gallery['ids'])) {
                                $image_ids = explode(',', $gallery['ids']);
                                foreach ($image_ids as $image_id) {
                                    echo wp_get_attachment_image($image_id, 'equipment-thumbnail', false, array(
                                        'data-full-size' => wp_get_attachment_image_url($image_id, 'equipment-gallery')
                                    ));
                                }
                            } else {
                                // Show featured image as thumbnail if no gallery
                                the_post_thumbnail('equipment-thumbnail', array(
                                    'data-full-size' => get_the_post_thumbnail_url(get_the_ID(), 'equipment-gallery')
                                ));
                            }
                            ?>
                        </div>
                    <?php else : ?>
                        <img src="<?php echo get_stylesheet_directory_uri(); ?>/images/placeholder-product.jpg" alt="<?php the_title(); ?>" class="product-image-main">
                    <?php endif; ?>
                </div>

                <!-- Product Details -->
                <div class="product-details">
                    <?php if ($tagline) : ?>
                        <div class="product-tagline"><?php echo esc_html($tagline); ?></div>
                    <?php endif; ?>

                    <h1 class="product-title"><?php the_title(); ?></h1>

                    <?php if (has_excerpt()) : ?>
                        <div class="product-description">
                            <?php the_excerpt(); ?>
                        </div>
                    <?php endif; ?>

                    <!-- Product Meta Information -->
                    <?php if ($max_speed || $accuracy || $web_width) : ?>
                        <div class="product-meta">
                            <?php if ($max_speed) : ?>
                                <div class="meta-item">
                                    <span class="meta-label">Max Speed</span>
                                    <span class="meta-value"><?php echo esc_html($max_speed); ?></span>
                                </div>
                            <?php endif; ?>

                            <?php if ($accuracy) : ?>
                                <div class="meta-item">
                                    <span class="meta-label">Accuracy</span>
                                    <span class="meta-value"><?php echo esc_html($accuracy); ?></span>
                                </div>
                            <?php endif; ?>

                            <?php if ($web_width) : ?>
                                <div class="meta-item">
                                    <span class="meta-label">Web Width</span>
                                    <span class="meta-value"><?php echo esc_html($web_width); ?></span>
                                </div>
                            <?php endif; ?>

                            <?php if ($lead_time) : ?>
                                <div class="meta-item">
                                    <span class="meta-label">Lead Time</span>
                                    <span class="meta-value"><?php echo esc_html($lead_time); ?></span>
                                </div>
                            <?php endif; ?>
                        </div>
                    <?php endif; ?>

                    <!-- CTA Buttons -->
                    <div class="product-cta-buttons" style="margin-top: 30px;">
                        <a href="#quote-form" class="button jm-cta-button">Request a Quote</a>
                        <a href="tel:+1-269-651-2371" class="button jm-cta-button-secondary" style="margin-left: 15px;">
                            Call (269) 651-2371
                        </a>
                    </div>

                    <!-- Additional Product Info -->
                    <?php if ($condition) : ?>
                        <div class="product-condition" style="margin-top: 20px;">
                            <strong>Condition:</strong> <?php echo esc_html(ucfirst($condition)); ?>
                        </div>
                    <?php endif; ?>

                    <?php if ($sku) : ?>
                        <div class="product-sku" style="margin-top: 10px; color: #888;">
                            <strong>SKU:</strong> <?php echo esc_html($sku); ?>
                        </div>
                    <?php endif; ?>
                </div>
            </div>

            <!-- Main Product Content -->
            <div class="product-content-section">
                <?php the_content(); ?>
            </div>

            <!-- Product Features -->
            <?php
            $features_content = get_post_meta(get_the_ID(), '_product_features', true);
            if ($features_content) :
            ?>
                <div class="product-features">
                    <h3>Key Features & Benefits</h3>
                    <ul class="features-list">
                        <?php
                        $features = explode("\n", $features_content);
                        foreach ($features as $feature) {
                            if (trim($feature)) {
                                echo '<li>' . esc_html(trim($feature)) . '</li>';
                            }
                        }
                        ?>
                    </ul>
                </div>
            <?php endif; ?>

            <!-- Technical Specifications Table -->
            <div class="product-specs">
                <h3>Technical Specifications</h3>
                <?php jm_display_specs_table(get_the_ID()); ?>
            </div>

            <!-- Applications Section -->
            <?php
            $applications = get_the_terms(get_the_ID(), 'equipment_application');
            if ($applications && !is_wp_error($applications)) :
            ?>
                <div class="product-applications" style="margin: 40px 0;">
                    <h3>Ideal Applications</h3>
                    <div class="applications-list">
                        <?php foreach ($applications as $application) : ?>
                            <span class="application-tag" style="display: inline-block; background: #f5f5f5; padding: 8px 16px; margin: 5px; border-radius: 4px;">
                                <?php echo esc_html($application->name); ?>
                            </span>
                        <?php endforeach; ?>
                    </div>
                </div>
            <?php endif; ?>

            <!-- Call to Action Section -->
            <div class="product-cta-section" id="quote-form">
                <h3>Ready to Learn More?</h3>
                <p>Contact our team for detailed specifications, pricing, and delivery timelines.</p>
                <a href="tel:+1-269-651-2371" class="button jm-cta-button" style="margin-right: 15px;">Call (269) 651-2371</a>
                <a href="mailto:sales@jmequipment.com" class="button jm-cta-button-secondary">Email Sales Team</a>

                <!-- Embed Quote Form Here -->
                <div style="margin-top: 40px; max-width: 600px; margin-left: auto; margin-right: auto;">
                    <?php
                    // Display WPForms quote form (replace 123 with actual form ID)
                    if (shortcode_exists('wpforms')) {
                        echo do_shortcode('[wpforms id="123"]');
                    }
                    ?>
                </div>
            </div>

            <!-- Related Equipment -->
            <?php
            $categories = get_the_terms(get_the_ID(), 'equipment_category');
            if ($categories && !is_wp_error($categories)) {
                $category_ids = wp_list_pluck($categories, 'term_id');

                $related_args = array(
                    'post_type' => 'equipment',
                    'posts_per_page' => 3,
                    'post__not_in' => array(get_the_ID()),
                    'tax_query' => array(
                        array(
                            'taxonomy' => 'equipment_category',
                            'field' => 'term_id',
                            'terms' => $category_ids,
                        ),
                    ),
                );

                $related_query = new WP_Query($related_args);

                if ($related_query->have_posts()) :
            ?>
                    <div class="related-equipment" style="margin-top: 80px;">
                        <h3>Related Equipment</h3>
                        <div class="related-equipment-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 30px; margin-top: 30px;">
                            <?php while ($related_query->have_posts()) : $related_query->the_post(); ?>
                                <div class="related-equipment-item" style="background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); transition: transform 0.3s ease;">
                                    <?php if (has_post_thumbnail()) : ?>
                                        <a href="<?php the_permalink(); ?>">
                                            <?php the_post_thumbnail('equipment-featured', array('style' => 'width: 100%; height: 200px; object-fit: cover;')); ?>
                                        </a>
                                    <?php endif; ?>
                                    <div style="padding: 20px;">
                                        <h4 style="margin: 0 0 10px 0; font-size: 20px;">
                                            <a href="<?php the_permalink(); ?>" style="color: #1a1a1a; text-decoration: none;">
                                                <?php the_title(); ?>
                                            </a>
                                        </h4>
                                        <?php if (has_excerpt()) : ?>
                                            <p style="color: #666; font-size: 14px;"><?php echo wp_trim_words(get_the_excerpt(), 15); ?></p>
                                        <?php endif; ?>
                                        <a href="<?php the_permalink(); ?>" class="button" style="margin-top: 15px; display: inline-block; padding: 10px 20px; font-size: 14px;">
                                            View Details
                                        </a>
                                    </div>
                                </div>
                            <?php endwhile; ?>
                        </div>
                    </div>
            <?php
                    wp_reset_postdata();
                endif;
            }
            ?>

            <!-- Share Section -->
            <div class="product-share" style="margin-top: 40px; text-align: center; padding: 30px; background: #f5f5f5; border-radius: 8px;">
                <h4 style="margin-bottom: 20px;">Share this equipment:</h4>
                <div class="share-buttons">
                    <button onclick="shareProduct('linkedin', '<?php echo get_permalink(); ?>', '<?php echo addslashes(get_the_title()); ?>')" class="share-btn" style="margin: 0 5px; padding: 10px 20px; background: #0077b5; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        LinkedIn
                    </button>
                    <button onclick="shareProduct('twitter', '<?php echo get_permalink(); ?>', '<?php echo addslashes(get_the_title()); ?>')" class="share-btn" style="margin: 0 5px; padding: 10px 20px; background: #1da1f2; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Twitter
                    </button>
                    <button onclick="shareProduct('email', '<?php echo get_permalink(); ?>', '<?php echo addslashes(get_the_title()); ?>')" class="share-btn" style="margin: 0 5px; padding: 10px 20px; background: #7C0E14; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Email
                    </button>
                    <button onclick="printProduct()" class="share-btn" style="margin: 0 5px; padding: 10px 20px; background: #4a4a4a; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Print
                    </button>
                </div>
            </div>

        </article>

    <?php endwhile; ?>
</div>

<?php get_footer(); ?>
