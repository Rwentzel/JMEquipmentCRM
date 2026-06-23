# JM Equipment WordPress Deployment Checklist

**Version:** 1.0.0  
**Target Site:** jmequipment.com  
**Deployment Date:** ___________  
**Deployed By:** ___________

---

## Pre-Deployment Preparation

### ☐ 1. Hosting Environment Setup

- [ ] cPanel/hosting dashboard access confirmed
- [ ] FTP/SFTP credentials verified
- [ ] Database credentials obtained
- [ ] DNS management access confirmed
- [ ] SSL certificate installed and active
- [ ] Server meets requirements:
  - [ ] PHP 8.2+
  - [ ] MySQL/MariaDB 8.0+
  - [ ] 512MB memory limit
  - [ ] 64MB upload limit
  - [ ] 300s execution time

### ☐ 2. Domain & DNS Configuration

- [ ] Domain registered/transferred to hosting
- [ ] DNS A record points to server IP
- [ ] TTL reduced to 300 seconds (24-48 hours before launch)
- [ ] Email MX records configured
- [ ] Subdomain records set (if needed)

### ☐ 3. WordPress Core Installation

- [ ] WordPress 6.0+ downloaded
- [ ] Database created with appropriate name
- [ ] Database user created with full privileges
- [ ] WordPress files uploaded via FTP/SFTP
- [ ] wp-config.php created with database credentials
- [ ] Security keys generated and added to wp-config.php
- [ ] wp-config-additions.php merged into wp-config.php
- [ ] File permissions set:
  - [ ] Directories: 755
  - [ ] Files: 644
  - [ ] wp-config.php: 600
- [ ] WordPress installation completed via browser
- [ ] Permalinks set to "Post name"

---

## Theme Installation

### ☐ 4. Install GeneratePress Parent Theme

- [ ] Navigate to Appearance → Themes → Add New
- [ ] Search and install "GeneratePress"
- [ ] Activate GeneratePress
- [ ] License key entered (if using Premium)

### ☐ 5. Install JM Equipment Child Theme

- [ ] Upload `jm-equipment-child` folder to `/wp-content/themes/`
- [ ] Child theme appears in Appearance → Themes
- [ ] Child theme activated
- [ ] Parent theme dependency verified
- [ ] Custom styles loading correctly
- [ ] JavaScript functioning properly

### ☐ 6. Configure GeneratePress Settings

Navigate to Customize → GeneratePress:

**Layout:**
- [ ] Container Width: 1400px
- [ ] Content Width: 800px
- [ ] Sidebar Width: 350px
- [ ] Header Layout: Fluid
- [ ] Footer Widgets: 4 columns

**Typography:**
- [ ] Body Font: Open Sans, 400, 16px
- [ ] Headings Font: Montserrat, 700
- [ ] Navigation Font: Montserrat, 600
- [ ] Site Title Font: Montserrat, 800, uppercase

**Colors:**
- [ ] Primary Color: #7C0E14
- [ ] Link Color: #7C0E14
- [ ] Link Hover: #9A1B23
- [ ] Navigation Text: #ffffff
- [ ] Navigation Background: #1a1a1a
- [ ] Footer Background: #1a1a1a

---

## Plugin Installation & Configuration

### ☐ 7. Install Essential Plugins

- [ ] Rank Math SEO
- [ ] WP Rocket
- [ ] Wordfence Security
- [ ] WPForms Lite
- [ ] UpdraftPlus
- [ ] MonsterInsights (Google Analytics)
- [ ] ShortPixel Image Optimizer

### ☐ 8. Configure Rank Math SEO

**Setup Wizard:**
- [ ] Google Search Console connected
- [ ] Google Analytics connected
- [ ] Settings imported (if migrating)

**General Settings:**
- [ ] Strip category base enabled
- [ ] Redirect attachments to parent enabled
- [ ] Open external links in new tab enabled
- [ ] Add missing ALT/TITLE attributes enabled
- [ ] Breadcrumbs enabled (separator: →)

**Titles & Meta:**
- [ ] Homepage title set
- [ ] Homepage description set
- [ ] Equipment post type title format set
- [ ] Equipment post type description format set

**Schema:**
- [ ] Organization schema configured:
  - [ ] Company name
  - [ ] Logo uploaded
  - [ ] Phone number
  - [ ] Address
- [ ] LocalBusiness schema enabled
- [ ] Opening hours set

### ☐ 9. Configure WP Rocket

**Cache:**
- [ ] Mobile caching enabled
- [ ] Logged-in user caching enabled
- [ ] Cache lifespan: 10 hours

**File Optimization:**
- [ ] Minify CSS enabled
- [ ] Combine CSS enabled
- [ ] Minify JavaScript enabled
- [ ] Combine JavaScript enabled
- [ ] Defer JavaScript loading enabled

**Media:**
- [ ] LazyLoad images enabled
- [ ] LazyLoad iframes/videos enabled
- [ ] Disable WordPress embeds enabled

**Preload:**
- [ ] Preload cache enabled
- [ ] Preload links enabled
- [ ] Fonts preloaded: Montserrat, Open Sans

**CDN (if using):**
- [ ] CDN URL configured

### ☐ 10. Configure Wordfence Security

**General Options:**
- [ ] Firewall & Malware Scan enabled
- [ ] Learning Mode for 1 week

**Firewall:**
- [ ] Protection Level: Extended Protection
- [ ] Block fake Google crawlers enabled
- [ ] Failed login attempts threshold: 5
- [ ] Lockout after 20 failed logins in 5 minutes

**Scan:**
- [ ] High Sensitivity mode
- [ ] Daily scan at 3:00 AM
- [ ] Scan core files enabled
- [ ] Scan themes enabled
- [ ] Scan plugins enabled
- [ ] Check malware URLs enabled

**Login Security:**
- [ ] 2FA enabled for administrators
- [ ] CAPTCHA on login enabled
- [ ] Maximum failures: 5
- [ ] Lockout duration: 60 minutes

### ☐ 11. Configure WPForms

**General Settings:**
- [ ] Load Assets Globally: Off
- [ ] GDPR Enhancement: Enable

**Create Forms:**
- [ ] Quote Request Form created
  - [ ] Form ID noted: _______
  - [ ] Notification to: sales@jmequipment.com
  - [ ] reCAPTCHA v3 enabled
- [ ] Contact Form created
  - [ ] Form ID noted: _______
  - [ ] Notification to: sales@jmequipment.com
- [ ] Parts Order Form created
  - [ ] Form ID noted: _______
  - [ ] Notification to: support@jmequipment.com

### ☐ 12. Configure UpdraftPlus

**Backup Schedule:**
- [ ] Files backup: Weekly (Sunday 2:00 AM)
- [ ] Database backup: Daily (3:00 AM)
- [ ] Retention: 4 weekly files, 14 daily databases

**Remote Storage:**
- [ ] Storage configured (Google Drive/Dropbox/S3)
- [ ] Authentication verified
- [ ] Test backup completed
- [ ] Test restore verified

### ☐ 13. Configure ShortPixel

**Settings:**
- [ ] Compression: Lossy
- [ ] Convert PNG to JPEG enabled
- [ ] Resize images > 1920px enabled
- [ ] WebP delivery enabled
- [ ] Optimize PDFs enabled

**Bulk Optimization:**
- [ ] Bulk optimization started
- [ ] All media optimized

---

## Content Creation & Migration

### ☐ 14. Create Page Structure

**Pages Created:**
- [ ] Home (set as static homepage)
- [ ] Equipment (parent page)
  - [ ] Dual Rotary Sheeters
    - [ ] GMC-TC II 1650
    - [ ] GMC-TC 1600-E
  - [ ] Rollstands & Unwinds
    - [ ] Roll-Rite™ Rollstand
    - [ ] Refurbished Martin Rollstands
  - [ ] Guillotine Cutters
  - [ ] Accessories
    - [ ] JME Linear Dancer
    - [ ] JME Core Splitter
    - [ ] JME Decurler System
- [ ] Solutions (parent page)
  - [ ] Reduce Equipment Downtime
  - [ ] Roll Handling Safety
  - [ ] Equipment Cost Management
  - [ ] Core Disposal & Storage
  - [ ] Sheet Length Accuracy
- [ ] Parts & Service
- [ ] About
- [ ] Contact
- [ ] Resources
- [ ] Privacy Policy
- [ ] Terms of Service

### ☐ 15. Configure Homepage

- [ ] Settings → Reading → Homepage: Static page
- [ ] Homepage set to "Home"
- [ ] Posts page set (if using blog)

### ☐ 16. Create Equipment Posts

For each equipment item:
- [ ] GMC-TC II 1650
  - [ ] Post created
  - [ ] Product template assigned
  - [ ] Featured image uploaded
  - [ ] Gallery images added
  - [ ] Custom fields populated
  - [ ] Category assigned
- [ ] GMC-TC 1600-E
  - [ ] Post created
  - [ ] Product template assigned
  - [ ] Featured image uploaded
  - [ ] Gallery images added
  - [ ] Custom fields populated
  - [ ] Category assigned
- [ ] (Repeat for all products)

### ☐ 17. Navigation Menus

**Primary Menu:**
- [ ] Menu created: "Primary Navigation"
- [ ] Menu items added and organized
- [ ] Dropdown menus configured
- [ ] Menu assigned to Primary location

**Footer Menu:**
- [ ] Footer menu created
- [ ] Columns configured (4 columns)
- [ ] Links organized by category
- [ ] Menu assigned to Footer location

### ☐ 18. Widgets

**Footer Widgets:**
- [ ] Column 1: Company info text widget
- [ ] Column 2: Equipment navigation menu
- [ ] Column 3: Services navigation menu
- [ ] Column 4: Business hours + legal links

**Product Sidebar:**
- [ ] Contact CTA widget added
- [ ] Benefits list widget added

---

## Technical Configuration

### ☐ 19. Server Configuration

**.htaccess:**
- [ ] .htaccess file uploaded from `htaccess-template.txt`
- [ ] HTTPS redirect tested
- [ ] WWW/non-WWW redirect configured
- [ ] Security headers verified
- [ ] GZIP compression enabled
- [ ] Browser caching configured

**robots.txt:**
- [ ] robots.txt uploaded to root
- [ ] Sitemap URL updated in robots.txt
- [ ] Tested at /robots.txt

**Cron Jobs:**
- [ ] Server cron access confirmed
- [ ] `cron-configuration.sh` reviewed
- [ ] WP-Cron disabled in wp-config.php
- [ ] System cron jobs installed
- [ ] Cron jobs tested

### ☐ 20. SSL & HTTPS

- [ ] SSL certificate active
- [ ] WordPress Address (URL): https://jmequipment.com
- [ ] Site Address (URL): https://jmequipment.com
- [ ] .htaccess forces HTTPS
- [ ] All internal links use HTTPS
- [ ] Mixed content warnings resolved

### ☐ 21. Database Optimization

- [ ] Spam comments removed
- [ ] Post revisions limited (keep last 3)
- [ ] Auto-drafts removed
- [ ] Trashed posts emptied
- [ ] Database tables optimized

---

## Analytics & Tracking

### ☐ 22. Google Analytics 4

- [ ] GA4 property created
- [ ] Measurement ID obtained: _____________
- [ ] MonsterInsights connected
- [ ] Enhanced eCommerce tracking enabled

**Events Configured:**
- [ ] Quote form submissions
- [ ] Phone clicks
- [ ] Email clicks
- [ ] PDF downloads
- [ ] Video plays

### ☐ 23. Google Search Console

- [ ] Property added: jmequipment.com
- [ ] Ownership verified (DNS or HTML)
- [ ] Sitemap submitted: /sitemap_index.xml
- [ ] URL inspection performed
- [ ] No crawl errors

### ☐ 24. Google Tag Manager (Optional)

- [ ] Container created
- [ ] Container code installed
- [ ] Tags configured
- [ ] Triggers tested

---

## Testing & Quality Assurance

### ☐ 25. Functionality Testing

**Forms:**
- [ ] Quote form submits successfully
- [ ] Email notifications received
- [ ] Thank you page displays
- [ ] Form validation works
- [ ] reCAPTCHA prevents spam

**Navigation:**
- [ ] All menu links work
- [ ] Mobile menu operational
- [ ] Breadcrumbs display correctly
- [ ] Footer links functional

**CTAs:**
- [ ] Phone links trigger dialer (mobile)
- [ ] Email links open mail client
- [ ] Download buttons work
- [ ] Internal links navigate correctly

### ☐ 26. Performance Testing

**Tools Used:**
- [ ] Google PageSpeed Insights (Score: _____)
- [ ] GTmetrix (Grade: _____)
- [ ] Pingdom (Load time: _____s)

**Metrics Achieved:**
- [ ] First Contentful Paint: < 1.5s
- [ ] Largest Contentful Paint: < 2.5s
- [ ] Time to Interactive: < 3.5s
- [ ] Cumulative Layout Shift: < 0.1

**Optimizations (if needed):**
- [ ] Images compressed further
- [ ] Plugins reduced
- [ ] Advanced caching enabled
- [ ] CDN implemented

### ☐ 27. SEO Validation

**On-Page:**
- [ ] All pages have unique titles (< 60 chars)
- [ ] All pages have meta descriptions (< 160 chars)
- [ ] H1 tags present and optimized
- [ ] Images have descriptive alt text
- [ ] Internal linking implemented
- [ ] Schema markup validated

**Technical:**
- [ ] XML sitemap accessible
- [ ] robots.txt configured correctly
- [ ] Canonical URLs set
- [ ] 404 errors resolved
- [ ] SSL active (HTTPS)
- [ ] Mobile-friendly test passed

### ☐ 28. Cross-Browser Testing

**Desktop:**
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

**Mobile:**
- [ ] iOS Safari
- [ ] Chrome Android

**Device Testing:**
- [ ] Desktop (1920px, 1440px)
- [ ] Laptop (1024px)
- [ ] Tablet (768px landscape, portrait)
- [ ] Mobile (375px, 414px)

### ☐ 29. Accessibility Testing

**Tools:**
- [ ] WAVE audit completed
- [ ] axe DevTools audit completed
- [ ] Lighthouse accessibility score: _____

**WCAG 2.1 AA:**
- [ ] Color contrast 4.5:1 minimum
- [ ] Keyboard navigation functional
- [ ] Screen reader compatible (NVDA/JAWS tested)
- [ ] Form labels properly associated
- [ ] Focus indicators visible
- [ ] Alt text for all images

---

## Launch

### ☐ 30. Pre-Launch Checklist (48 Hours Before)

**Content:**
- [ ] All pages published
- [ ] All images optimized
- [ ] All forms tested
- [ ] All links verified
- [ ] Privacy Policy published
- [ ] Terms of Service published

**Technical:**
- [ ] Full site backup created
- [ ] Backup restoration tested
- [ ] Analytics tracking verified
- [ ] Search Console configured
- [ ] Security scan completed (no threats)
- [ ] Performance targets met

**DNS:**
- [ ] DNS TTL reduced to 300 seconds

### ☐ 31. Launch Day (6 Hours Before)

- [ ] Final backup of old site (if replacing)
- [ ] Final backup of new site
- [ ] Rollback plan prepared
- [ ] Team briefed on launch process

### ☐ 32. Launch Hour

**DNS Switchover:**
- [ ] DNS A record updated to new server IP
- [ ] DNS propagation checked (dnschecker.org)
- [ ] Site loads on new server
- [ ] Critical user paths tested
- [ ] Sitemap submitted to Search Console
- [ ] WP Rocket caching enabled
- [ ] Server performance monitored

### ☐ 33. First 24 Hours Post-Launch

**Monitoring:**
- [ ] Google Analytics traffic verified
- [ ] Form submissions working
- [ ] Critical functionality tested
- [ ] Server resources monitored (CPU, memory)
- [ ] Error logs reviewed
- [ ] User feedback collected
- [ ] Critical issues fixed immediately

---

## Post-Launch Optimization

### ☐ 34. Week 1 Tasks

**Daily:**
- [ ] Monitor Google Analytics traffic
- [ ] Check Search Console errors
- [ ] Verify form submissions
- [ ] Monitor server performance
- [ ] Review security scan results

**Weekly:**
- [ ] Submit to industry directories (Thomasnet, MachineryTrader)
- [ ] Update Google Business Profile
- [ ] Email announcement to customer list
- [ ] Social media announcements
- [ ] Begin link building outreach

### ☐ 35. Ongoing Maintenance Schedule

**Daily:**
- [ ] Monitor uptime (UptimeRobot configured)
- [ ] Check form submissions
- [ ] Respond to quote requests (< 4 hours)

**Weekly:**
- [ ] Review analytics data
- [ ] Check for broken links
- [ ] Database optimization
- [ ] Security scan review
- [ ] Backup verification

**Monthly:**
- [ ] Performance audit
- [ ] SEO ranking check
- [ ] Plugin updates (test on staging)
- [ ] Blog post publication (2-4/month)
- [ ] Review top-performing pages

**Quarterly:**
- [ ] Comprehensive SEO audit
- [ ] Competitor analysis update
- [ ] User experience review
- [ ] A/B testing implementation
- [ ] Strategy adjustment

---

## Emergency Contacts

**Developer:** _______________________  
**Server Admin:** ____________________  
**DNS Provider:** ____________________  
**Hosting Support:** __________________  

---

## Sign-Off

**Deployment Completed By:**

Name: ____________________  
Date: ____________________  
Signature: ____________________

**Approved By:**

Name: ____________________  
Date: ____________________  
Signature: ____________________

---

## Notes & Issues

Use this space to document any issues encountered during deployment and their resolutions:

___________________________________________________________________________

___________________________________________________________________________

___________________________________________________________________________

___________________________________________________________________________

___________________________________________________________________________

---

**Document Version:** 1.0.0  
**Last Updated:** 2025-11-19  
**Status:** Ready for Deployment
