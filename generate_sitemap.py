#!/usr/bin/env python3
"""Regenerate repo-root sitemap.xml to match treemarkables-site/sitemap.xml."""

from datetime import datetime
import os
import xml.etree.ElementTree as ET

URLS = [
    ("https://www.treemarkables.co.nz/", "weekly", "1.0"),
    ("https://www.treemarkables.co.nz/tree-removal", "monthly", "0.9"),
    ("https://www.treemarkables.co.nz/tree-pruning", "monthly", "0.9"),
    ("https://www.treemarkables.co.nz/gisborne-arborist", "monthly", "0.9"),
    ("https://www.treemarkables.co.nz/stump-grinding", "monthly", "0.9"),
    ("https://www.treemarkables.co.nz/hedge-trimming", "monthly", "0.9"),
    ("https://www.treemarkables.co.nz/contact", "monthly", "0.6"),
    ("https://www.treemarkables.co.nz/privacy-policy", "yearly", "0.3"),
]


def create_sitemap():
    urlset = ET.Element("urlset")
    urlset.set("xmlns", "http://www.sitemaps.org/schemas/sitemap/0.9")
    today = datetime.now().strftime("%Y-%m-%d")
    for loc, changefreq, priority in URLS:
        url_element = ET.SubElement(urlset, "url")
        ET.SubElement(url_element, "loc").text = loc
        ET.SubElement(url_element, "lastmod").text = today
        ET.SubElement(url_element, "changefreq").text = changefreq
        ET.SubElement(url_element, "priority").text = priority
    tree = ET.ElementTree(urlset)
    ET.indent(tree, space="  ", level=0)
    tree.write("sitemap.xml", xml_declaration=True, encoding="utf-8", method="xml")
    print(f"Sitemap written ({len(URLS)} marketing URLs) -> {os.path.abspath('sitemap.xml')}")


if __name__ == "__main__":
    create_sitemap()
