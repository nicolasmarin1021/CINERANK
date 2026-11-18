import type { ReactNode } from 'react';

/** En iOS y Android nativos no hace falta: las zonas seguras llegan bien. Ver viewport-fix.web.tsx. */
export function ViewportFix({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
