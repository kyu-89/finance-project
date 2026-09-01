'use client';

import { useEffect } from 'react';

const sectionIds = ['members', 'goals', 'tasks'];

export function SettingsSectionAnchors() {
  useEffect(() => {
    const headings = Array.from(document.querySelectorAll('main h2')).slice(0, sectionIds.length);
    headings.forEach((heading, index) => {
      heading.closest('section')?.setAttribute('id', sectionIds[index]);
    });
    const target = document.getElementById(window.location.hash.slice(1));
    target?.scrollIntoView({ block: 'start' });
  }, []);

  return null;
}
