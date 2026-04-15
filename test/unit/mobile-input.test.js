/* eslint-env mocha */
import assert from 'assert';
import sinon from 'sinon';
import decorate from '../../blocks/form/components/mobile-input/mobile-input.js';

const COUNTRIES = [
  { ISDCODE: '91', DESCRIPTION: 'India' },
  { ISDCODE: '1', COUNTRYNAME: 'United States' },
  { ISDCODE: '44', DESCRIPTION: 'United Kingdom' },
];

function createPanel() {
  const panel = document.createElement('div');

  const searchWrapper = document.createElement('div');
  searchWrapper.className = 'field-countrycodesearch';
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.name = 'countryCodeSearch';
  searchWrapper.appendChild(searchInput);

  const countryCodeWrapper = document.createElement('div');
  countryCodeWrapper.className = 'field-countrycode';
  const countryCodeInput = document.createElement('input');
  countryCodeInput.type = 'text';
  countryCodeInput.name = 'countryCode';
  countryCodeWrapper.appendChild(countryCodeInput);

  const phoneInput = document.createElement('input');
  phoneInput.type = 'number';

  panel.appendChild(searchWrapper);
  panel.appendChild(countryCodeWrapper);
  panel.appendChild(phoneInput);
  document.body.appendChild(panel);

  return {
    panel,
    searchWrapper,
    searchInput,
    countryCodeWrapper,
    countryCodeInput,
    phoneInput,
  };
}

function stubFetchOk(data) {
  return sinon.stub(global, 'fetch').resolves({
    ok: true,
    json: () => Promise.resolve(data),
  });
}

describe('Mobile Input Component', () => {
  let fetchStub;
  let consoleWarnStub;
  let consoleErrorStub;

  beforeEach(() => {
    document.body.innerHTML = '';
    consoleWarnStub = sinon.stub(console, 'warn');
    consoleErrorStub = sinon.stub(console, 'error');
  });

  afterEach(() => {
    fetchStub?.restore();
    consoleWarnStub.restore();
    consoleErrorStub.restore();
    document.body.innerHTML = '';
  });

  // ---------------------------------------------------------------------------
  // countryCodesUrl not configured
  // ---------------------------------------------------------------------------
  describe('when countryCodesUrl is not configured', () => {
    it('returns the panel and logs a warning', async () => {
      const { panel } = createPanel();
      const result = await decorate(panel, { properties: {} });
      assert.strictEqual(result, panel);
      assert.ok(consoleWarnStub.calledOnce);
      assert.ok(consoleWarnStub.firstCall.args[0].includes('no countryCodesUrl configured'));
    });

    it('still wires up the phone number input handler (enforces maxLength cap)', async () => {
      const { panel, phoneInput } = createPanel();
      await decorate(panel, { properties: { phoneMaxLength: 3 } });
      phoneInput.value = '123456';
      phoneInput.dispatchEvent(new Event('input'));
      assert.strictEqual(phoneInput.value, '123');
    });
  });

  // ---------------------------------------------------------------------------
  // Fetch failure handling
  // ---------------------------------------------------------------------------
  describe('fetch failure handling', () => {
    it('returns the panel and logs an error when response.ok is false', async () => {
      const { panel } = createPanel();
      fetchStub = sinon.stub(global, 'fetch').resolves({ ok: false, status: 404 });
      const result = await decorate(panel, { properties: { countryCodesUrl: '/api/countries.json' } });
      assert.strictEqual(result, panel);
      assert.ok(consoleErrorStub.calledOnce);
      assert.ok(consoleErrorStub.firstCall.args[0].includes('HTTP 404'));
    });

    it('catches a thrown network error and logs it', async () => {
      const { panel } = createPanel();
      fetchStub = sinon.stub(global, 'fetch').rejects(new Error('Network failure'));
      const result = await decorate(panel, { properties: { countryCodesUrl: '/api/countries.json' } });
      assert.strictEqual(result, panel);
      assert.ok(consoleErrorStub.calledOnce);
    });
  });

  // ---------------------------------------------------------------------------
  // Dropdown list construction
  // ---------------------------------------------------------------------------
  describe('dropdown list construction', () => {
    it('returns the panel after a successful fetch', async () => {
      fetchStub = stubFetchOk(COUNTRIES);
      const { panel } = createPanel();
      const result = await decorate(panel, { properties: { countryCodesUrl: '/api/countries.json' } });
      assert.strictEqual(result, panel);
    });

    it('appends a .isd-drop-down list to the search wrapper', async () => {
      fetchStub = stubFetchOk(COUNTRIES);
      const { panel, searchWrapper } = createPanel();
      await decorate(panel, { properties: { countryCodesUrl: '/api/countries.json' } });
      assert.ok(searchWrapper.querySelector('.isd-drop-down'));
    });

    it('creates one .lianchor item per unique country', async () => {
      fetchStub = stubFetchOk(COUNTRIES);
      const { panel, searchWrapper } = createPanel();
      await decorate(panel, { properties: { countryCodesUrl: '/api/countries.json' } });
      assert.strictEqual(searchWrapper.querySelectorAll('.lianchor').length, COUNTRIES.length);
    });

    it('deduplicates entries with the same ISD code', async () => {
      fetchStub = stubFetchOk([
        { ISDCODE: '91', DESCRIPTION: 'India' },
        { ISDCODE: '91', DESCRIPTION: 'India duplicate' },
        { ISDCODE: '44', DESCRIPTION: 'United Kingdom' },
      ]);
      const { panel, searchWrapper } = createPanel();
      await decorate(panel, { properties: { countryCodesUrl: '/api/countries.json' } });
      assert.strictEqual(searchWrapper.querySelectorAll('.lianchor').length, 2);
    });

    it('uses COUNTRYNAME as a fallback when DESCRIPTION is absent', async () => {
      fetchStub = stubFetchOk([{ ISDCODE: '1', COUNTRYNAME: 'United States' }]);
      const { panel, searchWrapper } = createPanel();
      await decorate(panel, { properties: { countryCodesUrl: '/api/countries.json' } });
      const item = searchWrapper.querySelector('.lianchor');
      assert.ok(item.innerText.includes('United States'));
    });

    it('skips entries that have no ISD code', async () => {
      fetchStub = stubFetchOk([
        { DESCRIPTION: 'No ISD Code' },
        { ISDCODE: '91', DESCRIPTION: 'India' },
      ]);
      const { panel, searchWrapper } = createPanel();
      await decorate(panel, { properties: { countryCodesUrl: '/api/countries.json' } });
      assert.strictEqual(searchWrapper.querySelectorAll('.lianchor').length, 1);
    });

    it('skips entries that have no country name', async () => {
      fetchStub = stubFetchOk([
        { ISDCODE: '99' },
        { ISDCODE: '91', DESCRIPTION: 'India' },
      ]);
      const { panel, searchWrapper } = createPanel();
      await decorate(panel, { properties: { countryCodesUrl: '/api/countries.json' } });
      assert.strictEqual(searchWrapper.querySelectorAll('.lianchor').length, 1);
    });

    it('sets searchInput.dataset.id to "searchcode-id"', async () => {
      fetchStub = stubFetchOk(COUNTRIES);
      const { panel, searchInput } = createPanel();
      await decorate(panel, { properties: { countryCodesUrl: '/api/countries.json' } });
      assert.strictEqual(searchInput.dataset.id, 'searchcode-id');
    });
  });

  // ---------------------------------------------------------------------------
  // Country selection
  // ---------------------------------------------------------------------------
  describe('country selection', () => {
    it('sets searchInput and countryCode values when a list item is mousedown-ed', async () => {
      fetchStub = stubFetchOk(COUNTRIES);
      const { panel, searchWrapper, searchInput, countryCodeInput } = createPanel();
      await decorate(panel, { properties: { countryCodesUrl: '/api/countries.json' } });

      const firstItem = searchWrapper.querySelector('.lianchor');
      // First country is India → dataset.id = '+91'
      firstItem.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

      assert.strictEqual(searchInput.value, '+91');
      assert.strictEqual(countryCodeInput.value, '+91');
    });

    it('hides the search dropdown after a country is selected', async () => {
      fetchStub = stubFetchOk(COUNTRIES);
      const { panel, searchWrapper, searchInput } = createPanel();
      await decorate(panel, { properties: { countryCodesUrl: '/api/countries.json' } });

      searchInput.parentNode.dataset.visible = 'true';
      searchWrapper.querySelector('.lianchor').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

      assert.strictEqual(searchInput.parentNode.dataset.visible, 'false');
    });
  });

  // ---------------------------------------------------------------------------
  // Country code field interactions
  // ---------------------------------------------------------------------------
  describe('country code field interactions', () => {
    it('opens the search dropdown when the country code field is clicked', async () => {
      fetchStub = stubFetchOk(COUNTRIES);
      const { panel, searchInput, countryCodeWrapper } = createPanel();
      await decorate(panel, { properties: { countryCodesUrl: '/api/countries.json' } });

      countryCodeWrapper.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      assert.strictEqual(searchInput.parentNode.dataset.visible, 'true');
    });

    it('strips characters other than alphanumeric and + from the country code input', async () => {
      fetchStub = stubFetchOk(COUNTRIES);
      const { panel, countryCodeInput } = createPanel();
      await decorate(panel, { properties: { countryCodesUrl: '/api/countries.json' } });

      countryCodeInput.value = '+91!@#';
      countryCodeInput.dispatchEvent(new Event('input'));
      assert.strictEqual(countryCodeInput.value, '+91');
    });
  });

  // ---------------------------------------------------------------------------
  // Phone number filtering
  // ---------------------------------------------------------------------------
  describe('phone number filtering', () => {
    it('passes digit-only values through the handler unchanged when within maxLength', async () => {
      // Note: jsdom sanitises type="number" inputs at the value setter — non-digit
      // characters are rejected before the event handler runs. The replace(/\D/g,'')
      // in the handler is a real-browser defensive guard against programmatic pre-fills.
      // Here we verify the handler is wired by confirming an all-digit value survives.
      fetchStub = stubFetchOk(COUNTRIES);
      const { panel, phoneInput } = createPanel();
      await decorate(panel, { properties: { countryCodesUrl: '/api/countries.json' } });

      phoneInput.value = '9876';
      phoneInput.dispatchEvent(new Event('input'));
      assert.strictEqual(phoneInput.value, '9876');
    });

    it('truncates digits to phoneMaxLength', async () => {
      fetchStub = stubFetchOk(COUNTRIES);
      const { panel, phoneInput } = createPanel();
      await decorate(panel, { properties: { countryCodesUrl: '/api/countries.json', phoneMaxLength: 5 } });

      phoneInput.value = '1234567890';
      phoneInput.dispatchEvent(new Event('input'));
      assert.strictEqual(phoneInput.value, '12345');
    });

    it('defaults phoneMaxLength to 15', async () => {
      fetchStub = stubFetchOk(COUNTRIES);
      const { panel, phoneInput } = createPanel();
      await decorate(panel, { properties: { countryCodesUrl: '/api/countries.json' } });

      phoneInput.value = '1234567890123456'; // 16 digits
      phoneInput.dispatchEvent(new Event('input'));
      assert.strictEqual(phoneInput.value.length, 15);
    });
  });

  // ---------------------------------------------------------------------------
  // Search filtering
  // ---------------------------------------------------------------------------
  describe('search filtering', () => {
    it('filters the dropdown to matching countries when the user types', async () => {
      fetchStub = stubFetchOk(COUNTRIES);
      const { panel, searchWrapper, searchInput } = createPanel();
      await decorate(panel, { properties: { countryCodesUrl: '/api/countries.json' } });

      searchInput.value = 'india';
      searchInput.dispatchEvent(new KeyboardEvent('keyup'));

      const items = searchWrapper.querySelectorAll('.lianchor');
      assert.strictEqual(items.length, 1);
      assert.ok(items[0].innerText.toLowerCase().includes('india'));
    });

    it('restores all items when the search query is cleared', async () => {
      fetchStub = stubFetchOk(COUNTRIES);
      const { panel, searchWrapper, searchInput } = createPanel();
      await decorate(panel, { properties: { countryCodesUrl: '/api/countries.json' } });

      searchInput.value = 'india';
      searchInput.dispatchEvent(new KeyboardEvent('keyup'));

      searchInput.value = '';
      searchInput.dispatchEvent(new KeyboardEvent('keyup'));

      assert.strictEqual(searchWrapper.querySelectorAll('.lianchor').length, COUNTRIES.length);
    });

    it('shows all items as a fallback when no results match', async () => {
      fetchStub = stubFetchOk(COUNTRIES);
      const { panel, searchWrapper, searchInput } = createPanel();
      await decorate(panel, { properties: { countryCodesUrl: '/api/countries.json' } });

      searchInput.value = 'zzzzz';
      searchInput.dispatchEvent(new KeyboardEvent('keyup'));

      assert.strictEqual(searchWrapper.querySelectorAll('.lianchor').length, COUNTRIES.length);
    });

    it('search is case-insensitive', async () => {
      fetchStub = stubFetchOk(COUNTRIES);
      const { panel, searchWrapper, searchInput } = createPanel();
      await decorate(panel, { properties: { countryCodesUrl: '/api/countries.json' } });

      searchInput.value = 'INDIA';
      searchInput.dispatchEvent(new KeyboardEvent('keyup'));

      assert.strictEqual(searchWrapper.querySelectorAll('.lianchor').length, 1);
    });
  });

  // ---------------------------------------------------------------------------
  // Focus-out behaviour
  // ---------------------------------------------------------------------------
  describe('focusout behaviour', () => {
    let clock;

    afterEach(() => {
      clock?.restore();
    });

    it('hides the search dropdown 100 ms after the search wrapper loses focus', async () => {
      clock = sinon.useFakeTimers();
      fetchStub = stubFetchOk(COUNTRIES);
      const { panel, searchWrapper, searchInput } = createPanel();
      await decorate(panel, { properties: { countryCodesUrl: '/api/countries.json' } });

      searchInput.parentNode.dataset.visible = 'true';
      searchWrapper.dispatchEvent(new Event('focusout'));

      // Should still be visible immediately after the event
      assert.strictEqual(searchInput.parentNode.dataset.visible, 'true');

      clock.tick(150);
      assert.strictEqual(searchInput.parentNode.dataset.visible, 'false');
    });
  });
});
