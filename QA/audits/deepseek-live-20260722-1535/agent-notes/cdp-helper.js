const WebSocket = require('ws');
const http = require('http');

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.msgId = 0;
    this.pending = new Map();
    this.events = new Map();
    this.connected = false;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.on('open', () => { this.connected = true; resolve(); });
      this.ws.on('error', reject);
      this.ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
          else resolve(msg.result);
        }
        if (msg.method) {
          const handlers = this.events.get(msg.method) || [];
          handlers.forEach(h => h(msg.params));
        }
      });
    });
  }

  async send(method, params = {}) {
    const id = ++this.msgId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, handler) {
    if (!this.events.has(method)) this.events.set(method, []);
    this.events.get(method).push(handler);
  }

  async close() {
    if (this.ws) this.ws.close();
  }
}

// Get page list from Chrome
async function getPages() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

// Create a new page (tab)
async function createPage(url) {
  return new Promise((resolve, reject) => {
    const req = http.request('http://127.0.0.1:9222/json/new?url=' + encodeURIComponent(url), { method: 'PUT' }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.end();
  });
}

// Close a page
async function closePage(pageId) {
  return new Promise((resolve, reject) => {
    const req = http.request('http://127.0.0.1:9222/json/close/' + pageId, { method: 'GET' }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.end();
  });
}

// Activate a page (bring to front)
async function activatePage(pageId) {
  return new Promise((resolve, reject) => {
    const req = http.request('http://127.0.0.1:9222/json/activate/' + pageId, { method: 'GET' }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.end();
  });
}

// Evaluate JavaScript in a page
async function evaluate(pageWsUrl, expression) {
  const client = new CDPClient(pageWsUrl);
  await client.connect();
  
  // Enable Runtime
  await client.send('Runtime.enable');
  
  // Evaluate
  const result = await client.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
    timeout: 30000
  });
  
  await client.close();
  
  if (result.exceptionDetails) {
    throw new Error(JSON.stringify(result.exceptionDetails));
  }
  return result.result;
}

// Navigate a page
async function navigate(pageWsUrl, url) {
  const client = new CDPClient(pageWsUrl);
  await client.connect();
  await client.send('Page.enable');
  await client.send('Page.navigate', { url });
  // Wait for load
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Navigation timeout')), 30000);
    client.on('Page.loadEventFired', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
  await client.close();
}

// Click on an element matching a selector
async function click(pageWsUrl, selector) {
  const client = new CDPClient(pageWsUrl);
  await client.connect();
  await client.send('Runtime.enable');
  
  const result = await client.send('Runtime.evaluate', {
    expression: `
      (function() {
        const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
        if (!el) return { found: false };
        el.click();
        return { found: true, text: el.textContent?.substring(0, 50) };
      })()
    `,
    returnByValue: true
  });
  
  await client.close();
  return result.result;
}

// Fill an input field
async function fill(pageWsUrl, selector, value) {
  const client = new CDPClient(pageWsUrl);
  await client.connect();
  await client.send('Runtime.enable');
  
  const escapedValue = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const result = await client.send('Runtime.evaluate', {
    expression: `
      (function() {
        const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
        if (!el) return { found: false };
        // Set value using native setter to trigger React onChange
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(el, '${escapedValue}');
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return { found: true, value: el.value };
      })()
    `,
    returnByValue: true
  });
  
  await client.close();
  return result.result;
}

// Get page title
async function getTitle(pageWsUrl) {
  const client = new CDPClient(pageWsUrl);
  await client.connect();
  await client.send('Runtime.enable');
  const result = await client.send('Runtime.evaluate', {
    expression: 'document.title',
    returnByValue: true
  });
  await client.close();
  return result.result?.value;
}

// Wait for a short time
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { CDPClient, getPages, createPage, closePage, activatePage, evaluate, navigate, click, fill, getTitle, sleep };
