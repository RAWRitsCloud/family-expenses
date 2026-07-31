import { useEffect } from "react";

export const APP_NAME = "Our Family Money";

// Sets the browser tab title to "<pageTitle> · Our Family Money" while the page
// is mounted (or just the app name when no page title is given).
export function useDocumentTitle(pageTitle) {
  useEffect(() => {
    document.title = pageTitle ? `${pageTitle} · ${APP_NAME}` : APP_NAME;
  }, [pageTitle]);
}
