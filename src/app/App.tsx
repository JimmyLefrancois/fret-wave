import { useState } from 'react';
import { TabPage } from './TabPage';
import { TheoryPage } from './TheoryPage';

type Page = 'tab' | 'theory';

/** Page de contrôle (phases 1a-1b) : ce n'est pas l'UI finale (hub, thèmes, modules : 1c et suivantes). */
export function App() {
  const [page, setPage] = useState<Page>(() => (location.hash === '#theorie' ? 'theory' : 'tab'));
  const go = (p: Page) => {
    location.hash = p === 'theory' ? '#theorie' : '#tab';
    setPage(p);
  };
  return (
    <>
      <nav className="topnav">
        <button className={page === 'tab' ? 'on' : ''} onClick={() => go('tab')}>Tablature</button>
        <button className={page === 'theory' ? 'on' : ''} onClick={() => go('theory')}>Théorie</button>
      </nav>
      {page === 'tab' ? <TabPage /> : <TheoryPage />}
    </>
  );
}
