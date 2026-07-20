import { useEffect } from 'react';

interface SEOProps {
  title: string;
  description: string;
  keywords?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  canonicalUrl?: string;
  structuredData?: object;
  noindex?: boolean;
}

export default function SEO({ 
  title, 
  description, 
  keywords, 
  ogTitle, 
  ogDescription, 
  ogImage,
  canonicalUrl,
  structuredData,
  noindex
}: SEOProps) {
  useEffect(() => {
    // Update document title
    document.title = title;

    // Update or create meta tags
    const updateMetaTag = (name: string, content: string, property = false) => {
      const attribute = property ? 'property' : 'name';
      let tag = document.querySelector(`meta[${attribute}="${name}"]`);
      
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute(attribute, name);
        document.head.appendChild(tag);
      }
      
      tag.setAttribute('content', content);
    };

    // Update basic meta tags
    updateMetaTag('description', description);
    if (keywords) updateMetaTag('keywords', keywords);

    // Add canonical URL
    if (canonicalUrl) {
      let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
      if (!canonicalLink) {
        canonicalLink = document.createElement('link');
        canonicalLink.rel = 'canonical';
        document.head.appendChild(canonicalLink);
      }
      canonicalLink.href = canonicalUrl;
    }

    // Update Open Graph tags
    updateMetaTag('og:title', ogTitle || title, true);
    updateMetaTag('og:description', ogDescription || description, true);
    updateMetaTag('og:type', 'website', true);
    updateMetaTag('og:site_name', 'Treemarkables', true);
    updateMetaTag('og:url', canonicalUrl || window.location.href, true);
    
    if (ogImage) {
      updateMetaTag('og:image', ogImage, true);
      updateMetaTag('og:image:width', '1200', true);
      updateMetaTag('og:image:height', '630', true);
      updateMetaTag('og:image:alt', ogTitle || title, true);
    }

    // Twitter Card tags
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', ogTitle || title);
    updateMetaTag('twitter:description', ogDescription || description);
    
    if (ogImage) {
      updateMetaTag('twitter:image', ogImage);
    }

    // Local business tags
    updateMetaTag('geo.region', 'NZ-GIS');
    updateMetaTag('geo.placename', 'Gisborne');
    updateMetaTag('geo.position', '-38.6623, 178.0176');
    updateMetaTag('ICBM', '-38.6623, 178.0176');

    // Add viewport meta tag
    let viewportTag = document.querySelector('meta[name="viewport"]');
    if (!viewportTag) {
      viewportTag = document.createElement('meta');
      viewportTag.setAttribute('name', 'viewport');
      viewportTag.setAttribute('content', 'width=device-width, initial-scale=1.0');
      document.head.appendChild(viewportTag);
    }

    // Add robots meta tag — noindex for pages that shouldn't appear in search
    // (e.g. post-order confirmation pages)
    updateMetaTag('robots', noindex ? 'noindex, follow' : 'index, follow');

    // Add author meta tag
    updateMetaTag('author', 'Treemarkables');

    // Add structured data
    if (structuredData) {
      let script = document.querySelector('#structured-data') as HTMLScriptElement;
      if (!script) {
        script = document.createElement('script');
        script.id = 'structured-data';
        script.type = 'application/ld+json';
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(structuredData);
    }

  }, [title, description, keywords, ogTitle, ogDescription, ogImage, canonicalUrl, structuredData, noindex]);

  return null;
}