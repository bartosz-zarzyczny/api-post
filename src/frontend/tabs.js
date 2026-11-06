function createRequestTabs() {
  let nextId = 1;
  const tabs = [];
  let active;

  function add() {
    const id = nextId++;
    const tab = {
      id,
      name: `Request ${id}`,
      filename: null,
      url: '',
      method: 'GET',
      headers: '',
      body: '',
      curl: '',
      response: { state: 'empty' },
    };
    tabs.push(tab);
    active = tab;
    return tab;
  }

  function select(tab) {
    if (!tabs.includes(tab)) throw new Error('Request tab not found.');
    active = tab;
  }

  function remove(tab) {
    const index = tabs.indexOf(tab);
    if (index === -1) throw new Error('Request tab not found.');
    tabs.splice(index, 1);
    if (!tabs.length) add();
    else if (active === tab) active = tabs[Math.min(index, tabs.length - 1)];
  }

  add();
  return { tabs, add, select, remove, get active() { return active; } };
}

globalThis.createRequestTabs = createRequestTabs;
