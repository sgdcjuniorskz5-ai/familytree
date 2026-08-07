const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const html = fs.readFileSync('index.html', 'utf8');
const dom = new JSDOM(html, { runScripts: "dangerously", resources: "usable" });

const sampleData = fs.readFileSync('sample-data.js', 'utf8');
const relationship = fs.readFileSync('relationship.js', 'utf8');
const layout = fs.readFileSync('tree-layout.js', 'utf8');
const renderer = fs.readFileSync('tree-renderer.js', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');

dom.window.eval(sampleData);
dom.window.eval(relationship);
dom.window.eval(layout);
dom.window.eval(`
  function resizeCanvas() {}
  ${renderer}
`);

// Expose state and functions to window
const appModified = app + `
  window.appState = state;
  window.openNewMemberModal = openNewMemberModal;
  window.openAddRelativeModal = openAddRelativeModal;
  window.startSelectionMode = startSelectionMode;
`;
dom.window.eval(appModified);

setTimeout(() => {
  try {
    console.log("Adding new unconnected member...");
    dom.window.document.getElementById('add-unconnected-btn').click();
    dom.window.document.getElementById('new-firstName').value = 'Test';
    dom.window.document.getElementById('new-lastName').value = 'User';
    dom.window.document.getElementById('new-member-form').dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
    
    console.log("Success! Focused:", dom.window.appState.focusedPersonId);
    console.log("Modal closed?", !dom.window.document.getElementById('modal-new-member').classList.contains('open'));
  } catch (e) {
    console.error("Error during unconnected creation:", e);
  }

  try {
    console.log("\\nTesting Add Relative (Father)...");
    dom.window.appState.selectedPersonId = "1";
    dom.window.openAddRelativeModal('father', "1");
    dom.window.document.getElementById('rel-firstName').value = 'Father';
    dom.window.document.getElementById('rel-lastName').value = 'User';
    dom.window.document.getElementById('add-relative-form').dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
    console.log("Success! Father added.");
    console.log("Modal closed?", !dom.window.document.getElementById('modal-add-relative').classList.contains('open'));
  } catch(e) {
    console.error("Error during add relative:", e);
  }
}, 500);
