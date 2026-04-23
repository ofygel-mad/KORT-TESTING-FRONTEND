import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { WifiOff } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileNav } from './MobileNav';
import { CommandPalette } from '../../widgets/command-palette/CommandPalette';
import { FloatingChatbar } from '../../features/chat/FloatingChatbar';
import { useChatSocket } from '../../features/chat/useChatSocket';
import { useCommandPalette } from '../../shared/stores/commandPalette';
import { useKeyboardShortcuts } from '../../shared/hooks/useKeyboardShortcuts';
import { ShortcutsModal } from '../../shared/ui/ShortcutsModal';
import { useIsMobile } from '../../shared/hooks/useIsMobile';
import { useDevicePerformance } from '../../shared/hooks/useDevicePerformance';
import { useViewportProfile } from '../../shared/hooks/useViewportProfile';
import { useAuthStore } from '../../shared/stores/auth';
import { pageTransition } from '../../shared/motion/presets';
import { addDocumentListener } from '../../shared/lib/browser';
import styles from './AppShell.module.css';

const subscribeToTheme = (cb: () => void) => {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributeFilter: ['data-theme'] });
  return () => obs.disconnect();
};
const getThemeSnapshot = () => document.documentElement.getAttribute('data-theme') ?? 'dark';
const getThemeServerSnapshot = () => 'dark';

function OfflineBanner() {
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  if (!offline) return null;
  return (
    <div className={styles.offlineBanner}>
      <WifiOff size={14} /> Нет подключения. Данные могут быть устаревшими.
    </div>
  );
}

export function AppShell() {
  const { isOpen, toggle } = useCommandPalette();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const isMobile = useIsMobile();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const performance = useDevicePerformance();
  useViewportProfile();

  // Reactively read the resolved data-theme attribute (kept in sync by applyTheme)
  const resolvedTheme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getThemeServerSnapshot,
  );

  const isCanvasPage = location.pathname === '/';
  // Canvas: overlaid glass chrome (not in layout flow)
  // Work pages + light theme: light chrome
  // Everything else: dark chrome
  const chromeTone: 'canvas' | 'dark' | 'light' = isCanvasPage
    ? 'canvas'
    : !isCanvasPage && resolvedTheme === 'light'
    ? 'light'
    : 'dark';

  // Cmd/Ctrl+K → command palette
  useEffect(() => {
    return addDocumentListener('keydown', (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggle();
      }
    });
  }, [toggle]);

  useKeyboardShortcuts({ '/': toggle, '?': () => setShortcutsOpen(true) });
  useChatSocket();

  if (!user) {
    // Keep the outlet alive so nested auth redirects can run on "/" when the
    // session has not been restored yet.
    return <Outlet />;
  }

  return (
    <div className={`${styles.root} ${isCanvasPage ? styles.canvasMode : ''}`}>
      <div className={styles.ambientGlow} aria-hidden="true" />
      <div className={styles.ambientGrid} aria-hidden="true" />
      <OfflineBanner />

      {!isMobile && (
        <div className={styles.sidebarRail}>
          <Sidebar chromeTone={chromeTone} />
        </div>
      )}

      <div className={styles.content}>
        <Topbar chromeTone={chromeTone} />
        <main className={styles.main} data-app-scroll="true">
          {performance.preferMinimalMotion ? (
            <div className={styles.routeViewport}>
              <Outlet />
            </div>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={location.pathname}
                initial={pageTransition.initial}
                animate={pageTransition.animate}
                exit={pageTransition.exit}
                transition={pageTransition.transition}
                className={styles.routeViewport}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          )}
        </main>
      </div>

      {isMobile && <MobileNav />}
      {isOpen && <CommandPalette />}
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <FloatingChatbar />
    </div>
  );
}
