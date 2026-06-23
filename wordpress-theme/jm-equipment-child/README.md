# JM Equipment Child Theme

**Version:** 1.0.0  
**Parent Theme:** GeneratePress  
**Author:** JM Equipment Inc.  
**License:** GPL v2 or later

## Description

Custom WordPress child theme for JM Equipment Inc., a converting machinery solutions company. This theme extends GeneratePress with custom product pages, solution-focused content templates, and manufacturing industry optimizations.

## Features

- **Custom Product Pages**: Dedicated template for equipment showcases with specifications, features, and CTAs
- **Equipment Custom Post Type**: Organized product management with custom fields
- **Taxonomies**: Equipment categories and applications for easy filtering
- **Responsive Design**: Mobile-first approach with breakpoints at 768px and 1024px
- **Performance Optimized**: Deferred JavaScript, minimal dependencies, optimized assets
- **SEO Ready**: Schema.org Product markup, breadcrumbs, meta fields
- **B2B Focused**: Quote forms, phone/email tracking, downloadable specs
- **Accessibility**: WCAG 2.1 AA compliant with keyboard navigation and screen reader support

## Installation

### Prerequisites

1. WordPress 6.0 or higher
2. PHP 8.0 or higher
3. GeneratePress parent theme installed

### Steps

1. **Install Parent Theme**
   - Navigate to Appearance → Themes → Add New
   - Search for "GeneratePress"
   - Install and activate

2. **Install Child Theme**
   - Upload the `jm-equipment-child` folder to `/wp-content/themes/`
   - Navigate to Appearance → Themes
   - Activate "JM Equipment Child Theme"

3. **Configure Settings**
   - Go to Customize → GeneratePress
   - Set container width to 1400px
   - Configure colors (Primary: #7C0E14)
   - Set typography (Headings: Montserrat, Body: Open Sans)

4. **Create Required Pages**
   - Home (set as static homepage)
   - Equipment (archive page)
   - Solutions
   - Parts & Service
   - About
   - Contact

## File Structure

```
jm-equipment-child/
├── style.css                    # Main stylesheet with all custom styles
├── functions.php                # Theme functionality and custom features
├── README.md                    # This file
├── screenshot.png               # Theme screenshot (1200x900px)
├── js/
│   └── custom.js               # Custom JavaScript functionality
├── page-templates/
│   └── product-page.php        # Equipment product page template
└── images/                      # Theme images (to be added)
    └── placeholder-product.jpg
```

## Custom Post Types

### Equipment

Custom post type for managing converting machinery products.

**Supports:**
- Title
- Editor
- Featured Image
- Excerpt
- Custom Fields
- Revisions

**Custom Fields:**
- `_product_tagline` - Short product tagline
- `_equipment_sku` - Product SKU
- `_equipment_price` - Price or "Quote"
- `_equipment_lead_time` - Delivery timeframe
- `_equipment_condition` - New/Refurbished/Used
- `_max_speed` - Maximum operating speed
- `_accuracy` - Cutting/sheeting accuracy
- `_web_width` - Maximum web width
- `_power` - Power requirements
- `_dimensions` - Physical dimensions
- `_weight` - Equipment weight

## Taxonomies

### Equipment Category
- Hierarchical taxonomy for organizing equipment types
- Examples: Dual Rotary Sheeters, Rollstands, Guillotine Cutters

### Equipment Application
- Non-hierarchical taxonomy for industry applications
- Examples: Paper Converting, Film Converting, Corrugated

## Custom Functions

### Helper Functions

```php
// Get equipment meta with fallback
jm_get_equipment_meta($post_id, $key, $default = '')

// Display specifications table
jm_display_specs_table($post_id)
```

### Filters

```php
// Customize breadcrumb for equipment
add_filter('rank_math/frontend/breadcrumb/items', 'jm_equipment_breadcrumb');

// Modify excerpt length
add_filter('excerpt_length', 'jm_equipment_excerpt_length'); // Returns 30 words
```

### Actions

```php
// Enqueue styles and scripts
add_action('wp_enqueue_scripts', 'jm_equipment_enqueue_styles');
add_action('wp_enqueue_scripts', 'jm_equipment_enqueue_scripts');

// Register custom post types
add_action('init', 'jm_equipment_register_post_types');

// Add meta boxes
add_action('add_meta_boxes', 'jm_equipment_add_meta_boxes');
```

## JavaScript Features

### Product Gallery
- Image thumbnail navigation
- Lightbox functionality
- Mobile-optimized viewing

### Analytics Tracking
- Phone click tracking
- Email click tracking
- PDF download tracking
- Video play tracking
- Form submission tracking

### User Experience
- Smooth scrolling to anchor links
- Mobile menu enhancements
- Back to top button
- Lazy loading support
- Accordion functionality

### Form Enhancements
- Loading states on submission
- Floating labels
- Enhanced validation

## CSS Custom Properties

The theme uses CSS custom properties (CSS variables) for easy customization:

```css
:root {
    --jm-red: #7C0E14;              /* Primary brand color */
    --jm-red-hover: #9A1B23;        /* Hover state */
    --jm-red-dark: #5A0A0F;         /* Dark variant */
    --jm-gray-dark: #1a1a1a;        /* Dark gray */
    --jm-gray-medium: #4a4a4a;      /* Medium gray */
    --jm-gray-light: #f5f5f5;       /* Light gray background */
    --jm-white: #ffffff;            /* White */
    --jm-accent-blue: #0066cc;      /* Accent blue */
}
```

## Image Sizes

Custom image sizes registered:

- `equipment-featured`: 800x600px (cropped)
- `equipment-thumbnail`: 150x150px (cropped)
- `equipment-gallery`: 1200x900px (cropped)
- `hero-banner`: 1920x600px (cropped)

## Widget Areas

### Product Sidebar
- ID: `product-sidebar`
- Displays on equipment product pages
- Suggested widgets: Contact CTA, Benefits list

### Solution Sidebar
- ID: `solution-sidebar`
- Displays on solution pages
- Suggested widgets: Related equipment, Call to action

## Required Plugins

### Essential
- **Rank Math SEO**: SEO optimization and schema markup
- **WP Rocket**: Performance and caching
- **Wordfence**: Security scanning and firewall
- **WPForms**: Contact and quote forms
- **UpdraftPlus**: Automated backups

### Recommended
- **ShortPixel**: Image optimization
- **MonsterInsights**: Google Analytics integration
- **Really Simple SSL**: SSL management

## Configuration

### wp-config.php Additions

```php
// Performance
define('WP_MEMORY_LIMIT', '512M');
define('WP_MAX_MEMORY_LIMIT', '512M');
define('DISABLE_WP_CRON', true);

// Security
define('DISALLOW_FILE_EDIT', true);
define('FORCE_SSL_ADMIN', true);
```

### Server Requirements

- PHP 8.2+
- MySQL/MariaDB 8.0+
- Memory Limit: 512MB
- Max Upload Size: 64MB
- Max Execution Time: 300 seconds
- HTTPS/SSL Active

## Customization

### Changing Brand Colors

Edit CSS custom properties in `style.css`:

```css
:root {
    --jm-red: #YOUR_COLOR;
}
```

### Adding Custom Fields

Add fields in `functions.php` meta box callbacks and update save function.

### Modifying Product Template

Edit `/page-templates/product-page.php` for layout changes.

## Performance

### Optimization Checklist

- [x] Minified CSS and JavaScript (via WP Rocket)
- [x] Deferred JavaScript loading
- [x] Lazy loading support
- [x] Optimized image sizes
- [x] Disabled WordPress embeds
- [x] Minimal HTTP requests
- [x] No jQuery dependencies (vanilla JS)

### Target Metrics

- PageSpeed Score: 90+
- First Contentful Paint: < 1.5s
- Largest Contentful Paint: < 2.5s
- Time to Interactive: < 3.5s

## Security Features

- XML-RPC disabled
- WordPress version removed from head
- File editing disabled in admin
- Nonce verification on all forms
- Sanitized and escaped output

## Browser Support

- Chrome (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Edge (latest 2 versions)
- iOS Safari 12+
- Chrome Android (latest)

## Accessibility

- WCAG 2.1 AA compliant
- Keyboard navigation support
- Screen reader compatible
- Proper heading hierarchy
- Alt text for all images
- Color contrast ratio 4.5:1+
- Focus indicators visible
- Skip to content link
- ARIA labels where needed

## Troubleshooting

### Styles Not Loading

1. Clear all caches (browser, WP Rocket, server)
2. Verify parent theme is installed
3. Check file permissions (644 for files, 755 for directories)

### Custom Fields Not Saving

1. Verify nonce field is present
2. Check user capabilities
3. Review save_post hook priority

### Images Not Displaying

1. Regenerate thumbnails (use Regenerate Thumbnails plugin)
2. Check file paths in template
3. Verify image upload permissions

## Development

### Local Development Setup

1. Use Local by Flywheel or XAMPP
2. Install WordPress 6.0+
3. Install GeneratePress parent theme
4. Clone this theme to wp-content/themes/
5. Activate and configure

### Staging Workflow

1. Make changes on local development
2. Test thoroughly (all devices, browsers)
3. Push to staging environment
4. Client review and approval
5. Deploy to production

## Changelog

### 1.0.0 - 2025-11-19

**Added**
- Initial theme release
- Custom Equipment post type
- Product page template
- Custom meta boxes for specifications
- Equipment categories and applications taxonomies
- Custom JavaScript for galleries, tracking, and UX
- Responsive design with mobile-first approach
- SEO schema markup for products
- Analytics tracking integration
- Accessibility features (WCAG 2.1 AA)

## Support

For theme support, contact:

**Email:** support@jmequipment.com  
**Phone:** (269) 651-2371  
**Address:** 62265 M-66 North, Sturgis, MI 49091

## Credits

- **Parent Theme:** [GeneratePress](https://generatepress.com/)
- **Fonts:** [Google Fonts](https://fonts.google.com/) (Montserrat, Open Sans)
- **Icons:** Theme uses text-based icons and symbols

## License

This theme is licensed under the GPL v2 or later.

```
Copyright (C) 2025 JM Equipment Inc.

This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation; either version 2 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.
```

---

**Built with care for JM Equipment Inc. - Converting machinery solutions since 1989.**
