import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCompetitionImage } from '../../resources/js/media-validation.js';

test('accepts competition photos at the configured Storage limit', () => {
    const file = { type: 'image/png', size: 10 * 1024 * 1024 };
    assert.equal(validateCompetitionImage(file), file);
});
test('rejects nonimages, oversized files and empty selections before uploading', () => {
    for (const file of [null, { size: 0, type: 'image/png' }, { size: 100, type: 'text/html' }, { size: 10 * 1024 * 1024 + 1, type: 'image/png' }]) {
        assert.throws(() => validateCompetitionImage(file));
    }
});
