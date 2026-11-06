function setupTheme({ root, selector, message, store }) {
  function showError(text) {
    message.textContent = text;
    message.hidden = false;
  }

  function apply(theme) {
    root.dataset.theme = theme;
    selector.value = theme;
  }

  selector.addEventListener('change', async () => {
    const theme = selector.value;
    apply(theme);
    selector.disabled = true;
    message.hidden = true;
    try {
      if (!(await store.set('theme', theme))) {
        showError('Theme changed, but could not be saved. It may be lost after restarting.');
      }
    } catch (error) {
      showError(`Theme changed, but could not be saved: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      selector.disabled = false;
    }
  });

  return (async () => {
    try {
      const saved = await store.get('theme');
      if (saved === null || saved === 'classic') apply('classic');
      else if (saved === 'orange' || saved === 'solarwinds') apply('orange');
      else showError('Saved theme is invalid. The classic theme is active; select a theme to replace it.');
    } catch (error) {
      showError(`Could not load saved theme: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      selector.disabled = false;
    }
  })();
}

globalThis.setupTheme = setupTheme;
