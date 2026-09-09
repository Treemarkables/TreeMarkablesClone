#!/usr/bin/env python3
"""
XML Sitemap Generator for Treemarkables
Generates a comprehensive sitemap.xml for www.treemarkables.co.nz
"""

import xml.etree.ElementTree as ET
from datetime import datetime
import os

def create_sitemap():
    """Generate XML sitemap for Treemarkables website"""
    
    # Define all important URLs for the website
    urls = [
        {
            'loc': 'https://www.treemarkables.co.nz/',
            'changefreq': 'weekly',
            'priority': '1.0',
            'lastmod': datetime.now().strftime('%Y-%m-%d')
        },
        {
            'loc': 'https://www.treemarkables.co.nz/tree-removal',
            'changefreq': 'monthly',
            'priority': '0.9',
            'lastmod': datetime.now().strftime('%Y-%m-%d')
        },
        {
            'loc': 'https://www.treemarkables.co.nz/tree-pruning',
            'changefreq': 'monthly',
            'priority': '0.9',
            'lastmod': datetime.now().strftime('%Y-%m-%d')
        },
        {
            'loc': 'https://www.treemarkables.co.nz/stump-grinding',
            'changefreq': 'monthly',
            'priority': '0.9',
            'lastmod': datetime.now().strftime('%Y-%m-%d')
        },
        {
            'loc': 'https://www.treemarkables.co.nz/hedge-trimming',
            'changefreq': 'monthly',
            'priority': '0.9',
            'lastmod': datetime.now().strftime('%Y-%m-%d')
        },
        {
            'loc': 'https://www.treemarkables.co.nz/blog',
            'changefreq': 'weekly',
            'priority': '0.8',
            'lastmod': datetime.now().strftime('%Y-%m-%d')
        },
        {
            'loc': 'https://www.treemarkables.co.nz/blog/tree-pruning-gisborne-guide',
            'changefreq': 'monthly',
            'priority': '0.7',
            'lastmod': datetime.now().strftime('%Y-%m-%d')
        }
    ]
    
    # Create root element with namespace
    urlset = ET.Element('urlset')
    urlset.set('xmlns', 'http://www.sitemaps.org/schemas/sitemap/0.9')
    
    # Add each URL to the sitemap
    for url_data in urls:
        url_element = ET.SubElement(urlset, 'url')
        
        # Add location (required)
        loc = ET.SubElement(url_element, 'loc')
        loc.text = url_data['loc']
        
        # Add last modified date (optional but recommended)
        lastmod = ET.SubElement(url_element, 'lastmod')
        lastmod.text = url_data['lastmod']
        
        # Add change frequency (optional)
        changefreq = ET.SubElement(url_element, 'changefreq')
        changefreq.text = url_data['changefreq']
        
        # Add priority (optional)
        priority = ET.SubElement(url_element, 'priority')
        priority.text = url_data['priority']
    
    # Create the tree and write to file
    tree = ET.ElementTree(urlset)
    
    # Ensure proper XML formatting
    ET.indent(tree, space="  ", level=0)
    
    # Write to sitemap.xml in the project root
    output_path = 'sitemap.xml'
    tree.write(output_path, xml_declaration=True, encoding='utf-8', method='xml')
    
    print(f"✅ Sitemap generated successfully: {os.path.abspath(output_path)}")
    print(f"📊 Total URLs included: {len(urls)}")
    print(f"🕒 Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Display summary of included URLs
    print("\n📋 URLs included in sitemap:")
    for i, url_data in enumerate(urls, 1):
        print(f"   {i}. {url_data['loc']} (Priority: {url_data['priority']})")
    
    print(f"\n🌐 Your sitemap will be accessible at: https://www.treemarkables.co.nz/sitemap.xml")
    print("📝 Next steps:")
    print("   1. Upload sitemap.xml to your web server root directory")
    print("   2. Submit sitemap URL to Google Search Console")
    print("   3. Verify sitemap is accessible in your browser")

if __name__ == "__main__":
    create_sitemap()