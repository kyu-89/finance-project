'use client';

import { useEffect } from 'react';

const sectionIds = ['members', 'goals', 'tasks'];

export function SettingsSectionAnchors() {
  useEffect(() => {
    const headings = Array.from(document.querySelectorAll('main h2')).slice(0, sectionIds.length);
    headings.forEach((heading, index) => {
      heading.closest('section')?.setAttribute('id', sectionIds[index]);
    });
    const scrollToHash = () => {
      const hash = window.location.hash.slice(1);
      if (!hash) return;
      document.getElementById(hash)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    };

    window.addEventListener('hashchange', scrollToHash);
    requestAnimationFrame(scrollToHash);
    return () => window.removeEventListener('hashchange', scrollToHash);
  }, []);

  return null;
}
