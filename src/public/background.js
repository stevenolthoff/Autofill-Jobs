chrome.runtime.onMessage.addListener((message, sendResponse) => {
    if (message.action === 'triggerAutofill') {
      // Call your autofill function here
      awaitForm();
      sendResponse({ status: 'success' });
    }
  });