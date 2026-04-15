/* eslint-env mocha */
import assert from 'assert';
import sinon from 'sinon';
import decorate from '../../blocks/form/components/pan-input/pan-input.js';

// The subscribe callback in decorate requires a live rule engine (formModels initialised).
// In these unit tests subscribe stores the callback but never invokes it, so
// fieldValidated / removeFieldValidatedProperty class-toggling and
// skipValidationCheckboxName checkbox wiring are not exercised here.
// Those paths are integration-tested via the rule engine test suite.

let formIdCounter = 0;
function nextFormId() {
  formIdCounter += 1;
  return `test-form-${formIdCounter}`;
}

function createFieldDiv(name = 'panNumber') {
  const fieldDiv = document.createElement('div');
  fieldDiv.className = 'field-wrapper';
  fieldDiv.dataset.id = name;
  const input = document.createElement('input');
  input.type = 'text';
  input.name = name;
  input.id = name;
  fieldDiv.appendChild(input);
  document.body.appendChild(fieldDiv);
  return { fieldDiv, input };
}

function triggerInput(input, value) {
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

function triggerBlur(input, value) {
  if (value !== undefined) input.value = value;
  input.dispatchEvent(new Event('blur'));
}

function getErrorText(fieldDiv) {
  return fieldDiv.querySelector('.field-description')?.textContent ?? '';
}

describe('PAN Input Component', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  // ---------------------------------------------------------------------------
  // decorate()
  // ---------------------------------------------------------------------------
  describe('decorate()', () => {
    it('sets maxlength="10" on the input', () => {
      const { fieldDiv, input } = createFieldDiv();
      decorate(fieldDiv, { properties: { fourthChar: 'P' } }, null, nextFormId());
      assert.strictEqual(input.getAttribute('maxlength'), '10');
    });

    it('does not throw when no input element is present', () => {
      const fieldDiv = document.createElement('div');
      fieldDiv.className = 'field-wrapper';
      assert.doesNotThrow(() => decorate(fieldDiv, {}, null, nextFormId()));
    });

    it('defaults fourthChar to P when properties are absent', () => {
      const { fieldDiv, input } = createFieldDiv();
      decorate(fieldDiv, {}, null, nextFormId());
      // A PAN with 'P' as the fourth character should be accepted
      triggerInput(input, 'AABPC1234D');
      assert.strictEqual(input.value, 'AABPC1234D');
      assert.strictEqual(getErrorText(fieldDiv), '');
    });
  });

  // ---------------------------------------------------------------------------
  // Character filtering on input
  // ---------------------------------------------------------------------------
  describe('character filtering (input event)', () => {
    let input;
    let fieldDiv;

    beforeEach(() => {
      ({ fieldDiv, input } = createFieldDiv());
      decorate(fieldDiv, { properties: { fourthChar: 'P' } }, null, nextFormId());
    });

    it('converts lowercase letters to uppercase', () => {
      triggerInput(input, 'aabpc1234d');
      assert.strictEqual(input.value, 'AABPC1234D');
    });

    it('strips non-alphanumeric characters', () => {
      triggerInput(input, 'A-A-B');
      assert.strictEqual(input.value, 'AAB');
    });

    it('filters a digit entered at positions 0–2 (letters only)', () => {
      triggerInput(input, '1AB');
      // '1' at index 0 is not A-Z → filtered; 'A','B' land at indices 0,1
      assert.strictEqual(input.value, 'AB');
    });

    it('filters a character at position 3 that does not match fourthChar', () => {
      triggerInput(input, 'AABX');
      // 'X' ≠ 'P' at index 3 → filtered
      assert.strictEqual(input.value, 'AAB');
    });

    it('accepts the correct fourthChar at position 3', () => {
      triggerInput(input, 'AABP');
      assert.strictEqual(input.value, 'AABP');
    });

    it('filters a letter entered at digit positions 5–8', () => {
      triggerInput(input, 'AABPCA');
      // 'A' at index 5 is not 0-9 → filtered
      assert.strictEqual(input.value, 'AABPC');
    });

    it('filters a digit entered at position 9 (letter only)', () => {
      triggerInput(input, 'AABPC12341');
      // '1' at index 9 is not A-Z → filtered
      assert.strictEqual(input.value, 'AABPC1234');
    });
  });

  // ---------------------------------------------------------------------------
  // Validation messages on input
  // ---------------------------------------------------------------------------
  describe('validation messages (input event)', () => {
    let input;
    let fieldDiv;

    beforeEach(() => {
      ({ fieldDiv, input } = createFieldDiv());
      decorate(fieldDiv, { properties: { fourthChar: 'P' } }, null, nextFormId());
    });

    it('shows no error when the field is empty', () => {
      triggerInput(input, '');
      assert.strictEqual(getErrorText(fieldDiv), '');
    });

    it('shows an incomplete-length error for a partial PAN (1–9 chars)', () => {
      triggerInput(input, 'AABPC');
      assert.strictEqual(getErrorText(fieldDiv), 'PAN must be 10 characters long');
    });

    it('clears the error for a fully valid 10-character PAN', () => {
      // First make it invalid so there is an existing error to clear
      triggerInput(input, 'AABPC');
      assert.ok(getErrorText(fieldDiv).length > 0);

      triggerInput(input, 'AABPC1234D');
      assert.strictEqual(getErrorText(fieldDiv), '');
    });
  });

  // ---------------------------------------------------------------------------
  // fourthChar configuration
  // ---------------------------------------------------------------------------
  describe('fourthChar configuration', () => {
    it('accepts a PAN whose 4th char matches a custom fourthChar (H)', () => {
      const { fieldDiv, input } = createFieldDiv();
      decorate(fieldDiv, { properties: { fourthChar: 'H' } }, null, nextFormId());
      triggerInput(input, 'AABHC1234D');
      assert.strictEqual(input.value, 'AABHC1234D');
      assert.strictEqual(getErrorText(fieldDiv), '');
    });

    it('filters out a character at position 3 that does not match the custom fourthChar', () => {
      const { fieldDiv, input } = createFieldDiv();
      decorate(fieldDiv, { properties: { fourthChar: 'H' } }, null, nextFormId());
      // 'P' at position 3 should be rejected when fourthChar is 'H'
      triggerInput(input, 'AABP');
      assert.strictEqual(input.value, 'AAB');
    });
  });

  // ---------------------------------------------------------------------------
  // Blur event
  // ---------------------------------------------------------------------------
  describe('blur event', () => {
    let input;
    let fieldDiv;

    beforeEach(() => {
      ({ fieldDiv, input } = createFieldDiv());
      decorate(fieldDiv, { properties: { fourthChar: 'P' } }, null, nextFormId());
    });

    it('applies formatting on blur and shows no error for a valid PAN', () => {
      triggerBlur(input, 'AABPC1234D');
      assert.strictEqual(input.value, 'AABPC1234D');
      assert.strictEqual(getErrorText(fieldDiv), '');
    });

    it('shows an incomplete-length error on blur for a partial PAN', () => {
      triggerBlur(input, 'AABPC');
      assert.strictEqual(getErrorText(fieldDiv), 'PAN must be 10 characters long');
    });

    it('clears the field value on blur when all characters are invalid for their positions', () => {
      // All digits — every character fails its positional check → formatted result is ''
      triggerBlur(input, '12345');
      assert.strictEqual(input.value, '');
    });

    it('clears any error message on blur when the field is empty', () => {
      // Plant an error first
      triggerInput(input, 'AABPC');
      triggerBlur(input, '');
      assert.strictEqual(getErrorText(fieldDiv), '');
    });
  });

  // ---------------------------------------------------------------------------
  // skipValidationCheckboxName
  // ---------------------------------------------------------------------------
  describe('skipValidationCheckboxName', () => {
    it('does not throw when a named checkbox exists in the form', () => {
      const { fieldDiv } = createFieldDiv('panSkip');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.name = 'panNotAvailable';
      document.body.appendChild(checkbox);

      assert.doesNotThrow(() => decorate(
        fieldDiv,
        { properties: { fourthChar: 'P', skipValidationCheckboxName: 'panNotAvailable' } },
        null,
        nextFormId(),
      ));
    });

    it('does not throw when the named checkbox does not exist', () => {
      const { fieldDiv } = createFieldDiv('panNoCheckbox');
      assert.doesNotThrow(() => decorate(
        fieldDiv,
        { properties: { fourthChar: 'P', skipValidationCheckboxName: 'nonExistentCheckbox' } },
        null,
        nextFormId(),
      ));
    });
  });
});
